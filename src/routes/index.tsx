import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Boxes, PackageCheck, PackageOpen, AlarmClock } from "lucide-react";
import { addDays, format } from "date-fns";
import {
  calibrationState,
  equipmentStatus,
  fmt,
  latestCalibration,
  lookups,
  useStore,
} from "@/lib/store";
import { equipmentRows } from "@/lib/reports";
import { Combo, Empty, ExportButton, Field, PageHeader, StatusPill } from "@/components/store/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Store Management System" },
      {
        name: "description",
        content: "Overview of equipment, issuance and calibration status in the Leads store.",
      },
      { property: "og:title", content: "Dashboard · Store Management System" },
      {
        property: "og:description",
        content: "Overview of equipment, issuance and calibration status in the Leads store.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useStore();
  const navigate = useNavigate();
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const L = lookups(data);
  const eq = data?.equipment ?? [];
  const cals = data?.calibrations ?? [];
  const statuses = eq.map((e) => equipmentStatus(e, cals));
  const limit = format(addDays(new Date(), 60), "yyyy-MM-dd");
  const expiring = eq
    .map((e) => ({ e, c: latestCalibration(cals, e.id) }))
    .filter((x) => x.c && x.c.expiry_date <= limit)
    .sort((a, b) => a.c!.expiry_date.localeCompare(b.c!.expiry_date));

  const stats = [
    {
      label: "Total Equipment",
      value: eq.length,
      icon: Boxes,
      cls: "stat-blue",
      ic: "bg-white/20",
    },
    {
      label: "Available",
      value: statuses.filter((s) => s === "available").length,
      icon: PackageCheck,
      cls: "stat-green",
      ic: "bg-white/20",
    },
    {
      label: "Issued Out",
      value: statuses.filter((s) => s === "issued").length,
      icon: PackageOpen,
      cls: "stat-amber",
      ic: "bg-white/20",
    },
    {
      label: "Cal. Due / Quarantined",
      value: statuses.filter((s) => s === "calibration_due" || s === "quarantined").length,
      icon: AlarmClock,
      cls: "stat-red",
      ic: "bg-white/20",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={data && <ExportButton name="Equipment" rows={() => equipmentRows(eq, data)} />}
      />
      <div className="panel mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_2fr]">
        <Field label="Category">
          <Combo
            value={cat}
            onChange={(v) => {
              setCat(v);
              setSub("");
            }}
            options={(data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="All categories"
          />
        </Field>
        <Field label="Sub Category">
          <Combo
            value={sub}
            onChange={setSub}
            disabled={!cat}
            options={(data?.subcategories ?? [])
              .filter((s) => s.category_id === cat)
              .map((s) => ({ value: s.id, label: s.name }))}
            placeholder="All sub categories"
          />
        </Field>
        <Field label="Find Equipment">
          <Combo
            value=""
            onChange={(id) => id && navigate({ to: "/equipment/$id", params: { id } })}
            allowClear={false}
            options={eq
              .filter((e) => (!cat || e.category_id === cat) && (!sub || e.subcategory_id === sub))
              .map((e) => ({
                value: e.id,
                label: `${e.code} · ${L.cat(e.category_id) || e.type}${e.subcategory_id ? " / " + L.sub(e.subcategory_id) : ""} · ${e.brand} ${e.model} · SN ${e.serial_no || "—"}${e.store_no ? " · " + e.store_no : ""}`,
              }))}
            placeholder="Search by ID, serial, brand, model…"
          />
        </Field>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={cn("flex items-center gap-4 rounded-2xl p-5", s.cls)}>
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl text-primary-foreground",
                s.ic,
              )}
            >
              <s.icon className="h-7 w-7" />
            </span>
            <div>
              <div className="text-sm font-semibold">{s.label}</div>
              <div className="font-display text-3xl font-bold">{isLoading ? "…" : s.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="text-lg font-bold">Recent Equipment</h2>
            <Link to="/equipment" className="text-sm font-semibold text-primary">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Brand / Model</th>
                  <th>Serial No</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {eq.slice(0, 6).map((e, i) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        to="/equipment/$id"
                        params={{ id: e.id }}
                        className="font-medium text-primary"
                      >
                        {e.code}
                      </Link>
                    </td>
                    <td>{L.cat(e.category_id) || e.type}</td>
                    <td>
                      {e.brand} {e.model}
                    </td>
                    <td>{e.serial_no}</td>
                    <td>{e.location}</td>
                    <td>
                      <StatusPill status={statuses[i] ?? "available"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && eq.length === 0 && (
              <Empty>
                No equipment yet.{" "}
                <Link to="/equipment/new" className="text-primary">
                  Register your first item
                </Link>
                .
              </Empty>
            )}
          </div>
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="text-lg font-bold">Calibration Expiry (Next 60 Days)</h2>
            <Link to="/calibration" className="text-sm font-semibold text-primary">
              View All
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Equipment</th>
                <th>Expiry Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {expiring.slice(0, 6).map(({ e, c }) => {
                const st = calibrationState(c!.expiry_date);
                return (
                  <tr key={e.id}>
                    <td>
                      <Link
                        to="/equipment/$id"
                        params={{ id: e.id }}
                        className="font-medium text-primary"
                      >
                        {e.code}
                      </Link>
                    </td>
                    <td>{L.cat(e.category_id) || e.type}</td>
                    <td className={cn(st !== "ok" && "font-semibold text-danger")}>
                      {fmt(c!.expiry_date)}
                    </td>
                    <td>
                      <StatusPill status={st} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!isLoading && expiring.length === 0 && (
            <Empty>Nothing expiring in the next 60 days.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
