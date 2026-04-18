import crypto from "crypto";

const ACCOUNT_SECRET_KEY = process.env.ACCOUNT_SECRET_KEY || "dev_account_secret_key_for_local_only";

function getKey() {
  return crypto.createHash("sha256").update(ACCOUNT_SECRET_KEY).digest();
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
