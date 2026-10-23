import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload, X } from "lucide-react";
import { deleteEquipmentFile, saveEquipment } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combo, Field, Photo, selectCls } from "./ui";
import { CONDITIONS, FILE_KINDS, openFile, uploadFile, useStore, type Equipment } from "@/lib/store";

const empty = {
  category_id: "", subcategory_id: "", department_id: "", set_id: "", brand: "", model: "", serial_no: "", store_no: "",
  specification: "", location: "", service_details: "", notes: "", condition: "Good", quarantine_reason: "",
};
type Kind = (typeof FILE_KINDS)[number]["kind"];

export function EquipmentForm({ initial, onDone, onCancel }: { initial?: Equipment; onDone: (id: string) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const { data } = useStore();
  const [v, setV] = useState(() => (initial ? pick(initial) : empty));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [attach, setAttach] = useState<Record<Kind, File[]>>({ manual: [], software: [], file: [] });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const setVal = (k: keyof typeof empty) => (val: string) => setV((p) => ({ ...p, [k]: val, ...(k === "category_id" ? { subcategory_id: "" } : {}) }));

  const cats = (data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }));
  const subs = (data?.subcategories ?? []).filter((s) => s.category_id === v.category_id).map((s) => ({ value: s.id, label: s.name }));
  const depts = (data?.departments ?? []).map((c) => ({ value: c.id, label: c.name }));
  const sets = (data?.sets ?? []).map((c) => ({ value: c.id, label: c.name }));
  const existingFiles = initial ? (data?.files ?? []).filter((f) => f.equipment_id === initial.id) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.category_id) return void toast.error("Category is required");
    if (v.condition === "Quarantined" && !v.quarantine_reason.trim()) return void toast.error("Enter a reason for quarantine");
    setBusy(true);
    try {
      let photo_path = initial?.photo_path ?? null;
      if (file) photo_path = await uploadFile(file);
      const attachments = [];
      for (const k of FILE_KINDS) for (const f of attach[k.kind]) attachments.push({ kind: k.kind, name: f.name, path: await uploadFile(f) });
      const saved = await saveEquipment({
        data: {
          ...v, ...(initial ? { id: initial.id } : {}), photo_path, attachments,
          condition: v.condition as (typeof CONDITIONS)[number],
          subcategory_id: v.subcategory_id || null, department_id: v.department_id || null, set_id: v.set_id || null,
          quarantine_reason: v.condition === "Quarantined" ? v.quarantine_reason : "",
        },
      });
      await qc.invalidateQueries({ queryKey: ["store"] });
      toast.success(initial ? "Equipment updated" : `Registered ${saved.code}`);
      onDone(saved.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(id: string) {
    if (!confirm("Remove this file?")) return;
    try {
      await deleteEquipmentFile({ data: { id } });
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["store"] });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required><Combo value={v.category_id} onChange={setVal("category_id")} options={cats} placeholder="Select category" /></Field>
        <Field label="Sub Category"><Combo value={v.subcategory_id} onChange={setVal("subcategory_id")} options={subs} disabled={!v.category_id} placeholder={v.category_id ? "Select sub category" : "Choose category first"} /></Field>
        <Field label="Brand"><Input value={v.brand} onChange={set("brand")} /></Field>
        <Field label="Model"><Input value={v.model} onChange={set("model")} /></Field>
        <Field label="Serial No"><Input value={v.serial_no} onChange={set("serial_no")} /></Field>
        <Field label="Leads Store No"><Input value={v.store_no} onChange={set("store_no")} placeholder="e.g. LS-0012" /></Field>
        <Field label="Department"><Combo value={v.department_id} onChange={setVal("department_id")} options={depts} placeholder="Select department" /></Field>
        <Field label="Equipment Set"><Combo value={v.set_id} onChange={setVal("set_id")} options={sets} placeholder="Not part of a set" /></Field>
        <div className="sm:col-span-2"><Field label="Location in Leads Store"><Input value={v.location} onChange={set("location")} placeholder="e.g. Shelf A3" /></Field></div>
        <Field label="Condition of Equipment">
          <select value={v.condition} onChange={set("condition")} className={selectCls}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        {v.condition === "Quarantined" && <Field label="Reason for Quarantine" required><Input value={v.quarantine_reason} onChange={set("quarantine_reason")} placeholder="e.g. Calibration expired" /></Field>}
        <div className="sm:col-span-2"><Field label="Specification"><Textarea rows={4} value={v.specification} onChange={set("specification")} /></Field></div>
        <div className="sm:col-span-2"><Field label="Service Details"><Textarea rows={3} value={v.service_details} onChange={set("service_details")} /></Field></div>
        <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={3} value={v.notes} onChange={set("notes")} /></Field></div>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
          {FILE_KINDS.map((k) => (
            <div key={k.kind} className="space-y-2 rounded-lg border p-3">
              <div className="text-sm font-semibold">{k.label}</div>
              {existingFiles.filter((f) => f.kind === k.kind).map((f) => (
                <div key={f.id} className="flex items-center gap-1 text-xs">
                  <button type="button" className="flex-1 truncate text-left text-primary" onClick={() => openFile(f.path)}>{f.name}</button>
                  <button type="button" aria-label="Remove file" onClick={() => removeFile(f.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              ))}
              {attach[k.kind].map((f, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="flex-1 truncate">{f.name}</span>
                  <button type="button" aria-label="Remove" onClick={() => setAttach({ ...attach, [k.kind]: attach[k.kind].filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <label className="flex cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed p-2 text-xs text-primary hover:bg-accent">
                <Paperclip className="h-3.5 w-3.5" /> Attach files
                <input type="file" multiple className="hidden" onChange={(e) => {
                  const fs = Array.from(e.target.files ?? []);
                  setAttach((a) => ({ ...a, [k.kind]: [...a[k.kind], ...fs] }));
                  e.target.value = "";
                }} />
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <span className="text-sm font-semibold">Photo</span>
        {preview ? <img src={preview} alt="Preview" className="aspect-square w-full rounded-lg object-cover" /> : <Photo path={initial?.photo_path} className="aspect-square w-full" />}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-primary hover:bg-accent">
          <Upload className="h-4 w-4" /> {file ? file.name : "Upload photo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }} />
        </label>
      </div>
      <div className="flex justify-end gap-2 lg:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Register Equipment"}</Button>
      </div>
    </form>
  );
}

function pick(e: Equipment) {
  return {
    category_id: e.category_id ?? "", subcategory_id: e.subcategory_id ?? "", department_id: e.department_id ?? "", set_id: e.set_id ?? "",
    brand: e.brand, model: e.model, serial_no: e.serial_no, store_no: e.store_no, specification: e.specification, location: e.location,
    service_details: e.service_details, notes: e.notes, condition: e.condition, quarantine_reason: e.quarantine_reason,
  };
}
