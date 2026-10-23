import { daysSince, effectiveCondition, equipmentStatus, fmt, latestCalibration, lookups, type Equipment, type Issuance, type StoreData } from "./store";

const label = (s: string) => s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase());

export function equipmentRows(list: Equipment[], d: StoreData) {
  const L = lookups(d);
  return list.map((e) => {
    const lc = latestCalibration(d.calibrations, e.id);
    const c = effectiveCondition(e, d.calibrations);
    return {
      ID: e.code, Category: L.cat(e.category_id) || e.type, "Sub Category": L.sub(e.subcategory_id), Brand: e.brand, Model: e.model,
      "Serial No": e.serial_no, "Leads Store No": e.store_no, Department: L.dept(e.department_id), Location: e.location,
      "Equipment Set": L.set(e.set_id), Condition: c.condition, "Quarantine Reason": c.reason,
      Status: label(equipmentStatus(e, d.calibrations)), "Last Calibration": fmt(lc?.calibration_date), "Calibration Expiry": fmt(lc?.expiry_date),
      Specification: e.specification, "Service Details": e.service_details, Notes: e.notes,
    };
  });
}

export function issuanceRows(list: Issuance[], d: StoreData) {
  const eq = new Map(d.equipment.map((e) => [e.id, e]));
  const L = lookups(d);
  return list.map((i) => {
    const e = eq.get(i.equipment_id);
    return {
      "Report No": i.report_no, "Equipment ID": e?.code ?? "", Equipment: e ? `${L.cat(e.category_id) || e.type} ${e.brand} ${e.model}`.trim() : "",
      "Serial No": e?.serial_no ?? "", "Leads Store No": e?.store_no ?? "", Technician: i.issued_to, Department: i.department,
      "Job No": i.job_no, "Job Description": i.job_description, "Job Location": i.job_location, Purpose: i.purpose,
      "Issuance Date": fmt(i.issuance_date), "Expected Return": fmt(i.expected_return_date), "Return Date": fmt(i.return_date),
      "No. of Days Since Issued": daysSince(i.issuance_date, i.return_date), Status: i.return_date ? "Returned" : "Out",
      "Return Condition": i.return_condition ?? "", Reconciled: i.reconciled ? `Yes (${i.reconciled_by})` : "No",
      Notes: [i.notes, i.return_notes].filter(Boolean).join(" · "),
    };
  });
}
