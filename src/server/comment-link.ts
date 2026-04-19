export function extractCommentIdFromUrl(targetUrl: string) {
  const candidates: string[] = [targetUrl];
  let decoded = targetUrl;

  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);

      if (next === decoded) {
        break;
      }

      decoded = next;
      candidates.push(decoded);
    } catch {
      break;
    }
  }

  const patterns = [
    /weibo\.cn\/comment\/([a-zA-Z0-9]{8,})/i,
    /[?&](?:rid|id|object_id)=([a-zA-Z0-9]{8,})/i,
    /reportspam\?[^\n]*?rid=([a-zA-Z0-9]{8,})/i,
    /\brid[=:]([a-zA-Z0-9]{8,})/i,
    /comment\/([a-zA-Z0-9]{8,})/i,
  ];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const matched = candidate.match(pattern);

      if (matched?.[1]) {
        return matched[1];
      }
    }

    const commentContext =
      candidate.toLowerCase().includes("weibo.cn/comment/") ||
      candidate.toLowerCase().includes("rid=") ||
      candidate.toLowerCase().includes("object_id=") ||
      candidate.toLowerCase().includes("comment/");

    if (commentContext) {
      const longDigits = candidate.match(/(\d{15,20})/g);

      if (longDigits && longDigits.length > 0) {
        return longDigits[0];
      }
    }
  }

  return undefined;
}
