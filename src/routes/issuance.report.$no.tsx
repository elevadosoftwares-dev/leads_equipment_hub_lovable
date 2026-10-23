import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { daysSince, fmt, lookups, useStore, type Issuance } from "@/lib/store";
import { issuanceRows } from "@/lib/reports";
import { Empty, ExportButton, PageHeader, StatusPill } from "@/components/store/ui";
import { ReturnDialog } from "@/components/store/ReturnDialog";
import logo from "@/assets/leads-logo.png";

export const Route = createFileRoute("/issuance/report/$no")({
  head: ({ params }) => ({
    meta: [
      { title: `Issuance Report ${params.no} · Store Management System` },
      { name: "description", content: "Issuance report with job details for equipment issued to a technician." },
      { property: "og:title", content: `Issuance Report ${params.no} · Store Management System` },
      { property: "og:description", content: "Issuance report with job details for equipment issued to a technician." },
    ],
  }),
  component: Report,
});

function Report() {
  const { no } = Route.useParams();
  const { data, isLoading } = useStore();
  const [returning, setReturning] = useState<Issuance | null>(null);
  if (isLoading) return null;
  const rows = (data?.issuances ?? []).filter((i) => i.report_no === no);
  if (!rows.length) return <Empty>Report not found.</Empty>;
  const h = rows[0]!;
  const L = lookups(data);
  const eqMap = new Map(data!.equipment.map((e) => [e.id, e]));
  const tech = data!.technicians.find((t) => t.id === h.technician_id);
  const allReturned = rows.every((r) => r.return_date);
  const allReconciled = rows.every((r) => r.reconciled);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`Issuance Report ${no}`}
          back={<Link to="/issuance" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>}
          actions={<><ExportButton name={`Issuance Report ${no}`} rows={() => issuanceRows(rows, data!)} /><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button></>}
        />
      </div>
      <div className="panel space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <img src={logo} alt="Leads" className="h-14 w-auto" />
          <div className="text-right">
            <div className="font-display text-xl font-bold">Equipment Issuance Report</div>
            <div className="text-sm text-muted-foreground">Report No {no} · {allReturned ? (allReconciled ? "Returned & reconciled" : "Returned") : "Open"}</div>
          </div>
        </div>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Technician</dt><dd>{h.issued_to}{tech?.employee_no && ` (${tech.employee_no})`}</dd></div>
          <div><dt className="font-semibold">Department</dt><dd>{h.department || "—"}</dd></div>
          <div><dt className="font-semibold">Job No</dt><dd>{h.job_no || "—"}</dd></div>
          <div><dt className="font-semibold">Job Location</dt><dd>{h.job_location || "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold">Job Description</dt><dd className="whitespace-pre-wrap">{h.job_description || "—"}</dd></div>
          <div><dt className="font-semibold">Purpose</dt><dd>{h.purpose || "—"}</dd></div>
          <div><dt className="font-semibold">Issued / Expected Return</dt><dd>{fmt(h.issuance_date)} → {fmt(h.expected_return_date)}</dd></div>
        </dl>
        <table className="data-table">
          <thead><tr><th>No.</th><th>ID</th><th>Equipment</th><th>Serial No</th><th>Store No</th><th>Days</th><th>Returned</th><th>Condition</th><th>Reconciled</th><th className="print:hidden"></th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const e = eqMap.get(r.equipment_id);
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{e?.code}</td><td>{e && `${L.cat(e.category_id) || e.type} ${e.brand} ${e.model}`}</td><td>{e?.serial_no}</td><td>{e?.store_no}</td>
                  <td>{daysSince(r.issuance_date, r.return_date)}</td>
                  <td>{r.return_date ? fmt(r.return_date) : <StatusPill status="out" />}</td>
                  <td>{r.return_condition ?? "—"}</td>
                  <td>{r.reconciled ? `✔ ${r.reconciled_by}` : "—"}</td>
                  <td className="print:hidden">{!r.return_date && <Button size="sm" variant="secondary" onClick={() => setReturning(r)}>Return</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {h.notes && <p className="text-sm"><b>Notes:</b> {h.notes}</p>}
        <div className="grid grid-cols-2 gap-8 pt-10 text-sm">
          <div className="border-t pt-2">Issued by (Store)</div>
          <div className="border-t pt-2">Received by (Technician)</div>
        </div>
      </div>
      <ReturnDialog issuance={returning} equipment={returning ? eqMap.get(returning.equipment_id) : undefined} onOpenChange={(o) => !o && setReturning(null)} />
    </>
  );
}
