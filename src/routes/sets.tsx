import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteRow, saveRow } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { equipmentStatus, lookups, useStore } from "@/lib/store";
import { equipmentRows } from "@/lib/reports";
import { Combo, Empty, ExportButton, Field, PageHeader, StatusPill } from "@/components/store/ui";

export const Route = createFileRoute("/sets")({
  head: () => ({
    meta: [
      { title: "Equipment Sets · Store Management System" },
      {
        name: "description",
        content: "Group several equipment items into a set without duplicating them.",
      },
      { property: "og:title", content: "Equipment Sets · Store Management System" },
      {
        property: "og:description",
        content: "Group several equipment items into a set without duplicating them.",
      },
    ],
  }),
  component: SetsPage,
});

function SetsPage() {
  const qc = useQueryClient();
  const { data } = useStore();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pickFor, setPickFor] = useState<Record<string, string>>({});
  const L = lookups(data);
  const eq = data?.equipment ?? [];
  const free = eq
    .filter((e) => !e.set_id)
    .map((e) => ({
      value: e.id,
      label: `${e.code} · ${L.cat(e.category_id) || e.type} ${e.brand} ${e.model} ${e.serial_no}`,
    }));
  const refresh = () => qc.invalidateQueries({ queryKey: ["store"] });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return void toast.error("Set name is required");
    try {
      await saveRow({ data: { table: "equipment_sets", row: { name: name.trim(), notes } } });
    } catch (e) {
      const message = (e as Error).message;
      return void toast.error(
        message === "Already exists" ? "A set with this name already exists" : message,
      );
    }
    setName("");
    setNotes("");
    refresh();
  }
  async function assign(equipmentId: string, setId: string | null) {
    try {
      await saveRow({ data: { table: "equipment", id: equipmentId, row: { set_id: setId } } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    setPickFor({});
    refresh();
  }
  async function delSet(id: string) {
    if (!confirm("Delete this set? The equipment stays in the store.")) return;
    try {
      await deleteRow({ data: { table: "equipment_sets", id } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Equipment Sets"
        actions={
          data && (
            <ExportButton
              name="Equipment Sets"
              rows={() =>
                equipmentRows(
                  eq.filter((e) => e.set_id),
                  data,
                )
              }
            />
          )
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Group existing equipment together. Each item can belong to only one set, so nothing is
        entered twice.
      </p>
      <form onSubmit={create} className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <Field label="Set Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. UT Inspection Kit 1"
            />
          </Field>
        </div>
        <div className="min-w-48 flex-[2]">
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <Button type="submit">
          <Plus className="h-4 w-4" /> Create Set
        </Button>
      </form>
      <div className="space-y-4">
        {(data?.sets ?? []).map((s) => {
          const members = eq.filter((e) => e.set_id === s.id);
          return (
            <section key={s.id} className="panel p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">
                    {s.name}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({members.length} items)
                    </span>
                  </h2>
                  {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-72">
                    <Combo
                      value={pickFor[s.id] ?? ""}
                      onChange={(v) => v && assign(v, s.id)}
                      options={free}
                      placeholder="Add equipment to set…"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete set"
                    onClick={() => delSet(s.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Brand / Model</th>
                    <th>Serial No</th>
                    <th>Store No</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((e) => (
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
                      <td>{e.store_no}</td>
                      <td>
                        <StatusPill status={equipmentStatus(e, data!.calibrations)} />
                      </td>
                      <td>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove from set"
                          onClick={() => assign(e.id, null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {members.length === 0 && <Empty>No equipment in this set yet.</Empty>}
            </section>
          );
        })}
        {(data?.sets ?? []).length === 0 && (
          <div className="panel">
            <Empty>No sets yet.</Empty>
          </div>
        )}
      </div>
    </>
  );
}
