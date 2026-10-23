import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";
import type { StoreSnapshot } from "@/lib/types";

// Kept in step with CONDITIONS / FILE_KINDS in src/lib/store.ts (not imported: that module is
// client-side React code).
const CONDITION = z.enum(["Good", "Spoiled", "Quarantined"]);
const FILE_KIND = z.enum(["manual", "software", "file"]);
const EXPIRED_REASON = "Calibration expired";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const id = z.string().uuid("Invalid id");
const optId = z.string().uuid().nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const text = (max: number, label = "Text") => z.string().max(max, `${label} is too long`);
const longText = z.string().max(100_000);

/** Validates input and reports the first problem as a plain message (not a zod JSON dump). */
function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Invalid input");
  return result.data;
}

/** Throws a friendly message for unique-constraint violations. */
async function friendly<T>(work: () => Promise<T>, duplicateMessage: string): Promise<T> {
  const { isDuplicateKeyError } = await import("@/server/db.server");
  try {
    return await work();
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new Error(duplicateMessage);
    throw error;
  }
}

// ── Read everything ─────────────────────────────────────────────────────────────────────

/** The whole (small) inventory in one round trip; the UI caches it under the "store" key. */
export const getStore = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<StoreSnapshot> => {
    const { request, plainRows } = await import("@/server/db.server");
    const req = await request();
    const { recordsets } = await req.query(
      `SELECT * FROM dbo.equipment ORDER BY created_at DESC;
       SELECT * FROM dbo.calibrations ORDER BY calibration_date DESC;
       SELECT * FROM dbo.issuances ORDER BY issuance_date DESC, created_at DESC;
       SELECT * FROM dbo.categories ORDER BY name;
       SELECT * FROM dbo.subcategories ORDER BY name;
       SELECT * FROM dbo.departments ORDER BY name;
       SELECT * FROM dbo.technicians ORDER BY name;
       SELECT * FROM dbo.equipment_sets ORDER BY name;
       SELECT * FROM dbo.equipment_files ORDER BY created_at;`,
    );
    const sets = recordsets as unknown as Parameters<typeof plainRows>[0][];
    const [equipment, calibrations, issuances, categories, subcategories, departments, technicians, equipmentSets, files] = sets.map(
      (rs) => plainRows(rs),
    );
    return {
      equipment, calibrations, issuances, categories, subcategories, departments, technicians,
      sets: equipmentSets, files,
    } as StoreSnapshot;
  });

/** Persists Quarantined for equipment whose latest calibration has expired (see effectiveCondition). */
export const quarantineExpired = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(z.object({ ids: z.array(id).max(10_000) }), d))
  .handler(async ({ data }) => {
    if (!data.ids.length) return { ok: true };
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("ids", sql.NVarChar(sql.MAX), JSON.stringify(data.ids))
      .input("reason", sql.NVarChar(400), EXPIRED_REASON)
      .query(
        `UPDATE dbo.equipment SET condition = N'Quarantined', quarantine_reason = @reason
          WHERE condition <> N'Quarantined'
            AND id IN (SELECT TRY_CONVERT(UNIQUEIDENTIFIER, value) FROM OPENJSON(@ids))`,
      );
    return { ok: true };
  });

// ── Files ───────────────────────────────────────────────────────────────────────────────

/** Stores an uploaded file in SQL Server and returns its id (kept as the record's *_path). */
export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data.");
    const file = d.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES)
      throw new Error(`"${file.name}" is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    return file;
  })
  .handler(async ({ data: file }) => {
    const { request, sql } = await import("@/server/db.server");
    const fileId = crypto.randomUUID();
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, fileId)
      .input("name", sql.NVarChar(400), file.name.slice(0, 400))
      .input("content_type", sql.NVarChar(200), (file.type || "application/octet-stream").slice(0, 200))
      .input("size", sql.BigInt, file.size)
      .input("data", sql.VarBinary(sql.MAX), Buffer.from(await file.arrayBuffer()))
      .query(
        `INSERT INTO dbo.files (id, name, content_type, size, data)
         VALUES (@id, @name, @content_type, @size, @data)`,
      );
    return { id: fileId };
  });

// ── Equipment ───────────────────────────────────────────────────────────────────────────

const equipmentSchema = z.object({
  id: id.optional(),
  category_id: z.string().uuid("Category is required"),
  subcategory_id: optId,
  department_id: optId,
  set_id: optId,
  brand: text(200, "Brand"),
  model: text(200, "Model"),
  serial_no: text(200, "Serial No"),
  store_no: text(200, "Store No"),
  location: text(400, "Location"),
  specification: longText,
  service_details: longText,
  notes: longText,
  condition: CONDITION,
  quarantine_reason: text(400, "Reason for quarantine"),
  photo_path: optId,
  attachments: z
    .array(z.object({ kind: FILE_KIND, name: text(400, "File name"), path: id }))
    .max(200),
});

/** Creates or updates equipment plus any newly attached files, in one transaction. */
export const saveEquipment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(equipmentSchema, d))
  .handler(async ({ data }) => {
    if (data.condition === "Quarantined" && !data.quarantine_reason.trim())
      throw new Error("Enter a reason for quarantine");
    const { request, sql, purgeOrphanFiles } = await import("@/server/db.server");
    const equipmentId = data.id ?? crypto.randomUUID();
    const req = await request();
    req.input("id", sql.UniqueIdentifier, equipmentId);
    for (const key of ["category_id", "subcategory_id", "department_id", "set_id"] as const)
      req.input(key, sql.UniqueIdentifier, data[key]);
    for (const key of ["brand", "model", "serial_no", "store_no", "location", "specification", "service_details", "notes", "condition"] as const)
      req.input(key, sql.NVarChar(sql.MAX), data[key]);
    req.input("quarantine_reason", sql.NVarChar(400), data.condition === "Quarantined" ? data.quarantine_reason : "");
    req.input("photo_path", sql.NVarChar(400), data.photo_path);
    req.input("attachments", sql.NVarChar(sql.MAX), JSON.stringify(data.attachments));

    const write = data.id
      ? `UPDATE dbo.equipment SET
           type = (SELECT name FROM dbo.categories WHERE id = @category_id),
           category_id = @category_id, subcategory_id = @subcategory_id, department_id = @department_id,
           set_id = @set_id, brand = @brand, model = @model, serial_no = @serial_no, store_no = @store_no,
           location = @location, specification = @specification, service_details = @service_details,
           notes = @notes, condition = @condition, quarantine_reason = @quarantine_reason,
           photo_path = @photo_path, updated_at = SYSUTCDATETIME()
         WHERE id = @id;
         IF @@ROWCOUNT = 0 THROW 50001, N'Equipment not found', 1;`
      : `DECLARE @n BIGINT;
         SET @n = NEXT VALUE FOR dbo.equipment_code_seq;
         INSERT INTO dbo.equipment (id, code, type, category_id, subcategory_id, department_id, set_id, brand, model,
           serial_no, store_no, location, specification, service_details, notes, condition, quarantine_reason, photo_path)
         VALUES (@id, N'EQ-' + IIF(@n < 100000, RIGHT(N'0000' + CAST(@n AS NVARCHAR(20)), 5), CAST(@n AS NVARCHAR(20))),
           (SELECT name FROM dbo.categories WHERE id = @category_id), @category_id, @subcategory_id, @department_id,
           @set_id, @brand, @model, @serial_no, @store_no, @location, @specification, @service_details, @notes,
           @condition, @quarantine_reason, @photo_path);`;

    const { recordset } = await req.query<{ id: string; code: string }>(
      `SET XACT_ABORT ON;
       BEGIN TRANSACTION;
         IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE id = @category_id)
           THROW 50001, N'Category is required', 1;
         ${write}
         INSERT INTO dbo.equipment_files (equipment_id, kind, name, path)
         SELECT @id, kind, name, path
           FROM OPENJSON(@attachments) WITH (kind NVARCHAR(20), name NVARCHAR(400), path NVARCHAR(400));
       COMMIT TRANSACTION;
       SELECT LOWER(CONVERT(NVARCHAR(36), id)) AS id, code FROM dbo.equipment WHERE id = @id;`,
    );
    await purgeOrphanFiles();
    const saved = recordset[0];
    if (!saved) throw new Error("Equipment could not be saved.");
    return saved;
  });

/** Only Master Admins may delete equipment; calibrations, issuances and files go with it. */
export const deleteEquipment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((d: unknown) => parse(z.object({ id }), d))
  .handler(async ({ data }) => {
    const { request, sql, purgeOrphanFiles } = await import("@/server/db.server");
    const req = await request();
    await req.input("id", sql.UniqueIdentifier, data.id).query(`DELETE FROM dbo.equipment WHERE id = @id`);
    await purgeOrphanFiles();
    return { ok: true };
  });

export const deleteEquipmentFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(z.object({ id }), d))
  .handler(async ({ data }) => {
    const { request, sql, purgeOrphanFiles } = await import("@/server/db.server");
    const req = await request();
    await req.input("id", sql.UniqueIdentifier, data.id).query(`DELETE FROM dbo.equipment_files WHERE id = @id`);
    await purgeOrphanFiles();
    return { ok: true };
  });

// ── Calibrations ────────────────────────────────────────────────────────────────────────

const calibrationSchema = z.object({
  id: id.optional(),
  equipment_id: z.string().uuid("Select equipment"),
  calibration_date: date,
  expiry_date: date,
  performed_by: text(200, "Performed By"),
  remarks: longText,
  certificate_path: optId,
  certificate_name: text(400, "Certificate name").nullable(),
});

export const saveCalibration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(calibrationSchema, d))
  .handler(async ({ data }) => {
    if (data.expiry_date < data.calibration_date)
      throw new Error("Expiry date must be after calibration date");
    const { request, sql, purgeOrphanFiles } = await import("@/server/db.server");
    const req = await request();
    req
      .input("id", sql.UniqueIdentifier, data.id ?? crypto.randomUUID())
      .input("equipment_id", sql.UniqueIdentifier, data.equipment_id)
      .input("calibration_date", sql.NVarChar(10), data.calibration_date)
      .input("expiry_date", sql.NVarChar(10), data.expiry_date)
      .input("performed_by", sql.NVarChar(200), data.performed_by)
      .input("remarks", sql.NVarChar(sql.MAX), data.remarks)
      .input("certificate_path", sql.NVarChar(400), data.certificate_path)
      .input("certificate_name", sql.NVarChar(400), data.certificate_name);
    await req.query(
      data.id
        ? `UPDATE dbo.calibrations SET equipment_id = @equipment_id,
             calibration_date = CAST(@calibration_date AS DATE), expiry_date = CAST(@expiry_date AS DATE),
             performed_by = @performed_by, remarks = @remarks,
             certificate_path = @certificate_path, certificate_name = @certificate_name
           WHERE id = @id`
        : `INSERT INTO dbo.calibrations (id, equipment_id, calibration_date, expiry_date, performed_by, remarks,
             certificate_path, certificate_name)
           VALUES (@id, @equipment_id, CAST(@calibration_date AS DATE), CAST(@expiry_date AS DATE), @performed_by,
             @remarks, @certificate_path, @certificate_name)`,
    );
    await purgeOrphanFiles();
    return { ok: true };
  });

export const deleteCalibration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(z.object({ id }), d))
  .handler(async ({ data }) => {
    const { request, sql, purgeOrphanFiles } = await import("@/server/db.server");
    const req = await request();
    await req.input("id", sql.UniqueIdentifier, data.id).query(`DELETE FROM dbo.calibrations WHERE id = @id`);
    await purgeOrphanFiles();
    return { ok: true };
  });

// ── Issuance ────────────────────────────────────────────────────────────────────────────

const issueSchema = z.object({
  equipment_ids: z.array(id).min(1, "Select equipment").max(1000),
  technician_id: z.string().uuid("Select a technician"),
  issuance_date: date,
  expected_return_date: date.nullable(),
  job_no: text(100, "Job No").trim().min(1, "Job No is required"),
  job_description: longText.trim().min(1, "Job Description is required"),
  job_location: text(400, "Job Location"),
  purpose: text(400, "Purpose"),
  notes: longText,
});

/** Issues one item or a whole set under a single new report number. */
export const createIssuance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(issueSchema, d))
  .handler(async ({ data }) => {
    if (data.expected_return_date && data.expected_return_date < data.issuance_date)
      throw new Error("Expected return date must be after issuance date");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req
      .input("ids", sql.NVarChar(sql.MAX), JSON.stringify([...new Set(data.equipment_ids)]))
      .input("technician_id", sql.UniqueIdentifier, data.technician_id)
      .input("issuance_date", sql.NVarChar(10), data.issuance_date)
      .input("expected_return_date", sql.NVarChar(10), data.expected_return_date)
      .input("job_no", sql.NVarChar(100), data.job_no)
      .input("job_description", sql.NVarChar(sql.MAX), data.job_description)
      .input("job_location", sql.NVarChar(400), data.job_location)
      .input("purpose", sql.NVarChar(400), data.purpose)
      .input("notes", sql.NVarChar(sql.MAX), data.notes)
      .query<{ report_no: string }>(
        `SET XACT_ABORT ON;
         BEGIN TRANSACTION;
           DECLARE @items TABLE (id UNIQUEIDENTIFIER PRIMARY KEY);
           INSERT INTO @items (id) SELECT DISTINCT TRY_CONVERT(UNIQUEIDENTIFIER, value) FROM OPENJSON(@ids);
           IF (SELECT COUNT(*) FROM dbo.equipment WITH (UPDLOCK, HOLDLOCK) WHERE id IN (SELECT id FROM @items))
              <> (SELECT COUNT(*) FROM @items)
             THROW 50001, N'Some equipment no longer exists', 1;
           IF EXISTS (SELECT 1 FROM dbo.equipment WHERE id IN (SELECT id FROM @items)
                       AND (status = N'issued' OR condition = N'Quarantined'))
             THROW 50001, N'Some equipment is issued or quarantined and cannot be issued', 1;
           IF NOT EXISTS (SELECT 1 FROM dbo.technicians WHERE id = @technician_id)
             THROW 50001, N'Select a technician', 1;

           DECLARE @n BIGINT;
           SET @n = NEXT VALUE FOR dbo.issuance_report_seq;
           DECLARE @report NVARCHAR(20) =
             N'IR-' + IIF(@n < 100000, RIGHT(N'0000' + CAST(@n AS NVARCHAR(20)), 5), CAST(@n AS NVARCHAR(20)));

           INSERT INTO dbo.issuances (equipment_id, technician_id, report_no, issued_to, department, purpose,
             job_no, job_description, job_location, issuance_date, expected_return_date, notes)
           SELECT i.id, t.id, @report, t.name, ISNULL(d.name, N''), @purpose,
             @job_no, @job_description, @job_location, CAST(@issuance_date AS DATE),
             CAST(@expected_return_date AS DATE), @notes
             FROM @items i
             CROSS JOIN dbo.technicians t
             LEFT JOIN dbo.departments d ON d.id = t.department_id
            WHERE t.id = @technician_id;

           UPDATE dbo.equipment SET status = N'issued', updated_at = SYSUTCDATETIME()
            WHERE id IN (SELECT id FROM @items);
         COMMIT TRANSACTION;
         SELECT @report AS report_no;`,
      );
    const reportNo = recordset[0]?.report_no;
    if (!reportNo) throw new Error("Issuance could not be saved.");
    return { reportNo };
  });

const returnSchema = z.object({
  id,
  return_date: date,
  condition: CONDITION,
  reason: text(400, "Reason for quarantine"),
  notes: longText,
});

/** Records the return, marks it reconciled by the signed-in user and frees the equipment. */
export const returnIssuance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(returnSchema, d))
  .handler(async ({ data, context }) => {
    if (data.condition === "Quarantined" && !data.reason.trim())
      throw new Error("Enter a reason for quarantine");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.id)
      .input("return_date", sql.NVarChar(10), data.return_date)
      .input("condition", sql.NVarChar(20), data.condition)
      .input("reason", sql.NVarChar(400), data.condition === "Quarantined" ? data.reason : "")
      .input("notes", sql.NVarChar(sql.MAX), data.notes)
      .input("by", sql.NVarChar(320), context.user.email)
      .query(
        `SET XACT_ABORT ON;
         BEGIN TRANSACTION;
           DECLARE @equipment_id UNIQUEIDENTIFIER, @issued DATE, @returned DATE;
           SELECT @equipment_id = equipment_id, @issued = issuance_date, @returned = return_date
             FROM dbo.issuances WITH (UPDLOCK) WHERE id = @id;
           IF @equipment_id IS NULL THROW 50001, N'Issuance not found', 1;
           IF @returned IS NOT NULL THROW 50001, N'This equipment has already been returned', 1;
           IF CAST(@return_date AS DATE) < @issued THROW 50001, N'Return date cannot be before issuance date', 1;

           UPDATE dbo.issuances SET return_date = CAST(@return_date AS DATE), return_condition = @condition,
             return_notes = @notes, reconciled = 1, reconciled_by = @by
            WHERE id = @id;
           UPDATE dbo.equipment SET status = N'available', condition = @condition,
             quarantine_reason = @reason, updated_at = SYSUTCDATETIME()
            WHERE id = @equipment_id;
         COMMIT TRANSACTION;`,
      );
    return { ok: true };
  });

// ── Master data and sets ────────────────────────────────────────────────────────────────

const name = text(200, "Name").trim().min(1, "Name is required");
const masterSchema = z.discriminatedUnion("table", [
  z.object({ table: z.literal("categories"), id: id.optional(), values: z.object({ name }) }),
  z.object({
    table: z.literal("subcategories"),
    id: id.optional(),
    values: z.object({ name, category_id: z.string().uuid("Select a category") }),
  }),
  z.object({ table: z.literal("departments"), id: id.optional(), values: z.object({ name }) }),
  z.object({
    table: z.literal("technicians"),
    id: id.optional(),
    values: z.object({
      name,
      employee_no: text(100, "Employee No").trim(),
      department_id: optId,
      phone: text(100, "Phone").trim(),
    }),
  }),
  z.object({
    table: z.literal("equipment_sets"),
    id: id.optional(),
    values: z.object({ name, notes: longText }),
  }),
]);
export type MasterTable = z.infer<typeof masterSchema>["table"];

/** Adds (no id) or updates a master-data row. Column names come from the schemas above only. */
export const saveMaster = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(masterSchema, d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    const values = data.values as Record<string, string | null>;
    const columns = Object.keys(values);
    for (const col of columns)
      req.input(col, col.endsWith("_id") ? sql.UniqueIdentifier : sql.NVarChar(sql.MAX), values[col]);
    req.input("id", sql.UniqueIdentifier, data.id ?? crypto.randomUUID());
    const statement = data.id
      ? `UPDATE dbo.${data.table} SET ${columns.map((c) => `${c} = @${c}`).join(", ")} WHERE id = @id`
      : `INSERT INTO dbo.${data.table} (id, ${columns.join(", ")}) VALUES (@id, ${columns.map((c) => `@${c}`).join(", ")})`;
    await friendly(() => req.query(statement), "Already exists");
    return { ok: true };
  });

// What to clear before deleting each kind of master row (the FKs use NO ACTION; see schema.sql).
const clearReferences: Record<MasterTable, string> = {
  categories: `UPDATE dbo.equipment SET category_id = NULL, subcategory_id = NULL
                WHERE category_id = @id
                   OR subcategory_id IN (SELECT id FROM dbo.subcategories WHERE category_id = @id);
               DELETE FROM dbo.subcategories WHERE category_id = @id;`,
  subcategories: `UPDATE dbo.equipment SET subcategory_id = NULL WHERE subcategory_id = @id;`,
  departments: `UPDATE dbo.equipment SET department_id = NULL WHERE department_id = @id;
                UPDATE dbo.technicians SET department_id = NULL WHERE department_id = @id;`,
  technicians: `UPDATE dbo.issuances SET technician_id = NULL WHERE technician_id = @id;`,
  equipment_sets: `UPDATE dbo.equipment SET set_id = NULL WHERE set_id = @id;`,
};

export const deleteMaster = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    parse(
      z.object({
        table: z.enum(["categories", "subcategories", "departments", "technicians", "equipment_sets"]),
        id,
      }),
      d,
    ),
  )
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req.input("id", sql.UniqueIdentifier, data.id).query(
      `SET XACT_ABORT ON;
       BEGIN TRANSACTION;
         ${clearReferences[data.table]}
         DELETE FROM dbo.${data.table} WHERE id = @id;
       COMMIT TRANSACTION;`,
    );
    return { ok: true };
  });

/** Puts equipment into a set, or takes it out (setId null). */
export const assignSet = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => parse(z.object({ equipmentId: id, setId: optId }), d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.equipmentId)
      .input("set_id", sql.UniqueIdentifier, data.setId)
      .query(`UPDATE dbo.equipment SET set_id = @set_id, updated_at = SYSUTCDATETIME() WHERE id = @id`);
    return { ok: true };
  });
