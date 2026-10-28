import { createFileRoute } from "@tanstack/react-router";
import { lookups, useStore } from "@/lib/store";
import { MasterList } from "@/components/store/MasterList";
import { Combo } from "@/components/store/ui";

export const Route = createFileRoute("/masters/technicians")({
  head: () => ({
    meta: [
      { title: "Master Technicians · Store Management System" },
      { name: "description", content: "Manage the master list of technicians." },
      { property: "og:title", content: "Master Technicians · Store Management System" },
      { property: "og:description", content: "Manage the master list of technicians." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useStore();
  const L = lookups(data);
  const depts = (data?.departments ?? []).map((c) => ({ value: c.id, label: c.name }));
  return (
    <MasterList
      title="Master Technicians"
      table="technicians"
      rows={data?.technicians ?? []}
      cols={[
        { key: "name", label: "Technician Name" },
        { key: "employee_no", label: "Employee No" },
        {
          key: "department_id",
          label: "Department",
          render: (v, set) => (
            <Combo value={v} onChange={set} options={depts} placeholder="Select department" />
          ),
          show: (r) => L.dept(r["department_id"] as string),
        },
        { key: "phone", label: "Phone" },
      ]}
    />
  );
}
