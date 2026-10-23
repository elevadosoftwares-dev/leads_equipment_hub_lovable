import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { daysSince, fmt, useStore } from "@/lib/store";
import { equipmentRows, issuanceRows } from "@/lib/reports";
import { Empty, ExportButton, Field, PageHeader, StatusPill, selectCls } from "@/components/store/ui";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Store Management System" },
      { name: "description", content: "Issuance, equipment and calibration reports with Excel export." },
      { property: "og:title", content: "Reports · Store Management System" },
      { property: "og:description", content: "Issuance, equipment and calibration reports with Excel export." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useStore();
  const [state, setState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const eqMap = new Map((data?.equipment ?? []).map((e) => [e.id, e]));
  const iss = (data?.issuances ?? []).filter((i) =>
    (!state || (state === "out" ? !i.return_date : !!i.return_date)) && (!from || i.issuance_date >= from) && (!to || i.issuance_date <= to));

  return (
    <>
      <PageHeader title="Reports" actions={data && (
        <>
          <ExportButton name="Equipment Report" rows={() => equipmentRows(data.equipment, data)} />
          <ExportButton name="Quarantine Report" rows={() => equipmentRows(data.equipment.filter((e) => e.condition === "Quarantined"), data)} />
        </>
      )} />
      <div className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="w-40"><Field label="Status"><select value={state} onChange={(e) => setState(e.target.value)} className={selectCls}><option value="">All</option><option value="out">Issued out</option><option value="returned">Returned</option></select></Field></div>
        <div className="w-44"><Field label="Issued from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field></div>
        <div className="w-44"><Field label="Issued to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
        <div className="ml-auto">{data && <ExportButton name="Issuance Report" rows={() => issuanceRows(iss, data)} />}</div>
      </div>
      <h2 className="mb-3 text-lg font-bold">Issuance Report ({iss.length})</h2>
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Report</th><th>ID</th><th>Equipment</th><th>Technician</th><th>Job No</th><th>Issued</th><th>Returned</th><th>Days Since Issued</th><th>Condition</th><th>Reconciled</th></tr></thead>
          <tbody>
            {iss.map((i) => {
              const e = eqMap.get(i.equipment_id);
              return (
                <tr key={i.id}>
                  <td><Link to="/issuance/report/$no" params={{ no: i.report_no }} className="text-primary">{i.report_no}</Link></td>
                  <td>{e?.code}</td><td>{e?.type} {e?.brand} {e?.model}</td><td>{i.issued_to}</td><td>{i.job_no}</td>
                  <td>{fmt(i.issuance_date)}</td><td>{i.return_date ? fmt(i.return_date) : <StatusPill status="out" />}</td>
                  <td className="font-semibold">{daysSince(i.issuance_date, i.return_date)}</td>
                  <td>{i.return_condition ?? "—"}</td><td>{i.reconciled ? "Yes" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {iss.length === 0 && <Empty>No issuances match.</Empty>}
      </div>
    </>
  );
}
