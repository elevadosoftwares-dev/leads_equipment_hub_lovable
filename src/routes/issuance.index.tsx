import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { createIssuance } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { daysSince, equipmentStatus, fmt, lookups, useStore, type Issuance } from "@/lib/store";
import { issuanceRows } from "@/lib/reports";
import { Combo, Empty, ExportButton, Field, PageHeader, Photo, StatusPill } from "@/components/store/ui";
import { ReturnDialog } from "@/components/store/ReturnDialog";

export const Route = createFileRoute("/issuance/")({
  validateSearch: z.object({ equipment: z.string().catch("").default("") }),
  head: () => ({
    meta: [
      { title: "Issuance · Store Management System" },
      { name: "description", content: "Issue equipment to technicians with job details and reconcile returns." },
      { property: "og:title", content: "Issuance · Store Management System" },
      { property: "og:description", content: "Issue equipment to technicians with job details and reconcile returns." },
    ],
  }),
  component: IssuancePage,
});

const today = () => format(new Date(), "yyyy-MM-dd");

function IssuancePage() {
  const { equipment: pre } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useStore();
  const [mode, setMode] = useState<"single" | "set">("single");
  const [eqId, setEqId] = useState(pre);
  const [setId, setSetId] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [techId, setTechId] = useState("");
  const [f, setF] = useState({ job_no: "", job_description: "", job_location: "", purpose: "", notes: "" });
  const [date, setDate] = useState(today());
  const [ret, setRet] = useState("");
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<Issuance | null>(null);
  const setField = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  useEffect(() => setEqId(pre), [pre]);

  const L = lookups(data);
  const all = data?.equipment ?? [];
  const cals = data?.calibrations ?? [];
  const canIssue = (e: (typeof all)[number]) => { const s = equipmentStatus(e, cals); return s === "available" || s === "calibration_due"; };
  const available = all.filter((e) => canIssue(e) && (!cat || e.category_id === cat) && (!sub || e.subcategory_id === sub));
  const setMembers = all.filter((e) => setId && e.set_id === setId);
  const blocked = setMembers.filter((e) => !canIssue(e));
  const sel = all.find((e) => e.id === eqId);
  const tech = data?.technicians.find((t) => t.id === techId);
  const eqMap = new Map(all.map((e) => [e.id, e]));
  const out = (data?.issuances ?? []).filter((i) => !i.return_date);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    const items = mode === "single" ? (sel ? [sel] : []) : setMembers;
    if (!items.length) return void toast.error(mode === "single" ? "Select equipment" : "Select a set with equipment");
    if (items.some((x) => !canIssue(x))) return void toast.error("Some equipment is issued or quarantined and cannot be issued");
    if (!tech) return void toast.error("Select a technician");
    if (ret && ret < date) return void toast.error("Expected return date must be after issuance date");
    setBusy(true);
    try {
      const { reportNo } = await createIssuance({
        data: { equipment_ids: items.map((x) => x.id), technician_id: tech.id, issuance_date: date, expected_return_date: ret || null, ...f },
      });
      await qc.invalidateQueries({ queryKey: ["store"] });
      toast.success(`Issuance report ${reportNo} created`);
      navigate({ to: "/issuance/report/$no", params: { no: reportNo } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const opt = (e: (typeof all)[number]) => ({ value: e.id, label: `${e.code} · ${L.cat(e.category_id) || e.type}${e.subcategory_id ? " / " + L.sub(e.subcategory_id) : ""} · ${e.brand} ${e.model} · SN ${e.serial_no || "—"}` });

  return (
    <>
      <PageHeader title="Issue Equipment" />
      <div className="mb-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <form onSubmit={issue} className="panel grid gap-4 p-6 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant={mode === "single" ? "default" : "outline"} onClick={() => setMode("single")}>Single equipment</Button>
            <Button type="button" size="sm" variant={mode === "set" ? "default" : "outline"} onClick={() => setMode("set")}>Equipment set</Button>
          </div>
          {mode === "single" ? (
            <>
              <Field label="Category"><Combo value={cat} onChange={(v) => { setCat(v); setSub(""); }} options={(data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))} placeholder="All categories" /></Field>
              <Field label="Sub Category"><Combo value={sub} onChange={setSub} disabled={!cat} options={(data?.subcategories ?? []).filter((s) => s.category_id === cat).map((s) => ({ value: s.id, label: s.name }))} placeholder="All sub categories" /></Field>
              <div className="sm:col-span-2"><Field label="Equipment" required><Combo value={eqId} onChange={setEqId} options={available.map(opt)} placeholder="Search available equipment…" /></Field></div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <Field label="Equipment Set" required><Combo value={setId} onChange={setSetId} options={(data?.sets ?? []).map((s) => ({ value: s.id, label: s.name }))} placeholder="Select set" /></Field>
              {setId && <p className="mt-2 text-sm text-muted-foreground">{setMembers.length} items in set{blocked.length > 0 && <span className="text-danger"> · {blocked.length} not available ({blocked.map((b) => b.code).join(", ")})</span>}</p>}
            </div>
          )}
          <Field label="Technician" required><Combo value={techId} onChange={setTechId} options={(data?.technicians ?? []).map((t) => ({ value: t.id, label: `${t.name}${t.employee_no ? ` (${t.employee_no})` : ""}` }))} placeholder="Select technician" /></Field>
          <Field label="Department"><Input readOnly value={tech ? L.dept(tech.department_id) : ""} placeholder="From technician" /></Field>
          <Field label="Job No" required><Input required value={f.job_no} onChange={setField("job_no")} /></Field>
          <Field label="Job Location"><Input value={f.job_location} onChange={setField("job_location")} placeholder="e.g. Hangar 2 / Customer site" /></Field>
          <div className="sm:col-span-2"><Field label="Job Description" required><Textarea required rows={2} value={f.job_description} onChange={setField("job_description")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Purpose"><Input value={f.purpose} onChange={setField("purpose")} /></Field></div>
          <Field label="Issuance Date" required><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Expected Return Date" required><Input type="date" required value={ret} onChange={(e) => setRet(e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={2} value={f.notes} onChange={setField("notes")} /></Field></div>
          {(data?.technicians.length ?? 0) === 0 && <p className="text-sm text-danger sm:col-span-2">No technicians yet. <Link to="/masters/technicians" className="underline">Add technicians</Link> first.</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Issuing…" : "Issue & Create Report"}</Button>
          </div>
        </form>
        <div className="h-fit rounded-2xl bg-accent p-5">
          <h3 className="mb-3 font-bold">Equipment Details</h3>
          {mode === "single" && sel ? (
            <div className="flex gap-4">
              <Photo path={sel.photo_path} className="h-28 w-28 shrink-0" />
              <dl className="grid grid-cols-[80px_1fr] gap-y-1 text-sm">
                <dt className="col-span-2 font-bold">{L.cat(sel.category_id) || sel.type}</dt>
                <dt>Brand:</dt><dd>{sel.brand}</dd><dt>Model:</dt><dd>{sel.model}</dd>
                <dt>Serial No:</dt><dd>{sel.serial_no}</dd><dt>Store No:</dt><dd>{sel.store_no}</dd><dt>Location:</dt><dd>{sel.location}</dd>
                <dt>Status:</dt><dd><StatusPill status={equipmentStatus(sel, cals)} /></dd>
              </dl>
            </div>
          ) : mode === "set" && setMembers.length ? (
            <ul className="space-y-1 text-sm">{setMembers.map((m) => <li key={m.id} className="flex justify-between gap-2"><span>{m.code} · {L.cat(m.category_id) || m.type}</span><StatusPill status={equipmentStatus(m, cals)} /></li>)}</ul>
          ) : <p className="text-sm text-muted-foreground">Select equipment to see its details.</p>}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Currently Issued Out ({out.length})</h2>
        {data && <ExportButton name="Issued Out" rows={() => issuanceRows(out, data)} />}
      </div>
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Report</th><th>ID</th><th>Equipment</th><th>Technician</th><th>Job No</th><th>Issued</th><th>Days</th><th>Expected Return</th><th></th></tr></thead>
          <tbody>
            {out.map((i) => {
              const e = eqMap.get(i.equipment_id);
              const overdue = i.expected_return_date && i.expected_return_date < today();
              return (
                <tr key={i.id}>
                  <td><Link to="/issuance/report/$no" params={{ no: i.report_no }} className="text-primary">{i.report_no}</Link></td>
                  <td>{e && <Link to="/equipment/$id" params={{ id: e.id }} className="font-medium text-primary">{e.code}</Link>}</td>
                  <td>{e && (L.cat(e.category_id) || e.type)}</td><td>{i.issued_to}</td><td>{i.job_no}</td><td>{fmt(i.issuance_date)}</td>
                  <td>{daysSince(i.issuance_date)}</td>
                  <td className={overdue ? "font-semibold text-danger" : ""}>{fmt(i.expected_return_date)}{overdue && " (overdue)"}</td>
                  <td><Button size="sm" variant="secondary" onClick={() => setReturning(i)}>Return</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {out.length === 0 && <Empty>No equipment is currently issued out.</Empty>}
      </div>
      <ReturnDialog issuance={returning} equipment={returning ? eqMap.get(returning.equipment_id) : undefined} onOpenChange={(o) => !o && setReturning(null)} />
    </>
  );
}
