import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { MasterList } from "@/components/store/MasterList";

export const Route = createFileRoute("/masters/categories")({
  head: () => ({
    meta: [
      { title: "Master Category · Store Management System" },
      { name: "description", content: "Manage equipment categories." },
      { property: "og:title", content: "Master Category · Store Management System" },
      { property: "og:description", content: "Manage equipment categories." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useStore();
  return (
    <MasterList
      title="Master Category"
      table="categories"
      rows={data?.categories ?? []}
      cols={[{ key: "name", label: "Category Name" }]}
    />
  );
}
