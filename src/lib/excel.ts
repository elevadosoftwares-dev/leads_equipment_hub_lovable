import { format } from "date-fns";

/** Export rows to an .xlsx file and download it. Loaded lazily so the library stays out of SSR. */
export async function exportExcel(
  name: string,
  rows: Record<string, string | number | null | undefined>[],
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "No records" }]);
  const keys = Object.keys(rows[0] ?? { Info: "" });
  ws["!cols"] = keys.map((k) => ({
    wch: Math.min(50, Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  XLSX.writeFile(wb, `${name.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}
