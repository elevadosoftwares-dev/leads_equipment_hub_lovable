import { describe, expect, it } from "vitest";
import { calibrationState, daysSince, effectiveCondition, equipmentStatus, type Calibration, type Equipment } from "@/lib/store";

const today = new Date("2026-01-01T12:00:00");

describe("calibration status", () => {
  it("expired when expiry is in the past", () => expect(calibrationState("2025-12-31", today)).toBe("expired"));
  it("due soon within 30 days", () => expect(calibrationState("2026-01-31", today)).toBe("due"));
  it("ok beyond 30 days", () => expect(calibrationState("2026-02-01", today)).toBe("ok"));
});

const eq = { id: "e1", condition: "Good", quarantine_reason: "", status: "available" } as Equipment;
const cal = (expiry_date: string) => [{ equipment_id: "e1", expiry_date } as Calibration];

describe("quarantine", () => {
  it("expired calibration forces Quarantined with reason Calibration expired", () =>
    expect(effectiveCondition(eq, cal("2025-12-01"), today)).toEqual({ condition: "Quarantined", reason: "Calibration expired" }));
  it("expired calibration shows quarantined status", () => expect(equipmentStatus(eq, cal("2025-12-01"), today)).toBe("quarantined"));
  it("valid calibration keeps Good", () => expect(effectiveCondition(eq, cal("2026-06-01"), today).condition).toBe("Good"));
});

describe("days since issued", () => {
  it("counts days until today when not returned", () => expect(daysSince("2025-12-22", null, today)).toBe(10));
  it("counts days until return date when returned", () => expect(daysSince("2025-12-22", "2025-12-25", today)).toBe(3));
});
