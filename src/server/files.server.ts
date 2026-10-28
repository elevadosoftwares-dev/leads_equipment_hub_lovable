// Uploaded files (pictures, attachments) stored in dbo.files. Server-only.
import { randomUUID } from "node:crypto";

import { request, sql } from "./db.server";

/** Largest file accepted on upload. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Stores a file under `folder/` and returns its path, which rows keep (e.g. image_url). */
export async function saveFile(file: File, folder: string): Promise<string> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error(`Files must be ${MAX_FILE_BYTES / 1024 / 1024} MB or smaller.`);
  // Letters, digits, "-", "_" and "/" only (no dots, so no "..").
  const safeFolder =
    folder
      .replace(/[^\w/-]/g, "")
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "") || "files";
  const path = `${safeFolder}/${randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`.slice(0, 400);
  const req = await request();
  await req
    .input("path", sql.NVarChar(400), path)
    .input("file_name", sql.NVarChar(260), file.name.slice(-260))
    .input("content_type", sql.NVarChar(200), file.type || "application/octet-stream")
    .input("data", sql.VarBinary(sql.MAX), Buffer.from(await file.arrayBuffer()))
    .query(
      `INSERT INTO dbo.files (path, file_name, content_type, data)
       VALUES (@path, @file_name, @content_type, @data)`,
    );
  return path;
}

export async function readFile(path: string) {
  const req = await request();
  const { recordset } = await req.input("path", sql.NVarChar(400), path).query<{
    file_name: string;
    content_type: string;
    data: Buffer;
  }>(`SELECT file_name, content_type, data FROM dbo.files WHERE path = @path`);
  return recordset[0] ?? null;
}

export async function deleteFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const req = await request();
  await req
    .input("path", sql.NVarChar(400), path)
    .query(`DELETE FROM dbo.files WHERE path = @path`);
}
