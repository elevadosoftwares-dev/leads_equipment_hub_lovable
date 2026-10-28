import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { equipmentStatus, fmt, latestCalibration, lookups, useStore } from "@/lib/store";
import { equipmentRows } from "@/lib/reports";
import { Combo, Empty, ExportButton, PageHeader, Photo, StatusPill } from "@/components/store/ui";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search · Store Management System" },
      { name: "description", content: "Search equipment, calibration and issuance history." },
      { property: "og:title", content: "Search · Store Management System" },
      {
        property: "og:description",
        content: "Search equipment, calibration and issuance history.",
      },
    ],
  }),
  component: SearchPage,
});

const STATUSES = ["", "available", "issued", "calibration_due", "quarantined"];

function SearchPage() {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const L = lookups(data);
  const term = q.trim().toLowerCase();
  const has = (...vals: (string | null | undefined)[]) =>
    vals.some((v) => v?.toLowerCase().includes(term));

  const eqs = data?.equipment ?? [];
  const cals = data?.calibrations ?? [];
  const iss = data?.issuances ?? [];

  const results = eqs
    .map((e) => {
      const myIss = iss.filter((i) => i.equipment_id === e.id);
      const myCals = cals.filter((c) => c.equipment_id === e.id);
      const eqMatch =
        !term ||
        has(
          e.code,
          e.type,
          L.cat(e.category_id),
          L.sub(e.subcategory_id),
          L.dept(e.department_id),
          L.set(e.set_id),
          e.store_no,
          e.condition,
          e.quarantine_reason,
          e.brand,
          e.model,
          e.serial_no,
          e.location,
          e.specification,
          e.service_details,
          e.notes,
        );
      const issMatches = term
        ? myIss.filter((i) =>
            has(
              i.report_no,
              i.job_no,
              i.job_description,
              i.job_location,
              i.issued_to,
              i.department,
              i.purpose,
              i.notes,
              i.return_condition,
              i.return_notes,
            ),
          )
        : [];
      const calMatch = term
        ? myCals.some((c) => has(c.performed_by, c.remarks, c.certificate_name))
        : false;
      return {
        e,
        myIss,
        myCals,
        issMatches,
        match: eqMatch || issMatches.length > 0 || calMatch,
        st: equipmentStatus(e, cals),
      };
    })
    .filter(
      (r) =>
        r.match &&
        (!status || r.st === status) &&
        (!cat || r.e.category_id === cat) &&
        (!sub || r.e.subcategory_id === sub),
    );

  return (
    <>
      <PageHeader
        title="Search Equipment"
        actions={
          data && (
            <ExportButton
              name="Search Results"
              rows={() =>
                equipmentRows(
                  results.map((r) => r.e),
                  data,
                )
              }
            />
          )
        }
      />
      <div className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            placeholder="Search by ID, type, brand, model, serial, location, spec, person, department, purpose, notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <Combo
            value={cat}
            onChange={(v) => {
              setCat(v);
              setSub("");
            }}
            options={(data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="All categories"
          />
        </div>
        <div className="sm:w-48">
          <Combo
            value={sub}
            onChange={setSub}
            disabled={!cat}
            options={(data?.subcategories ?? [])
              .filter((s) => s.category_id === cat)
              .map((s) => ({ value: s.id, label: s.name }))}
            placeholder="All sub categories"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) : "All statuses"}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {results.length} result{results.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-4">
        {results.map(({ e, myIss, myCals, issMatches, st }) => {
          const lc = latestCalibration(myCals, e.id);
          const history = issMatches.length ? issMatches : myIss;
          return (
            <div key={e.id} className="panel p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <Photo path={e.photo_path} className="h-24 w-24 shrink-0" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to="/equipment/$id"
                      params={{ id: e.id }}
                      className="font-display text-lg font-bold text-primary"
                    >
                      {e.code} · {L.cat(e.category_id) || e.type}
                      {e.subcategory_id && ` / ${L.sub(e.subcategory_id)}`}
                    </Link>
                    <StatusPill status={st} />
                  </div>
                  <div className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                    <span>
                      <b>Brand/Model:</b> {e.brand} {e.model}
                    </span>
                    <span>
                      <b>Serial:</b> {e.serial_no || "—"}
                    </span>
                    <span>
                      <b>Location:</b> {e.location || "—"}
                    </span>
                    <span>
                      <b>Store No:</b> {e.store_no || "—"}
                    </span>
                    <span>
                      <b>Department:</b> {L.dept(e.department_id) || "—"}
                    </span>
                    <span>
                      <b>Condition:</b> {e.condition}
                      {e.quarantine_reason && ` (${e.quarantine_reason})`}
                    </span>
                    <span>
                      <b>Last calibrated:</b> {fmt(lc?.calibration_date)}
                    </span>
                    <span>
                      <b>Cal. expiry:</b> {fmt(lc?.expiry_date)}
                    </span>
                    <span>
                      <b>Times issued:</b> {myIss.length}
                    </span>
                  </div>
                  {e.specification && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {e.specification}
                    </p>
                  )}
                </div>
              </div>
              {history.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border">
                  <div className="bg-muted px-4 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {issMatches.length ? "Matching issuance history" : "Issuance history"}
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Report</th>
                        <th>Issued To</th>
                        <th>Job No</th>
                        <th>Job</th>
                        <th>Issued</th>
                        <th>Returned</th>
                        <th>Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 3).map((i) => (
                        <tr key={i.id}>
                          <td>{i.report_no}</td>
                          <td>{i.issued_to}</td>
                          <td>{i.job_no}</td>
                          <td>{i.job_description || i.purpose}</td>
                          <td>{fmt(i.issuance_date)}</td>
                          <td>
                            {i.return_date ? fmt(i.return_date) : <StatusPill status="out" />}
                          </td>
                          <td>{i.return_condition ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {results.length === 0 && (
          <div className="panel">
            <Empty>No matching equipment.</Empty>
          </div>
        )}
      </div>
    </>
  );
}
