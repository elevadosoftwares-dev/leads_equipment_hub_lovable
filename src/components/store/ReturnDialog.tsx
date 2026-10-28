import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { returnEquipment } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, selectCls } from "./ui";
import { CONDITIONS, daysSince, fmt, type Equipment, type Issuance } from "@/lib/store";

export function ReturnDialog({
  issuance,
  equipment,
  onOpenChange,
}: {
  issuance: Issuance | null;
  equipment?: Equipment | undefined;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [cond, setCond] = useState("Good");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (issuance) {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setCond("Good");
      setReason("");
      setNotes("");
      setRec(false);
    }
  }, [issuance]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!issuance) return;
    if (date < issuance.issuance_date)
      return void toast.error("Return date cannot be before issuance date");
    if (!rec) return void toast.error("Tick the box to confirm it matches the issuance report");
    if (cond === "Quarantined" && !reason.trim())
      return void toast.error("Enter a reason for quarantine");
    setBusy(true);
    try {
      // Updates the issuance and the equipment together; reconciled_by is the signed-in user.
      await returnEquipment({
        data: {
          issuance_id: issuance.id,
          return_date: date,
          return_condition: cond as "Good" | "Spoiled" | "Quarantined",
          return_notes: notes,
          quarantine_reason: reason,
        },
      });
    } catch (e) {
      return void toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
    await qc.invalidateQueries({ queryKey: ["store"] });
    toast.success("Equipment returned and reconciled");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!issuance} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Return & Reconcile</DialogTitle>
        </DialogHeader>
        {issuance && (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1 rounded-lg bg-accent p-3 text-sm">
              <div className="font-semibold">Issuance Report {issuance.report_no}</div>
              <div>
                {equipment?.code} · {equipment?.type} {equipment?.brand} {equipment?.model} · SN{" "}
                {equipment?.serial_no || "—"}
              </div>
              <div className="text-muted-foreground">
                Technician {issuance.issued_to} · Job {issuance.job_no || "—"} · issued{" "}
                {fmt(issuance.issuance_date)} ({daysSince(issuance.issuance_date)} days) · expected{" "}
                {fmt(issuance.expected_return_date)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Return Date" required>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Return Condition" required>
                <select
                  value={cond}
                  onChange={(e) => setCond(e.target.value)}
                  className={selectCls}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            {cond === "Quarantined" && (
              <Field label="Reason for Quarantine" required>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            <Field label="Notes">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={rec}
                onCheckedChange={(v) => setRec(v === true)}
                className="mt-0.5"
              />
              <span>
                I have checked the returned item and serial number against issuance report{" "}
                {issuance.report_no}.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Confirm Return
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
