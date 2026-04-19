type QrLoginState = "WAITING" | "SCANNED" | "CONFIRMED" | "EXPIRED" | "FAILED";

type QrLoginSession = {
  sessionId: string;
  ownerUserId: string;
  accountId: string;
  qrid: string;
  qrImageDataUrl: string;
  state: QrLoginState;
  message?: string;
  cookieJar: Map<string, string>;
  cookieText?: string;
  username?: string;
  uid?: string;
  expiresAt: number;
  persisted: boolean;
};

type QrStartResult = {
  sessionId: string;
  state: QrLoginState;
  qrImageDataUrl: string;
  expiresAt: string;
};

type QrStatusResult = {
  sessionId: string;
  state: QrLoginState;
  message?: string;
  expiresAt: string;
  username?: string;
  uid?: string;
  cookieText?: string;
  persisted: boolean;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const SESSION_TTL_MS = 3 * 60 * 1000;
const SESSION_MAP = new Map<string, QrLoginSession>();

function parseJsonpPayload(text: string) {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");

  if (start < 0 || end < 0 || end <= start + 1) {
    throw new Error("微博扫码响应格式异常");
  }

  return JSON.parse(text.slice(start + 1, end)) as Record<string, unknown>;
}

function extractSetCookieArray(headers: Headers) {
  const typedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const fromApi = typedHeaders.getSetCookie?.();

  if (fromApi && fromApi.length > 0) {
    return fromApi;
  }

  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(cookieJar: Map<string, string>, setCookieHeaders: string[]) {
  for (const rawSetCookie of setCookieHeaders) {
    const firstPart = rawSetCookie.split(";")[0]?.trim();

    if (!firstPart) {
      continue;
    }

    const separatorIndex = firstPart.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = firstPart.slice(0, separatorIndex).trim();
    const value = firstPart.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    cookieJar.set(key, value);
  }
}

function serializeCookieJar(cookieJar: Map<string, string>) {
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function requestWithCookieJar(url: string, cookieJar: Map<string, string>, extraHeaders?: Record<string, string>) {
  const cookieHeader = serializeCookieJar(cookieJar);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://weibo.com/",
      Accept: "application/json, text/plain, */*",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(extraHeaders || {}),
    },
    cache: "no-store",
  });

  mergeCookies(cookieJar, extractSetCookieArray(response.headers));
  return response;
}

async function finalizeQrLogin(session: QrLoginSession, alt: string) {
  const callback = `STK_${Date.now()}`;
  const loginUrl =
    `https://login.sina.com.cn/sso/login.php?entry=miniblog&returntype=TEXT&crossdomain=1&cdult=3&domain=weibo.com&savestate=30` +
    `&callback=${encodeURIComponent(callback)}&alt=${encodeURIComponent(alt)}`;
  const loginResponse = await requestWithCookieJar(loginUrl, session.cookieJar);
  const loginPayload = parseJsonpPayload(await loginResponse.text());
  const loginRetcode = String(loginPayload.retcode || "");

  if (loginRetcode !== "0") {
    session.state = "FAILED";
    session.message = String(loginPayload.reason || "扫码确认后登录失败");
    return;
  }

  const crossDomainUrls = Array.isArray(loginPayload.crossDomainUrlList)
    ? (loginPayload.crossDomainUrlList as string[])
    : Array.isArray((loginPayload as { data?: { crossDomainUrlList?: string[] } }).data?.crossDomainUrlList)
      ? ((loginPayload as { data?: { crossDomainUrlList?: string[] } }).data?.crossDomainUrlList as string[])
      : [];

  for (const crossDomainUrl of crossDomainUrls) {
    if (!crossDomainUrl || typeof crossDomainUrl !== "string") {
      continue;
    }

    try {
      await requestWithCookieJar(crossDomainUrl, session.cookieJar);
    } catch {
      // 单个跨域回写失败不阻断后续流程
    }
  }

  try {
    await requestWithCookieJar("https://weibo.com/", session.cookieJar, { Accept: "text/html,application/xhtml+xml" });
  } catch {
    // 首页探测失败不阻断，最终由 cookie 校验兜底
  }

  const cookieText = serializeCookieJar(session.cookieJar);

  if (!cookieText.includes("SUB=")) {
    session.state = "FAILED";
    session.message = "扫码已确认，但未提取到有效微博登录 Cookie";
    return;
  }

  session.cookieText = cookieText;
  session.uid = typeof loginPayload.uid === "string" ? loginPayload.uid : undefined;
  session.username = typeof loginPayload.nick === "string" ? loginPayload.nick : undefined;
  session.state = "CONFIRMED";
  session.message = "扫码确认成功，已获取 Cookie";
}

function getSessionOrThrow(sessionId: string, ownerUserId: string, accountId: string) {
  const session = SESSION_MAP.get(sessionId);

  if (!session || session.ownerUserId !== ownerUserId || session.accountId !== accountId) {
    throw new Error("扫码会话不存在或已失效");
  }

  if (Date.now() > session.expiresAt) {
    session.state = "EXPIRED";
    session.message = "二维码已过期，请重新生成";
  }

  return session;
}

export async function startWeiboQrLogin(ownerUserId: string, accountId: string): Promise<QrStartResult> {
  const callback = `STK_${Date.now()}`;
  const initUrl = `https://login.sina.com.cn/sso/qrcode/image?entry=miniblog&size=180&callback=${encodeURIComponent(callback)}`;
  const cookieJar = new Map<string, string>();
  const initResponse = await requestWithCookieJar(initUrl, cookieJar);
  const payload = parseJsonpPayload(await initResponse.text());

  if (String(payload.retcode || "") !== "20000000") {
    throw new Error(String(payload.msg || "微博扫码初始化失败"));
  }

  const data = payload.data as { qrid?: string; image?: string } | undefined;
  const qrid = data?.qrid;
  const imageUrl = data?.image;

  if (!qrid || !imageUrl) {
    throw new Error("微博扫码二维码数据缺失");
  }

  const imageResponse = await requestWithCookieJar(imageUrl, cookieJar, { Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8" });
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  if (imageBuffer.length === 0) {
    throw new Error("微博扫码二维码生成失败");
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const qrImageDataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

  SESSION_MAP.set(sessionId, {
    sessionId,
    ownerUserId,
    accountId,
    qrid,
    qrImageDataUrl,
    state: "WAITING",
    cookieJar,
    expiresAt,
    persisted: false,
  });

  return {
    sessionId,
    state: "WAITING",
    qrImageDataUrl,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function pollWeiboQrLogin(sessionId: string, ownerUserId: string, accountId: string): Promise<QrStatusResult> {
  const session = getSessionOrThrow(sessionId, ownerUserId, accountId);

  if (session.state === "EXPIRED" || session.state === "FAILED" || session.state === "CONFIRMED") {
    return {
      sessionId: session.sessionId,
      state: session.state,
      message: session.message,
      expiresAt: new Date(session.expiresAt).toISOString(),
      username: session.username,
      uid: session.uid,
      cookieText: session.cookieText,
      persisted: session.persisted,
    };
  }

  const callback = `STK_${Date.now()}`;
  const checkUrl =
    `https://login.sina.com.cn/sso/qrcode/check?entry=miniblog&qrid=${encodeURIComponent(session.qrid)}` +
    `&callback=${encodeURIComponent(callback)}`;

  const checkResponse = await requestWithCookieJar(checkUrl, session.cookieJar);
  const payload = parseJsonpPayload(await checkResponse.text());
  const retcode = String(payload.retcode || "");
  const payloadMsg = String(payload.msg || "");

  if (retcode === "50114001") {
    session.state = "WAITING";
    session.message = "等待扫码";
  } else if (retcode === "50114002") {
    session.state = "SCANNED";
    session.message = "已扫码，请在手机确认登录";
  } else if (retcode === "50114003") {
    const alt = (payload.data as { alt?: string } | undefined)?.alt;

    if (!alt) {
      session.state = "FAILED";
      session.message = "扫码确认成功，但未拿到登录令牌";
    } else {
      await finalizeQrLogin(session, alt);
    }
  } else if (retcode === "50114004") {
    session.state = "EXPIRED";
    session.message = "二维码已过期，请重新生成";
  } else if (retcode === "20000000") {
    const maybeAlt = (payload.data as { alt?: string } | undefined)?.alt;

    if (maybeAlt) {
      await finalizeQrLogin(session, maybeAlt);
    } else {
      session.state = "WAITING";
      session.message = "等待扫码";
    }
  } else {
    session.state = "FAILED";
    session.message = `微博扫码状态异常（retcode=${retcode}${payloadMsg ? `, msg=${payloadMsg}` : ""}）`;
  }

  return {
    sessionId: session.sessionId,
    state: session.state,
    message: session.message,
    expiresAt: new Date(session.expiresAt).toISOString(),
    username: session.username,
    uid: session.uid,
    cookieText: session.cookieText,
    persisted: session.persisted,
  };
}

export function markWeiboQrLoginPersisted(sessionId: string, ownerUserId: string, accountId: string) {
  const session = getSessionOrThrow(sessionId, ownerUserId, accountId);
  session.persisted = true;
}
