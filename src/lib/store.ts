import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { getStore, quarantineExpired, uploadFile as uploadFileFn } from "@/lib/store.functions";
import { useSession } from "@/lib/session";
import type { Calibration, Equipment } from "@/lib/types";

export type {
  Calibration, Category, Department, Equipment, EquipmentFile, EquipmentSet, Issuance, Subcategory, Technician,
} from "@/lib/types";

export type EquipStatus = "available" | "issued" | "calibration_due" | "quarantined";

export const DUE_WINDOW_DAYS = 30;
export const CONDITIONS = ["Good", "Spoiled", "Quarantined"] as const;
export const EXPIRED_REASON = "Calibration expired";
export const HISTORY_LIMIT = 3;
export const FILE_KINDS = [
  { kind: "manual", label: "Equipment Manual" },
  { kind: "software", label: "Equipment Software" },
  { kind: "file", label: "Equipment Files" },
] as const;

export function fmt(d?: string | null) {
  if (!d) return "—";
  return format(parseISO(d), "dd MMM yyyy");
}

export function daysSince(d: string, until?: string | null, today = new Date()) {
  return differenceInCalendarDays(until ? parseISO(until) : today, parseISO(d));
}

export function calibrationState(expiry: string | null | undefined, today = new Date()) {
  if (!expiry) return "none" as const;
  const days = differenceInCalendarDays(parseISO(expiry), today);
  if (days < 0) return "expired" as const;
  if (days <= DUE_WINDOW_DAYS) return "due" as const;
  return "ok" as const;
}

export function latestCalibration(cals: Calibration[], equipmentId: string) {
  return cals
    .filter((c) => c.equipment_id === equipmentId)
    .sort((a, b) => b.expiry_date.localeCompare(a.expiry_date))[0];
}

/** Condition shown to staff: expired calibration always forces Quarantined. */
export function effectiveCondition(eq: Pick<Equipment, "id" | "condition" | "quarantine_reason">, cals: Calibration[], today = new Date()) {
  if (calibrationState(latestCalibration(cals, eq.id)?.expiry_date, today) === "expired")
    return { condition: "Quarantined", reason: EXPIRED_REASON };
  return { condition: eq.condition, reason: eq.condition === "Quarantined" ? eq.quarantine_reason : "" };
}

export function equipmentStatus(eq: Equipment, cals: Calibration[], today = new Date()): EquipStatus {
  if (effectiveCondition(eq, cals, today).condition === "Quarantined") return "quarantined";
  if (eq.status === "issued") return "issued";
  if (calibrationState(latestCalibration(cals, eq.id)?.expiry_date, today) === "due") return "calibration_due";
  return "available";
}

export function useStore() {
  return useQuery({
    queryKey: ["store"],
    queryFn: async () => {
      const data = await getStore();
      // Persist quarantine for expired calibrations so the record itself reflects it.
      const toQuarantine = data.equipment.filter((x) => x.condition !== "Quarantined" && effectiveCondition(x, data.calibrations).condition === "Quarantined");
      if (toQuarantine.length) {
        await quarantineExpired({ data: { ids: toQuarantine.map((x) => x.id) } });
        toQuarantine.forEach((x) => { x.condition = "Quarantined"; x.quarantine_reason = EXPIRED_REASON; });
      }
      return data;
    },
  });
}
export type StoreData = NonNullable<ReturnType<typeof useStore>["data"]>;

export function lookups(d?: StoreData) {
  const name = <T extends { id: string; name: string }>(rows: T[] | undefined) => {
    const m = new Map((rows ?? []).map((r) => [r.id, r.name]));
    return (id?: string | null) => (id ? m.get(id) ?? "" : "");
  };
  return { cat: name(d?.categories), sub: name(d?.subcategories), dept: name(d?.departments), set: name(d?.sets), tech: name(d?.technicians) };
}

export function useIsAdmin() {
  return useSession().data?.role === "admin";
}

/** Uploads a file to SQL Server and returns its id, which records keep as their *_path. */
export async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { id } = await uploadFileFn({ data: form });
  return id;
}

export function fileUrl(path: string) {
  return `/api/files/${encodeURIComponent(path)}`;
}

/** Files are served to signed-in staff by /api/files; kept as a hook so callers stay unchanged. */
export function useSignedUrl(path?: string | null) {
  return path ? fileUrl(path) : null;
}

export function openFile(path: string) {
  window.open(fileUrl(path), "_blank", "noopener");
}
