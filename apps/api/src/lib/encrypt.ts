import crypto from "crypto";

const ACCOUNT_SECRET_KEY = process.env.ACCOUNT_SECRET_KEY;

function getAccountSecretKey() {
  if (!ACCOUNT_SECRET_KEY || ACCOUNT_SECRET_KEY.length < 32) {
    throw new Error("ACCOUNT_SECRET_KEY 未配置或长度不足，请确保环境变量 ACCOUNT_SECRET_KEY 至少为 32 个字符");
  }
  return ACCOUNT_SECRET_KEY;
}

function getKey() {
  return crypto.createHash("sha256").update(getAccountSecretKey()).digest();
}

export function encryptText(value: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptText(payload: string) {
  const [ivHex, encryptedHex] = payload.split(":");

  if (!ivHex || !encryptedHex) {
    throw new Error("加密数据格式不正确");
  }

  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function getDecryptErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("bad decrypt") || message.includes("加密数据格式不正确")) {
    return "账号登录凭据解密失败，请重新登录该微博账号（可能是 ACCOUNT_SECRET_KEY 变更导致历史登录态失效）";
  }

  return message || "账号登录凭据解密失败";
}
