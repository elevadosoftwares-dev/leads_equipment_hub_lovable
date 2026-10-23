import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/lib/store";
import { useSession } from "@/lib/session";
import { adminCreateUser, adminDeleteUser, adminResetPassword, adminSetUserRole, listUsers } from "@/lib/users.functions";
import { Empty, Field, PageHeader, selectCls } from "@/components/store/ui";

export const Route = createFileRoute("/admins")({
  head: () => ({
    meta: [
      { title: "Master Admin · Store Management System" },
      { name: "description", content: "Manage staff accounts and choose which staff are Master Admins." },
      { property: "og:title", content: "Master Admin · Store Management System" },
      { property: "og:description", content: "Manage staff accounts and choose which staff are Master Admins." },
    ],
  }),
  component: AdminsPage,
});

const blank = { fullName: "", email: "", password: "", role: "user" as "admin" | "user" };

function AdminsPage() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const me = useSession().data?.userId;
  const { data: users } = useQuery({ queryKey: ["store", "users"], queryFn: () => listUsers() });
  const [draft, setDraft] = useState(blank);
  const refresh = () => qc.invalidateQueries({ queryKey: ["store", "users"] });

  async function run(work: () => Promise<unknown>, success?: string) {
    try {
      await work();
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    if (success) toast.success(success);
    refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await run(() => adminCreateUser({ data: draft }), "Staff account created");
    setDraft(blank);
  }

  function resetPassword(id: string, email: string) {
    const password = prompt(`New password for ${email} (at least 8 characters):`);
    if (password) void run(() => adminResetPassword({ data: { userId: id, password } }), "Password changed");
  }

  function remove(id: string, email: string) {
    if (confirm(`Remove the account ${email}?`)) void run(() => adminDeleteUser({ data: { userId: id } }), "Account removed");
  }

  return (
    <>
      <PageHeader title="Master Admin" />
      <p className="mb-4 text-sm text-muted-foreground">Only Master Admins can add staff accounts, delete equipment from the store or change who is an admin.</p>
      {isAdmin && (
        <form onSubmit={add} className="panel mb-6 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-48 flex-1"><Field label="Full Name" required><Input required value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} /></Field></div>
          <div className="min-w-48 flex-1"><Field label="Email" required><Input type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field></div>
          <div className="min-w-40 flex-1"><Field label="Password" required><Input type="password" required minLength={8} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></Field></div>
          <div className="min-w-40"><Field label="Role">
            <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as "admin" | "user" })} className={selectCls}>
              <option value="user">Staff</option>
              <option value="admin">Master Admin</option>
            </select>
          </Field></div>
          <Button type="submit"><Plus className="h-4 w-4" /> Add Staff</Button>
        </form>
      )}
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Staff Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {(users ?? []).map((u) => {
              const admin = u.role === "admin";
              return (
                <tr key={u.id}>
                  <td className="font-medium">{u.full_name || "—"}{u.id === me && " (you)"}</td>
                  <td>{u.email}</td>
                  <td>{admin ? <span className="font-semibold text-primary">Master Admin</span> : "Staff"}</td>
                  <td className="whitespace-nowrap">{isAdmin && (
                    <div className="flex items-center gap-1">
                      {u.id !== me && (
                        <Button size="sm" variant={admin ? "outline" : "default"} onClick={() => run(() => adminSetUserRole({ data: { userId: u.id, role: admin ? "user" : "admin" } }))}>
                          {admin ? "Remove admin" : "Make Master Admin"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label="Change password" onClick={() => resetPassword(u.id, u.email)}><KeyRound className="h-4 w-4 text-primary" /></Button>
                      {u.id !== me && <Button size="icon" variant="ghost" aria-label="Remove account" onClick={() => remove(u.id, u.email)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  )}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users?.length === 0 && <Empty>No staff yet.</Empty>}
      </div>
    </>
  );
}
