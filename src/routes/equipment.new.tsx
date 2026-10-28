import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EquipmentForm } from "@/components/store/EquipmentForm";
import { PageHeader } from "@/components/store/ui";

export const Route = createFileRoute("/equipment/new")({
  head: () => ({
    meta: [
      { title: "Register Equipment · Store Management System" },
      { name: "description", content: "Register incoming equipment into the Leads store." },
      { property: "og:title", content: "Register Equipment · Store Management System" },
      { property: "og:description", content: "Register incoming equipment into the Leads store." },
    ],
  }),
  component: NewEquipment,
});

function NewEquipment() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Register New Equipment"
        back={
          <Link to="/equipment" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
      />
      <div className="panel p-6">
        <EquipmentForm
          onDone={(id) => navigate({ to: "/equipment/$id", params: { id } })}
          onCancel={() => navigate({ to: "/equipment" })}
        />
      </div>
    </>
  );
}
