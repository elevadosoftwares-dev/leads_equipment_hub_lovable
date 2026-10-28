import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listStaff, setMasterAdmin } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/store";
import { Empty, PageHeader } from "@/components/store/ui";

export const Route = createFileRoute("/admins")({
  head: () => ({
    meta: [
      { title: "Master Admin · Store Management System" },
      { name: "description", content: "Choose which staff are Master Admins." },
      { property: "og:title", content: "Master Admin · Store Management System" },
      { property: "og:description", content: "Choose which staff are Master Admins." },
    ],
  }),
  component: AdminsPage,
});

function AdminsPage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const { data } = useQuery({
    queryKey: ["store", "users"],
    queryFn: async () => {
      const { users, me } = await listStaff();
      return { users, admins: new Set(users.filter((u) => u.isAdmin).map((u) => u.id)), me };
    },
  });

  async function toggle(id: string, makeAdmin: boolean) {
    try {
      await setMasterAdmin({ data: { userId: id, admin: makeAdmin } });
    } catch (e) {
      return void toast.error((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["store"] });
  }

  return (
    <>
      <PageHeader title="Master Admin" />
      <p className="mb-4 text-sm text-muted-foreground">
        Only Master Admins can delete equipment from the store or change who is an admin.
      </p>
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => {
              const admin = data!.admins.has(u.id);
              return (
                <tr key={u.id}>
                  <td className="font-medium">
                    {u.email}
                    {u.id === data!.me && " (you)"}
                  </td>
                  <td>
                    {admin ? (
                      <span className="font-semibold text-primary">Master Admin</span>
                    ) : (
                      "Staff"
                    )}
                  </td>
                  <td>
                    {isAdmin && u.id !== data!.me && (
                      <Button
                        size="sm"
                        variant={admin ? "outline" : "default"}
                        onClick={() => toggle(u.id, !admin)}
                      >
                        {admin ? "Remove admin" : "Make Master Admin"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data?.users.length === 0 && <Empty>No staff yet.</Empty>}
      </div>
    </>
  );
}
