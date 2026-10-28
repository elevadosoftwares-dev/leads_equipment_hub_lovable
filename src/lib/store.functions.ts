import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";

export type Equipment = {
  id: string;
  code: string;
  type: string;
  brand: string;
  model: string;
  serial_no: string;
  photo_path: string | null;
  specification: string;
  location: string;
  service_details: string;
  notes: string;
  status: string;
  category_id: string | null;
  subcategory_id: string | null;
  department_id: string | null;
  store_no: string;
  condition: string;
  quarantine_reason: string;
  set_id: string | null;
  created_at: string;
  updated_at: string;
};
export type Calibration = {
  id: string;
  equipment_id: string;
  calibration_date: string;
  expiry_date: string;
  certificate_path: string | null;
  certificate_name: string | null;
  performed_by: string;
  remarks: string;
  created_at: string;
};
export type Issuance = {
  id: string;
  equipment_id: string;
  issued_to: string;
  department: string;
  purpose: string;
  issuance_date: string;
  expected_return_date: string | null;
  return_date: string | null;
  return_condition: string | null;
  notes: string;
  return_notes: string;
  technician_id: string | null;
  report_no: string;
  job_no: string;
  job_description: string;
  job_location: string;
  reconciled: boolean;
  reconciled_by: string;
  created_at: string;
};
export type Category = { id: string; name: string; created_at: string };
export type Subcategory = { id: string; category_id: string; name: string; created_at: string };
export type Department = { id: string; name: string; created_at: string };
export type Technician = {
  id: string;
  name: string;
  employee_no: string;
  department_id: string | null;
  phone: string;
  created_at: string;
};
export type EquipmentSet = { id: string; name: string; notes: string; created_at: string };
export type EquipmentFile = {
  id: string;
  equipment_id: string;
  kind: string;
  path: string;
  name: string;
  created_at: string;
};

export const EXPIRED_REASON = "Calibration expired";

const EQUIPMENT_COLUMNS = `id, code, type, brand, model, serial_no, photo_path, specification, location,
  service_details, notes, status, category_id, subcategory_id, department_id, store_no, condition,
  quarantine_reason, set_id, created_at, updated_at`;

/** Everything the store screens show, loaded in one round trip. */
export const loadStore = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson, execute } = await import("@/server/rows.server");
    // Persist quarantine for equipment whose latest calibration has expired, so the record
    // itself reflects it.
    await execute(
      `UPDATE e SET condition = N'Quarantined', quarantine_reason = @reason
         FROM dbo.equipment e
        WHERE e.condition <> N'Quarantined'
          AND (SELECT MAX(c.expiry_date) FROM dbo.calibrations c WHERE c.equipment_id = e.id)
              < CAST(GETDATE() AS DATE)`,
      { reason: EXPIRED_REASON },
    );
    const [
      equipment,
      calibrations,
      issuances,
      categories,
      subcategories,
      departments,
      technicians,
      sets,
      files,
    ] = await Promise.all([
      selectJson<Equipment>(
        `SELECT ${EQUIPMENT_COLUMNS} FROM dbo.equipment ORDER BY created_at DESC`,
      ),
      selectJson<Calibration>(
        `SELECT id, equipment_id, calibration_date, expiry_date, certificate_path, certificate_name,
                  performed_by, remarks, created_at
             FROM dbo.calibrations ORDER BY calibration_date DESC`,
      ),
      selectJson<Issuance>(
        `SELECT id, equipment_id, issued_to, department, purpose, issuance_date, expected_return_date,
                  return_date, return_condition, notes, return_notes, technician_id, report_no, job_no,
                  job_description, job_location, reconciled, reconciled_by, created_at
             FROM dbo.issuances ORDER BY issuance_date DESC, created_at DESC`,
      ),
      selectJson<Category>(`SELECT id, name, created_at FROM dbo.categories ORDER BY name`),
      selectJson<Subcategory>(
        `SELECT id, category_id, name, created_at FROM dbo.subcategories ORDER BY name`,
      ),
      selectJson<Department>(`SELECT id, name, created_at FROM dbo.departments ORDER BY name`),
      selectJson<Technician>(
        `SELECT id, name, employee_no, department_id, phone, created_at FROM dbo.technicians ORDER BY name`,
      ),
      selectJson<EquipmentSet>(
        `SELECT id, name, notes, created_at FROM dbo.equipment_sets ORDER BY name`,
      ),
      selectJson<EquipmentFile>(
        `SELECT id, equipment_id, kind, path, name, created_at FROM dbo.equipment_files ORDER BY created_at`,
      ),
    ]);
    return {
      equipment,
      calibrations,
      issuances,
      categories,
      subcategories,
      departments,
      technicians,
      sets,
      files,
    };
  });

// ------------------------------------------------------------------ generic saves

const id = z.string().uuid();
const optionalId = z
  .string()
  .uuid()
  .nullish()
  .or(z.literal(""))
  .transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const optionalDate = date
  .nullish()
  .or(z.literal(""))
  .transform((v) => v || null);
const text = (max = 100_000) => z.string().max(max);
const filePath = z
  .string()
  .max(400)
  .nullish()
  .transform((v) => v || null);

/** The tables staff may write through saveRow/deleteRow, and the columns each one accepts. */
const writable = {
  categories: z.object({ name: text(200).trim().min(1, "Name is required") }),
  subcategories: z.object({ category_id: id, name: text(200).trim().min(1, "Name is required") }),
  departments: z.object({ name: text(200).trim().min(1, "Name is required") }),
  technicians: z.object({
    name: text(200).trim().min(1, "Name is required"),
    employee_no: text(100).optional(),
    department_id: optionalId.optional(),
    phone: text(100).optional(),
  }),
  equipment_sets: z.object({
    name: text(200).trim().min(1, "Set name is required"),
    notes: text().optional(),
  }),
  calibrations: z.object({
    equipment_id: id,
    calibration_date: date,
    expiry_date: date,
    performed_by: text(200),
    remarks: text(),
    certificate_path: filePath,
    certificate_name: text(260)
      .nullish()
      .transform((v) => v || null),
  }),
  equipment_files: z.object({
    equipment_id: id,
    kind: z.enum(["manual", "software", "file"]),
    name: text(260),
    path: text(400),
  }),
  // Equipment edits from the Sets page (assigning a set).
  equipment: z.object({ set_id: optionalId }),
} as const;
type WritableTable = keyof typeof writable;

const saveSchema = z
  .object({
    table: z.enum(Object.keys(writable) as [WritableTable, ...WritableTable[]]),
    id: id.optional(),
    row: z.record(z.string(), z.unknown()),
  })
  .transform((d, ctx) => {
    const schema = d.id ? writable[d.table].partial() : writable[d.table];
    const parsed = schema.safeParse(d.row);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      });
      return z.NEVER;
    }
    return { table: d.table, id: d.id, row: parsed.data as Record<string, unknown> };
  });

/** Inserts (no id) or updates (with id) one row of a master/staff table. */
export const saveRow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }) => {
    const { insertRow, updateRow } = await import("@/server/rows.server");
    const { isDuplicateKeyError } = await import("@/server/db.server");
    if (data.table === "equipment" && !data.id)
      throw new Error("Use the equipment form to add equipment.");
    try {
      if (data.id) {
        const extra = data.table === "equipment" ? "updated_at = SYSUTCDATETIME()" : "";
        await updateRow(data.table, data.id, data.row, extra);
        return { id: data.id };
      }
      return { id: await insertRow(data.table, data.row) };
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error("Already exists");
      throw error;
    }
  });

/** Deletes one row. Deleting equipment is for Master Admins only. */
export const deleteRow = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        table: z.enum([...(Object.keys(writable) as WritableTable[])] as [
          WritableTable,
          ...WritableTable[],
        ]),
        id,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.table === "equipment" && context.user.role !== "admin")
      throw new Error("Only Master Admins can delete equipment.");
    const { execute } = await import("@/server/rows.server");
    // equipment.subcategory_id has no ON DELETE action (SQL Server allows one cascade path),
    // so clear it here, as the original schema did with ON DELETE SET NULL.
    const clearSubcategory =
      {
        subcategories: `UPDATE dbo.equipment SET subcategory_id = NULL WHERE subcategory_id = @id;`,
        categories: `UPDATE dbo.equipment SET subcategory_id = NULL
                    WHERE subcategory_id IN (SELECT id FROM dbo.subcategories WHERE category_id = @id);`,
      }[data.table as string] ?? "";
    await execute(
      `SET XACT_ABORT ON;
       BEGIN TRANSACTION;
         ${clearSubcategory}
         DELETE FROM dbo.${data.table} WHERE id = @id;
       COMMIT TRANSACTION;`,
      { id: data.id },
    );
    return { ok: true };
  });

// ------------------------------------------------------------------ equipment, issuing, returns

const equipmentSchema = z.object({
  id: id.optional(),
  type: text(200),
  category_id: id,
  subcategory_id: optionalId,
  department_id: optionalId,
  set_id: optionalId,
  brand: text(200),
  model: text(200),
  serial_no: text(200),
  store_no: text(100),
  specification: text(),
  location: text(300),
  service_details: text(),
  notes: text(),
  condition: z.enum(["Good", "Spoiled", "Quarantined"]),
  quarantine_reason: text(),
  photo_path: filePath,
});

/** Registers or updates equipment and returns the saved row (with its generated code). */
export const saveEquipment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => equipmentSchema.parse(d))
  .handler(async ({ data: { id, ...row } }) => {
    const { insertRow, updateRow, selectOneJson } = await import("@/server/rows.server");
    let savedId = id;
    if (id) await updateRow("equipment", id, row, "updated_at = SYSUTCDATETIME()");
    else savedId = await insertRow("equipment", row);
    const saved = await selectOneJson<Equipment>(
      `SELECT ${EQUIPMENT_COLUMNS} FROM dbo.equipment WHERE id = @id`,
      { id: savedId },
    );
    if (!saved) throw new Error("This record no longer exists.");
    return saved;
  });

const issueSchema = z.object({
  equipment_ids: z.array(id).min(1, "Select equipment"),
  issued_to: text(200).min(1),
  technician_id: optionalId,
  department: text(200),
  issuance_date: date,
  expected_return_date: optionalDate,
  job_no: text(200),
  job_description: text(),
  job_location: text(300),
  purpose: text(),
  notes: text(),
});

/** Issues one or more items on a single issuance report and marks them issued. */
export const issueEquipment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => issueSchema.parse(d))
  .handler(async ({ data: { equipment_ids, ...base } }) => {
    const { getPool, sql } = await import("@/server/db.server");
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const { recordset } = await new sql.Request(tx).query<{ report_no: string }>(
        `SELECT N'IR-' + RIGHT(N'00000' + CAST(NEXT VALUE FOR dbo.issuance_report_seq AS NVARCHAR(20)), 5) AS report_no`,
      );
      const reportNo = recordset[0]!.report_no;
      for (const equipmentId of equipment_ids) {
        const req = new sql.Request(tx);
        for (const [name, value] of Object.entries(base)) req.input(name, value);
        const { rowsAffected } = await req
          .input("equipment_id", sql.UniqueIdentifier, equipmentId)
          .input("report_no", sql.NVarChar(20), reportNo)
          .query(
            `UPDATE dbo.equipment SET status = N'issued', updated_at = SYSUTCDATETIME()
              WHERE id = @equipment_id AND status <> N'issued';
             INSERT INTO dbo.issuances
               (equipment_id, report_no, ${Object.keys(base).join(", ")})
             SELECT @equipment_id, @report_no, ${Object.keys(base)
               .map((k) => `@${k}`)
               .join(", ")}
              WHERE @@ROWCOUNT = 1;`,
          );
        if (!rowsAffected[1])
          throw new Error("Some equipment is already issued and cannot be issued");
      }
      await tx.commit();
      return { reportNo };
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
  });

const returnSchema = z.object({
  issuance_id: id,
  return_date: date,
  return_condition: z.enum(["Good", "Spoiled", "Quarantined"]),
  return_notes: text(),
  quarantine_reason: text(),
});

/** Records the return of an issued item and puts it back in the store with its condition. */
export const returnEquipment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => returnSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { execute } = await import("@/server/rows.server");
    const { rowsAffected } = await execute(
      `SET XACT_ABORT ON;
       BEGIN TRANSACTION;
         UPDATE dbo.issuances
            SET return_date = @return_date, return_condition = @return_condition,
                return_notes = @return_notes, reconciled = 1, reconciled_by = @reconciled_by
          WHERE id = @issuance_id;
         UPDATE e SET status = N'available', condition = @return_condition,
                      quarantine_reason = CASE WHEN @return_condition = N'Quarantined' THEN @quarantine_reason ELSE N'' END,
                      updated_at = SYSUTCDATETIME()
           FROM dbo.equipment e JOIN dbo.issuances i ON i.equipment_id = e.id
          WHERE i.id = @issuance_id;
       COMMIT TRANSACTION;`,
      { ...data, reconciled_by: context.user.email },
    );
    if (!rowsAffected.some(Boolean)) throw new Error("This record no longer exists.");
    return { ok: true };
  });

/** Stores an uploaded photo/certificate/document and returns the path to save on the row. */
export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data.");
    const file = d.get("file");
    const folder = d.get("folder");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
    return { file, folder: typeof folder === "string" ? folder : "files" };
  })
  .handler(async ({ data }) => {
    const { saveFile } = await import("@/server/files.server");
    return { path: await saveFile(data.file, data.folder) };
  });

// ------------------------------------------------------------------ Master Admins

export type StaffUser = { id: string; email: string; isAdmin: boolean };

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { selectJson } = await import("@/server/rows.server");
    const users = await selectJson<{ id: string; email: string; role: string }>(
      `SELECT id, email, role FROM dbo.users ORDER BY email`,
    );
    return {
      users: users.map((u) => ({ id: u.id, email: u.email, isAdmin: u.role === "admin" })),
      me: context.user.userId,
    };
  });

export const setMasterAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ userId: id, admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You cannot change your own role.");
    const { updateRow } = await import("@/server/rows.server");
    await updateRow("users", data.userId, { role: data.admin ? "admin" : "user" });
    return { ok: true };
  });
