// Password hashing for user accounts and random session tokens.
import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns `scrypt$N$r$p$salt$hash` (salt and hash base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keyLength } = SCRYPT;
  const hash = await scryptAsync(password, salt, keyLength, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

/** A password hash to compare against when the email is unknown, so timing doesn't leak which emails exist. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
