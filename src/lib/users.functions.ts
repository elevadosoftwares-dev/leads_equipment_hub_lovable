import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import type { AppRole } from "@/lib/auth.functions";

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<StaffUser[]> => {
    const { request, plainRows } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query(
      `SELECT id, email, full_name, role FROM dbo.users ORDER BY email`,
    );
    return plainRows<StaffUser>(recordset);
  });

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  fullName: z.string().trim().min(1),
  role: z.enum(["admin", "user"]),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    try {
      await req
        .input("email", sql.NVarChar(320), data.email)
        .input("full_name", sql.NVarChar(200), data.fullName)
        .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
        .input("role", sql.NVarChar(10), data.role)
        .query(
          `INSERT INTO dbo.users (email, full_name, password_hash, role)
           VALUES (@email, @full_name, @password_hash, @role)`,
        );
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new Error("A user with this email address has already been registered");
      throw error;
    }
    return { ok: true };
  });

const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(["admin", "user"]) });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: unknown) => roleSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    // Demoting is refused when it would leave no administrator; the lock hints make the
    // admin count and the update atomic.
    const { rowsAffected } = await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("role", sql.NVarChar(10), data.role)
      .query(
        `UPDATE dbo.users SET role = @role
          WHERE id = @id
            AND (@role = N'admin'
                 OR role <> N'admin'
                 OR (SELECT COUNT(*) FROM dbo.users WITH (UPDLOCK, HOLDLOCK) WHERE role = N'admin') > 1)`,
      );
    if (!rowsAffected[0]) throw new Error("There must be at least one administrator.");
    return { ok: true };
  });

const passwordSchema = z.object({ userId: z.string().uuid(), password: z.string().min(8) });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: unknown) => passwordSchema.parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    // Signs the user out everywhere so the old password stops working immediately.
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(
        `UPDATE dbo.users SET password_hash = @password_hash WHERE id = @id;
         DELETE FROM dbo.sessions WHERE user_id = @id;`,
      );
    return { ok: true };
  });

const deleteSchema = z.object({ userId: z.string().uuid() });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You cannot remove your own account.");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    // Sessions go with the user (ON DELETE CASCADE); issuance history keeps the email as text.
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .query(`DELETE FROM dbo.users WHERE id = @id`);
    return { ok: true };
  });
