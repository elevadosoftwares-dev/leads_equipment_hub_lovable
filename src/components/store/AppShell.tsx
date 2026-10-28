import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Boxes,
  Gauge,
  ClipboardList,
  Search,
  LogOut,
  FileSpreadsheet,
  Tags,
  Tag,
  Building2,
  HardHat,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { signIn, signOut, signUp } from "@/lib/auth.functions";
import { useSession } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./ui";
import logo from "@/assets/leads-logo.png";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/equipment", label: "Equipment", icon: Boxes },
  { to: "/calibration", label: "Calibration", icon: Gauge },
  { to: "/issuance", label: "Issuance", icon: ClipboardList },
  { to: "/search", label: "Search", icon: Search },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet },
] as const;

const masters = [
  { to: "/masters/categories", label: "Master Category", icon: Tags },
  { to: "/masters/subcategories", label: "Master Sub Category", icon: Tag },
  { to: "/masters/departments", label: "Master Department", icon: Building2 },
  { to: "/masters/technicians", label: "Master Technicians", icon: HardHat },
  { to: "/sets", label: "Equipment Sets", icon: Layers },
  { to: "/admins", label: "Master Admin", icon: ShieldCheck },
] as const;

function Logo() {
  return (
    <div className="rounded-xl bg-card px-3 py-2 text-center">
      <img
        src={logo}
        alt="Leads"
        width={600}
        height={286}
        className="mx-auto h-14 w-auto object-contain"
      />
      <div className="mt-1 text-xs font-bold tracking-wide text-primary">
        Store Management System
      </div>
    </div>
  );
}

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") await signUp({ data: { email, password } });
      await signIn({ data: { email, password } });
      // Refetch the session (and everything else) as the new user.
      await qc.resetQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gradient-nav flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-5 p-8">
        <Logo />
        <div>
          <h1 className="text-xl font-bold">Store Management System</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "in" ? "Sign in to continue" : "Create a staff account"}
          </p>
        </div>
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "in" ? "Sign in" : "Create account"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-primary"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session, isLoading } = useSession();
  const qc = useQueryClient();

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!session) return <Login />;

  const email = session.email;
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="gradient-nav sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto p-4 md:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-nav-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "!bg-nav-active !text-primary-foreground" }}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
          <div className="mt-4 mb-1 px-3 text-xs font-bold tracking-wider text-nav-foreground/60 uppercase">
            Masters
          </div>
          {masters.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-nav-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "!bg-nav-active !text-primary-foreground" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-card px-6 py-3">
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {[...nav, ...masters].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-label={n.label}
                className="rounded-md p-2 text-muted-foreground"
                activeProps={{ className: "!text-primary" }}
              >
                <n.icon className="h-5 w-5" />
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {initials}
            </span>
            <span className="hidden text-sm font-medium sm:block">{email}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await signOut();
                // Refetch the now-empty session so the sign-in form shows; drops cached data too.
                await qc.resetQueries();
              }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
