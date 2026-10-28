import { createFileRoute } from "@tanstack/react-router";
import { lookups, useStore } from "@/lib/store";
import { MasterList } from "@/components/store/MasterList";
import { Combo } from "@/components/store/ui";

export const Route = createFileRoute("/masters/subcategories")({
  head: () => ({
    meta: [
      { title: "Master Sub Category · Store Management System" },
      { name: "description", content: "Manage equipment sub categories under each category." },
      { property: "og:title", content: "Master Sub Category · Store Management System" },
      {
        property: "og:description",
        content: "Manage equipment sub categories under each category.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { data } = useStore();
  const L = lookups(data);
  const cats = (data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }));
  return (
    <MasterList
      title="Master Sub Category"
      table="subcategories"
      rows={data?.subcategories ?? []}
      cols={[
        { key: "name", label: "Sub Category Name" },
        {
          key: "category_id",
          label: "Category",
          render: (v, set) => (
            <Combo
              value={v}
              onChange={set}
              options={cats}
              placeholder="Select category"
              allowClear={false}
            />
          ),
          show: (r) => L.cat(r["category_id"] as string),
        },
      ]}
    />
  );
}
