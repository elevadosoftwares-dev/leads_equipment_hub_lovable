import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calibrationState, fmt, openFile, useStore, type Calibration } from "@/lib/store";
import { Empty, ExportButton, PageHeader, StatusPill } from "@/components/store/ui";
import { CalibrationDialog } from "@/components/store/CalibrationDialog";

export const Route = createFileRoute("/calibration")({
  head: () => ({
    meta: [
      { title: "Calibration · Store Management System" },
      { name: "description", content: "Calibration dates, expiry and certificates for store equipment." },
      { property: "og:title", content: "Calibration · Store Management System" },
      { property: "og:description", content: "Calibration dates, expiry and certificates for store equipment." },
    ],
  }),
  component: CalibrationPage,
});

function CalibrationPage() {
  const { data, isLoading } = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Calibration | null>(null);
  const eqMap = new Map((data?.equipment ?? []).map((e) => [e.id, e]));
  const cals = [...(data?.calibrations ?? [])].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

  return (
    <>
      <PageHeader title="Calibration" actions={<><ExportButton name="Calibration" rows={() => cals.map((c) => { const e = eqMap.get(c.equipment_id); return { ID: e?.code ?? "", Equipment: `${e?.type ?? ""} ${e?.brand ?? ""} ${e?.model ?? ""}`.trim(), "Serial No": e?.serial_no ?? "", "Calibration Date": fmt(c.calibration_date), "Expiry Date": fmt(c.expiry_date), Certificate: c.certificate_name ?? "", "Performed By": c.performed_by, Remarks: c.remarks, Status: calibrationState(c.expiry_date) }; })} /><Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add Calibration</Button></>} />
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>ID</th><th>Equipment</th><th>Calibration Date</th><th>Expiry Date</th><th>Certificate</th><th>Performed By</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {cals.map((c) => {
              const e = eqMap.get(c.equipment_id);
              return (
                <tr key={c.id}>
                  <td>{e && <Link to="/equipment/$id" params={{ id: e.id }} className="font-medium text-primary">{e.code}</Link>}</td>
                  <td>{e?.type} <span className="text-muted-foreground">{e?.brand} {e?.model}</span></td>
                  <td>{fmt(c.calibration_date)}</td><td>{fmt(c.expiry_date)}</td>
                  <td>{c.certificate_path ? <button className="inline-flex items-center gap-1 text-primary" onClick={() => openFile(c.certificate_path!)}><FileText className="h-4 w-4" />{c.certificate_name}</button> : "—"}</td>
                  <td>{c.performed_by}</td>
                  <td><StatusPill status={calibrationState(c.expiry_date)} /></td>
                  <td><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4 text-primary" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && cals.length === 0 && <Empty>No calibration records yet.</Empty>}
      </div>
      <CalibrationDialog open={open} onOpenChange={setOpen} equipmentList={data?.equipment ?? []} initial={edit} />
    </>
  );
}
