import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { getSession } from "@/lib/auth.functions";
import {
  EXPIRED_REASON,
  loadStore,
  uploadFile as uploadFileFn,
  type Calibration,
  type Equipment,
} from "@/lib/store.functions";

export type {
  Calibration,
  Category,
  Department,
  Equipment,
  EquipmentFile,
  EquipmentSet,
  Issuance,
  Subcategory,
  Technician,
} from "@/lib/store.functions";
export { EXPIRED_REASON };

export type EquipStatus = "available" | "issued" | "calibration_due" | "quarantined";

export const DUE_WINDOW_DAYS = 30;
export const CONDITIONS = ["Good", "Spoiled", "Quarantined"] as const;
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
export function effectiveCondition(
  eq: Pick<Equipment, "id" | "condition" | "quarantine_reason">,
  cals: Calibration[],
  today = new Date(),
) {
  if (calibrationState(latestCalibration(cals, eq.id)?.expiry_date, today) === "expired")
    return { condition: "Quarantined", reason: EXPIRED_REASON };
  return {
    condition: eq.condition,
    reason: eq.condition === "Quarantined" ? eq.quarantine_reason : "",
  };
}

export function equipmentStatus(
  eq: Equipment,
  cals: Calibration[],
  today = new Date(),
): EquipStatus {
  if (effectiveCondition(eq, cals, today).condition === "Quarantined") return "quarantined";
  if (eq.status === "issued") return "issued";
  if (calibrationState(latestCalibration(cals, eq.id)?.expiry_date, today) === "due")
    return "calibration_due";
  return "available";
}

export function useStore() {
  return useQuery({
    queryKey: ["store"],
    // The server also persists quarantine for expired calibrations so the record itself reflects it.
    queryFn: () => loadStore(),
  });
}
export type StoreData = NonNullable<ReturnType<typeof useStore>["data"]>;

export function lookups(d?: StoreData) {
  const name = <T extends { id: string; name: string }>(rows: T[] | undefined) => {
    const m = new Map((rows ?? []).map((r) => [r.id, r.name]));
    return (id?: string | null) => (id ? (m.get(id) ?? "") : "");
  };
  return {
    cat: name(d?.categories),
    sub: name(d?.subcategories),
    dept: name(d?.departments),
    set: name(d?.sets),
    tech: name(d?.technicians),
  };
}

export const sessionQuery = { queryKey: ["session"], queryFn: () => getSession() };

export function useSession() {
  return useQuery(sessionQuery);
}

export function useIsAdmin() {
  return useSession().data?.role === "admin";
}

/** Uploads a photo/certificate/document and returns its path, which the row stores. */
export async function uploadFile(file: File, folder: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  const { path } = await uploadFileFn({ data: form });
  return path;
}

/** Address of an uploaded file (served to signed-in staff by src/routes/api/files/$.ts). */
export function fileUrl(path: string) {
  return `/api/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function useSignedUrl(path?: string | null) {
  return path ? fileUrl(path) : null;
}

export async function openFile(path: string) {
  window.open(fileUrl(path), "_blank", "noopener");
}
