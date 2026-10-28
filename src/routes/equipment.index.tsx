import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { equipmentStatus, fmt, latestCalibration, lookups, useStore } from "@/lib/store";
import { equipmentRows } from "@/lib/reports";
import { Combo, Empty, ExportButton, PageHeader, Photo, StatusPill } from "@/components/store/ui";

export const Route = createFileRoute("/equipment/")({
  head: () => ({
    meta: [
      { title: "Equipment · Store Management System" },
      { name: "description", content: "All registered equipment in the Leads store." },
      { property: "og:title", content: "Equipment · Store Management System" },
      { property: "og:description", content: "All registered equipment in the Leads store." },
    ],
  }),
  component: EquipmentList,
});

function EquipmentList() {
  const { data, isLoading } = useStore();
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const L = lookups(data);
  const eq = (data?.equipment ?? []).filter(
    (e) => (!cat || e.category_id === cat) && (!sub || e.subcategory_id === sub),
  );
  const cals = data?.calibrations ?? [];
  return (
    <>
      <PageHeader
        title="Equipment"
        actions={
          <>
            {data && <ExportButton name="Equipment" rows={() => equipmentRows(eq, data)} />}
            <Button asChild>
              <Link to="/equipment/new">
                <Plus className="h-4 w-4" /> Register New Equipment
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <Combo
          value={cat}
          onChange={(v) => {
            setCat(v);
            setSub("");
          }}
          options={(data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
          placeholder="All categories"
        />
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
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Category</th>
              <th>Sub Category</th>
              <th>Brand / Model</th>
              <th>Serial No</th>
              <th>Store No</th>
              <th>Location</th>
              <th>Cal. Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {eq.map((e) => (
              <tr key={e.id}>
                <td>
                  <Photo path={e.photo_path} className="h-10 w-10" />
                </td>
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
                <td>{L.sub(e.subcategory_id)}</td>
                <td>
                  {e.brand} {e.model}
                </td>
                <td>{e.serial_no}</td>
                <td>{e.store_no}</td>
                <td>{e.location}</td>
                <td>{fmt(latestCalibration(cals, e.id)?.expiry_date)}</td>
                <td>
                  <StatusPill status={equipmentStatus(e, cals)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && eq.length === 0 && <Empty>No equipment registered yet.</Empty>}
      </div>
    </>
  );
}
