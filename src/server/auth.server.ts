// Cookie-based login sessions backed by the dbo.sessions table.
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { request, sql } from "./db.server";
import { newSessionToken, sha256Hex } from "./crypto.server";

const COOKIE_NAME = "store_session";
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AppRole = "admin" | "user";

export type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
};

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Set SESSION_COOKIE_SECURE=true once the site is served over HTTPS.
    secure: process.env["SESSION_COOKIE_SECURE"] === "true",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  const req = await request();
  await req
    .input("token_hash", sql.Char(64), sha256Hex(token))
    .input("user_id", sql.UniqueIdentifier, userId)
    .input("expires_at", sql.DateTime2(3), expires)
    .query(
      `DELETE FROM dbo.sessions WHERE expires_at < SYSUTCDATETIME();
       INSERT INTO dbo.sessions (token_hash, user_id, expires_at) VALUES (@token_hash, @user_id, @expires_at);`,
    );
  setCookie(COOKIE_NAME, token, cookieOptions(expires));
}

/** Returns the signed-in user, or null. Extends the session when it is past its halfway point. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  const tokenHash = sha256Hex(token);

  const req = await request();
  const { recordset } = await req.input("token_hash", sql.Char(64), tokenHash).query<{
    id: string;
    email: string;
    full_name: string;
    role: AppRole;
    expires_at: Date;
  }>(
    `SELECT u.id, u.email, u.full_name, u.role, s.expires_at
       FROM dbo.sessions s JOIN dbo.users u ON u.id = s.user_id
      WHERE s.token_hash = @token_hash AND s.expires_at > SYSUTCDATETIME()`,
  );
  const row = recordset[0];
  if (!row) return null;

  if (row.expires_at.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
    const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    const renew = await request();
    await renew
      .input("token_hash", sql.Char(64), tokenHash)
      .input("expires_at", sql.DateTime2(3), expires)
      .query(`UPDATE dbo.sessions SET expires_at = @expires_at WHERE token_hash = @token_hash`);
    setCookie(COOKIE_NAME, token, cookieOptions(expires));
  }

  return {
    userId: row.id.toLowerCase(),
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  };
}

export async function destroySession(): Promise<void> {
  const token = getCookie(COOKIE_NAME);
  if (token) {
    const req = await request();
    await req
      .input("token_hash", sql.Char(64), sha256Hex(token))
      .query(`DELETE FROM dbo.sessions WHERE token_hash = @token_hash`);
  }
  deleteCookie(COOKIE_NAME, { path: "/" });
}
