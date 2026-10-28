import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteRow, saveRow } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, ExportButton, Field, PageHeader } from "./ui";

type Table = "categories" | "subcategories" | "departments" | "technicians";
export type Col = {
  key: string;
  label: string;
  render?: (v: string, set: (v: string) => void) => ReactNode;
  show?: (row: Record<string, unknown>) => string;
};

/** Generic add / edit / delete list for master data tables. */
export function MasterList({
  title,
  table,
  rows,
  cols,
  extraFilter,
}: {
  title: string;
  table: Table;
  rows: Record<string, unknown>[];
  cols: Col[];
  extraFilter?: ReactNode;
}) {
  const qc = useQueryClient();
  const blank = Object.fromEntries(cols.map((c) => [c.key, ""]));
  const [draft, setDraft] = useState<Record<string, string>>(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>(blank);

  const clean = (r: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, k.endsWith("_id") ? v || null : v.trim()]),
    );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft[cols[0]!.key]?.trim()) return void toast.error(`${cols[0]!.label} is required`);
    try {
      await saveRow({ data: { table, row: clean(draft) } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    setDraft(blank);
    qc.invalidateQueries({ queryKey: ["store"] });
    toast.success("Added");
  }
  async function save(id: string) {
    try {
      await saveRow({ data: { table, id, row: clean(edit) } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["store"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteRow({ data: { table, id } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["store"] });
  }

  const display = (r: Record<string, unknown>, c: Col) =>
    (c.show ? c.show(r) : String(r[c.key] ?? "")) || "—";

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <ExportButton
            name={title}
            rows={() =>
              rows.map((r) => Object.fromEntries(cols.map((c) => [c.label, display(r, c)])))
            }
          />
        }
      />
      <form onSubmit={add} className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
        {cols.map((c) => (
          <div key={c.key} className="min-w-48 flex-1">
            <Field label={c.label} required={c === cols[0]}>
              {c.render ? (
                c.render(draft[c.key] ?? "", (v) => setDraft({ ...draft, [c.key]: v }))
              ) : (
                <Input
                  value={draft[c.key]}
                  onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                />
              )}
            </Field>
          </div>
        ))}
        <Button type="submit">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
      {extraFilter}
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>No.</th>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const id = String(r["id"]);
              const on = editId === id;
              return (
                <tr key={id}>
                  <td>{i + 1}</td>
                  {cols.map((c) => (
                    <td key={c.key}>
                      {on ? (
                        c.render ? (
                          c.render(edit[c.key] ?? "", (v) => setEdit({ ...edit, [c.key]: v }))
                        ) : (
                          <Input
                            value={edit[c.key]}
                            onChange={(e) => setEdit({ ...edit, [c.key]: e.target.value })}
                          />
                        )
                      ) : (
                        display(r, c)
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap">
                    {on ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Save"
                          onClick={() => save(id)}
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Cancel"
                          onClick={() => setEditId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit"
                          onClick={() => {
                            setEditId(id);
                            setEdit(
                              Object.fromEntries(cols.map((c) => [c.key, String(r[c.key] ?? "")])),
                            );
                          }}
                        >
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete"
                          onClick={() => del(id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>No entries yet.</Empty>}
      </div>
    </>
  );
}
