import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { saveRow } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "./ui";
import { uploadFile, type Calibration, type Equipment } from "@/lib/store";

export function CalibrationDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentList,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  equipmentId?: string;
  equipmentList?: Equipment[];
  initial?: Calibration | null;
}) {
  const qc = useQueryClient();
  const [eqId, setEqId] = useState(equipmentId ?? "");
  const [calDate, setCalDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [by, setBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEqId(initial?.equipment_id ?? equipmentId ?? "");
    setCalDate(initial?.calibration_date ?? "");
    setExpDate(initial?.expiry_date ?? "");
    setBy(initial?.performed_by ?? "");
    setRemarks(initial?.remarks ?? "");
    setFile(null);
  }, [open, initial, equipmentId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!eqId) return void toast.error("Select equipment");
    if (expDate < calDate) return void toast.error("Expiry date must be after calibration date");
    setBusy(true);
    try {
      let certificate_path = initial?.certificate_path ?? null;
      let certificate_name = initial?.certificate_name ?? null;
      if (file) {
        certificate_path = await uploadFile(file, "certificates");
        certificate_name = file.name;
      }
      const payload = {
        equipment_id: eqId,
        calibration_date: calDate,
        expiry_date: expDate,
        performed_by: by,
        remarks,
        certificate_path,
        certificate_name,
      };
      await saveRow({ data: { table: "calibrations", id: initial?.id, row: payload } });
      await qc.invalidateQueries({ queryKey: ["store"] });
      toast.success("Calibration saved");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Calibration Details" : "Add Calibration"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {equipmentList && !equipmentId && (
            <div className="sm:col-span-2">
              <Field label="Equipment" required>
                <select
                  value={eqId}
                  onChange={(e) => setEqId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select equipment…</option>
                  {equipmentList.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.code} · {q.type} ({q.brand} {q.model})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <Field label="Calibration Date" required>
            <Input
              type="date"
              required
              value={calDate}
              onChange={(e) => setCalDate(e.target.value)}
            />
          </Field>
          <Field label="Expiry Date" required>
            <Input
              type="date"
              required
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Performed By">
              <Input value={by} onChange={(e) => setBy(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Certificate">
              <span className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-primary hover:bg-accent">
                <Upload className="h-4 w-4" />{" "}
                {file?.name ?? initial?.certificate_name ?? "Upload certificate (PDF/image)"}
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </span>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Remarks">
              <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
