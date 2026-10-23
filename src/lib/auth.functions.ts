import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AppRole = "admin" | "user";

export interface SessionInfo {
  userId: string | null;
  email: string | null;
  fullName: string;
  role: AppRole | null;
}

/** The signed-in user, or an empty session when nobody is signed in. */
export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionInfo> => {
    const { getSessionUser } = await import("@/server/auth.server");
    const user = await getSessionUser();
    if (!user) return { userId: null, email: null, fullName: "", role: null };
    return { userId: user.userId, email: user.email, fullName: user.fullName, role: user.role };
  },
);

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export const signIn = createServerFn({ method: "POST" })
  .validator((d: unknown) => signInSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { verifyPassword, getDummyHash } = await import("@/server/crypto.server");
    const { createSession } = await import("@/server/auth.server");

    const req = await request();
    const { recordset } = await req
      .input("email", sql.NVarChar(320), data.email)
      .query<{ id: string; password_hash: string }>(
        `SELECT id, password_hash FROM dbo.users WHERE email = @email`,
      );
    const user = recordset[0];
    const ok = await verifyPassword(data.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) throw new Error("Invalid login credentials");

    await createSession(user.id);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("@/server/auth.server");
  await destroySession();
  return { ok: true };
});

/** True when the app has no users yet, so the first admin account can be created. */
export const isSetupRequired = createServerFn({ method: "GET" }).handler(async () => {
  const { request } = await import("@/server/db.server");
  const req = await request();
  const { recordset } = await req.query<{ n: number }>(`SELECT COUNT(*) AS n FROM dbo.users`);
  return { setupRequired: (recordset[0]?.n ?? 0) === 0 };
});

const bootstrapSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(1),
});

/** Creates the very first account and makes it an administrator. Refuses once any user exists. */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");

    const req = await request();
    // The lock hints make the "no users yet" check and the insert atomic.
    const { rowsAffected } = await req
      .input("email", sql.NVarChar(320), data.email)
      .input("full_name", sql.NVarChar(200), data.fullName)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(
        `INSERT INTO dbo.users (email, full_name, password_hash, role)
         SELECT @email, @full_name, @password_hash, N'admin'
          WHERE NOT EXISTS (SELECT 1 FROM dbo.users WITH (UPDLOCK, HOLDLOCK))`,
      );
    if (!rowsAffected[0]) throw new Error("An account already exists. Please sign in instead.");
    return { ok: true };
  });
