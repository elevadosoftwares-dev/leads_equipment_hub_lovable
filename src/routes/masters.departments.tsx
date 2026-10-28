import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { MasterList } from "@/components/store/MasterList";

export const Route = createFileRoute("/masters/departments")({
  head: () => ({
    meta: [
      { title: "Master Department · Store Management System" },
      { name: "description", content: "Manage the list of departments." },
      { property: "og:title", content: "Master Department · Store Management System" },
      { property: "og:description", content: "Manage the list of departments." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useStore();
  return (
    <MasterList
      title="Master Department"
      table="departments"
      rows={data?.departments ?? []}
      cols={[{ key: "name", label: "Department Name" }]}
    />
  );
}
