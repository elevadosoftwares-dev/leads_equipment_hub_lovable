import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Pencil, Plus, Trash2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRow } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  calibrationState,
  effectiveCondition,
  equipmentStatus,
  FILE_KINDS,
  fmt,
  HISTORY_LIMIT,
  lookups,
  openFile,
  useIsAdmin,
  useStore,
  type Calibration,
  type Issuance,
} from "@/lib/store";
import { Empty, PageHeader, Photo, StatusPill } from "@/components/store/ui";
import { EquipmentForm } from "@/components/store/EquipmentForm";
import { CalibrationDialog } from "@/components/store/CalibrationDialog";
import { ReturnDialog } from "@/components/store/ReturnDialog";

export const Route = createFileRoute("/equipment/$id")({
  head: () => ({
    meta: [
      { title: "Equipment Details · Store Management System" },
      { name: "description", content: "Equipment details, calibration and issuance history." },
      { property: "og:title", content: "Equipment Details · Store Management System" },
      {
        property: "og:description",
        content: "Equipment details, calibration and issuance history.",
      },
    ],
  }),
  component: Details,
});

function Details() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useStore();
  const [editing, setEditing] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calEdit, setCalEdit] = useState<Calibration | null>(null);
  const [returning, setReturning] = useState<Issuance | null>(null);

  const isAdmin = useIsAdmin();
  const eq = data?.equipment.find((e) => e.id === id);
  if (isLoading) return null;
  if (!eq)
    return (
      <Empty>
        Equipment not found.{" "}
        <Link to="/equipment" className="text-primary">
          Back to list
        </Link>
      </Empty>
    );
  const cals = data!.calibrations.filter((c) => c.equipment_id === id);
  const allIss = data!.issuances.filter((i) => i.equipment_id === id);
  const iss = allIss.slice(0, HISTORY_LIMIT);
  const files = data!.files.filter((f) => f.equipment_id === id);
  const L = lookups(data);
  const cond = effectiveCondition(eq, data!.calibrations);
  const status = equipmentStatus(eq, data!.calibrations);
  const openIss = allIss.find((i) => !i.return_date);

  async function del() {
    if (!confirm(`Delete ${eq!.code}? This also removes its calibration and issuance history.`))
      return;
    try {
      await deleteRow({ data: { table: "equipment", id } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    await qc.invalidateQueries({ queryKey: ["store"] });
    toast.success("Deleted");
    navigate({ to: "/equipment" });
  }
  async function delCal(c: Calibration) {
    if (!confirm("Delete this calibration record?")) return;
    try {
      await deleteRow({ data: { table: "calibrations", id: c.id } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["store"] });
  }

  const rows: [string, string][] = [
    ["ID", eq.code],
    ["Category", L.cat(eq.category_id) || eq.type],
    ["Sub Category", L.sub(eq.subcategory_id)],
    ["Brand", eq.brand],
    ["Model", eq.model],
    ["Serial No", eq.serial_no],
    ["Store No", eq.store_no],
    ["Department", L.dept(eq.department_id)],
    ["Location", eq.location],
    ["Set", L.set(eq.set_id)],
    ["Condition", cond.condition + (cond.reason ? ` — ${cond.reason}` : "")],
  ];

  return (
    <>
      <PageHeader
        title="Equipment Details"
        back={
          <Link to="/equipment" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="panel flex flex-col gap-6 p-6 sm:flex-row">
          <Photo path={eq.photo_path} className="aspect-square w-full sm:w-52" />
          <div className="flex-1 space-y-3">
            <h2 className="text-xl font-bold">
              {L.cat(eq.category_id) || eq.type}
              {eq.subcategory_id && ` · ${L.sub(eq.subcategory_id)}`}
            </h2>
            <StatusPill status={status} />
            <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 text-sm">
              {rows.map(([k, v]) => [
                <dt key={k} className="font-semibold">
                  {k}:
                </dt>,
                <dd key={k + "v"}>{v || "—"}</dd>,
              ])}
            </dl>
          </div>
          <div className="flex flex-col gap-2 sm:w-40">
            <Button onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {cond.condition === "Quarantined" && !openIss ? null : openIss ? (
              <Button variant="secondary" onClick={() => setReturning(openIss)}>
                <Undo2 className="h-4 w-4" /> Return
              </Button>
            ) : (
              <Button variant="secondary" asChild>
                <Link to="/issuance" search={{ equipment: eq.id }}>
                  <Send className="h-4 w-4" /> Issue
                </Link>
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" className="text-destructive" onClick={del}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>
        <div className="panel p-6">
          <h3 className="mb-3 font-bold">Specification</h3>
          <p className="whitespace-pre-wrap rounded-lg border p-3 text-sm">
            {eq.specification || "—"}
          </p>
          <h3 className="mt-5 mb-2 font-bold">Attachments</h3>
          {FILE_KINDS.map((k) => {
            const fs = files.filter((f) => f.kind === k.kind);
            return (
              <div key={k.kind} className="mb-2 text-sm">
                <div className="font-semibold">{k.label}</div>
                {fs.length ? (
                  fs.map((f) => (
                    <button
                      key={f.id}
                      className="flex items-center gap-1 text-primary"
                      onClick={() => openFile(f.path)}
                    >
                      <FileText className="h-4 w-4" />
                      {f.name}
                    </button>
                  ))
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="cal">
        <TabsList>
          <TabsTrigger value="cal">Calibration</TabsTrigger>
          <TabsTrigger value="iss">Issuance History (last {HISTORY_LIMIT})</TabsTrigger>
          <TabsTrigger value="svc">Service Details</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="cal" className="panel overflow-x-auto p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={() => {
                setCalEdit(null);
                setCalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Calibration
            </Button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Calibration Date</th>
                <th>Expiry Date</th>
                <th>Certificate</th>
                <th>Performed By</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cals.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{fmt(c.calibration_date)}</td>
                  <td>{fmt(c.expiry_date)}</td>
                  <td>
                    {c.certificate_path ? (
                      <button
                        className="inline-flex items-center gap-1 text-primary"
                        onClick={() => openFile(c.certificate_path!)}
                      >
                        <FileText className="h-4 w-4" />
                        {c.certificate_name}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{c.performed_by}</td>
                  <td>{c.remarks}</td>
                  <td>
                    <StatusPill status={calibrationState(c.expiry_date)} />
                  </td>
                  <td className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit calibration"
                      onClick={() => {
                        setCalEdit(c);
                        setCalOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete calibration"
                      onClick={() => delCal(c)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cals.length === 0 && <Empty>No calibration records.</Empty>}
        </TabsContent>
        <TabsContent value="iss" className="panel overflow-x-auto p-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report No</th>
                <th>Issued To</th>
                <th>Job No</th>
                <th>Job</th>
                <th>Issued</th>
                <th>Expected</th>
                <th>Returned</th>
                <th>Condition</th>
                <th>Reconciled</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {iss.map((i) => (
                <tr key={i.id}>
                  <td>{i.report_no}</td>
                  <td className="font-medium">{i.issued_to}</td>
                  <td>{i.job_no || "—"}</td>
                  <td>{i.job_description || i.purpose || "—"}</td>
                  <td>{fmt(i.issuance_date)}</td>
                  <td>{fmt(i.expected_return_date)}</td>
                  <td>{i.return_date ? fmt(i.return_date) : <StatusPill status="out" />}</td>
                  <td>{i.return_condition ?? "—"}</td>
                  <td>{i.reconciled ? `Yes · ${i.reconciled_by}` : "—"}</td>
                  <td className="max-w-xs text-muted-foreground">
                    {[i.notes, i.return_notes].filter(Boolean).join(" · ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {iss.length === 0 && <Empty>Never issued.</Empty>}
        </TabsContent>
        <TabsContent value="svc" className="panel p-6">
          <p className="whitespace-pre-wrap text-sm">
            {eq.service_details || "No service details."}
          </p>
        </TabsContent>
        <TabsContent value="notes" className="panel p-6">
          <p className="whitespace-pre-wrap text-sm">{eq.notes || "No notes."}</p>
        </TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
          </DialogHeader>
          <EquipmentForm
            initial={eq}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
      <CalibrationDialog
        open={calOpen}
        onOpenChange={setCalOpen}
        equipmentId={eq.id}
        initial={calEdit}
      />
      <ReturnDialog
        issuance={returning}
        equipment={eq}
        onOpenChange={(o) => !o && setReturning(null)}
      />
    </>
  );
}
