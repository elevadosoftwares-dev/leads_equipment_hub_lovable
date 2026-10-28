import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Download, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignedUrl, type EquipStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { exportExcel } from "@/lib/excel";

const statusMap: Record<string, { label: string; cls: string }> = {
  available: { label: "Available", cls: "bg-success-soft text-success" },
  issued: { label: "Issued", cls: "bg-info-soft text-info" },
  calibration_due: { label: "Calibration Due", cls: "bg-warning-soft text-warning" },
  quarantined: { label: "Quarantined", cls: "bg-danger-soft text-danger" },
  ok: { label: "OK", cls: "bg-success-soft text-success" },
  due: { label: "Due Soon", cls: "bg-warning-soft text-warning" },
  expired: { label: "Expired", cls: "bg-danger-soft text-danger" },
  none: { label: "No record", cls: "bg-muted text-muted-foreground" },
  returned: { label: "Returned", cls: "bg-success-soft text-success" },
  out: { label: "Out", cls: "bg-info-soft text-info" },
  Good: { label: "Good", cls: "bg-success-soft text-success" },
  Spoiled: { label: "Spoiled", cls: "bg-warning-soft text-warning" },
  Quarantined: { label: "Quarantined", cls: "bg-danger-soft text-danger" },
};

export function StatusPill({ status }: { status: EquipStatus | string }) {
  const s = statusMap[status] ?? statusMap["none"]!;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}

export function PageHeader({
  title,
  back,
  actions,
}: {
  title: string;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {back}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Photo({
  path,
  className,
}: {
  path?: string | null | undefined;
  className?: string;
}) {
  const url = useSignedUrl(path);
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg bg-muted",
        className,
      )}
    >
      {url ? (
        <img src={url} alt="Equipment" className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-sm font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export const selectCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Searchable dropdown: type to filter, click to choose. */
export function Combo({
  value,
  onChange,
  options,
  placeholder = "Select…",
  allowClear = true,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-9 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {allowClear && value && (
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear selection
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ExportButton({
  name,
  rows,
}: {
  name: string;
  rows: () => Record<string, string | number | null | undefined>[];
}) {
  return (
    <Button type="button" variant="outline" onClick={() => exportExcel(name, rows())}>
      <Download className="h-4 w-4" /> Export to Excel
    </Button>
  );
}
