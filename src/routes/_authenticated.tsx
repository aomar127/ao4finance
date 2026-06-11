import { createFileRoute, Outlet, Link, useNavigate, useMatches } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Users, LayoutDashboard, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function FirmSwitcher() {
  const navigate = useNavigate();
  const matches = useMatches();
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]);
  const [companyFirmMap, setCompanyFirmMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase.from("firms").select("id, name").order("name"),
        supabase.from("companies").select("id, firm_id"),
      ]);
      if (cancelled) return;
      setFirms(f || []);
      const map: Record<string, string | null> = {};
      (c || []).forEach((row: any) => {
        map[row.id] = row.firm_id || null;
      });
      setCompanyFirmMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // استخراج firmId من المسار، إما مباشرة أو عبر companyId
  const currentFirmId = useMemo(() => {
    for (const m of matches) {
      const p = m.params as Record<string, string | undefined>;
      if (p?.firmId) return p.firmId;
      if (p?.companyId) {
        const fid = companyFirmMap[p.companyId];
        return fid || "unassigned";
      }
    }
    return "__all__";
  }, [matches, companyFirmMap]);

  const handleChange = (value: string) => {
    if (value === "__all__") {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/admin/firm/$firmId", params: { firmId: value } });
    }
  };

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={currentFirmId} onValueChange={handleChange}>
        <SelectTrigger className="h-8 min-w-[180px] text-sm">
          <SelectValue placeholder="اختر مكتب" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">كل المكاتب</SelectItem>
          {firms.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
          <SelectItem value="unassigned">عملاء بدون مكتب</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function AuthenticatedLayout() {
  const { loading, user, role } = useAuth();
  const navigate = useNavigate();
  const [checkingSub, setCheckingSub] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!user) return;
    // فحص الاشتراك (المسؤول معفي)
    if (role === "admin") {
      if (!cancelled) setCheckingSub(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("subscription_start, subscription_end")
        .eq("id", user.id)
        .maybeSingle();
      const now = new Date();
      const start = data?.subscription_start ? new Date(data.subscription_start) : null;
      const end = data?.subscription_end ? new Date(data.subscription_end) : null;
      if ((start && start > now) || (end && end < now)) {
        toast.error("اشتراكك غير ساري. تواصل مع الإدارة.");
        await supabase.auth.signOut();
        navigate({ to: "/login", replace: true });
        return;
      }
      if (!cancelled) setCheckingSub(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, role, navigate]);

  if (loading || (user && role !== "admin" && checkingSub)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold text-primary">
              لغة الأرقام
            </Link>
            {role === "admin" && (
              <nav className="flex gap-1 text-sm">
                <Link
                  to="/admin"
                  className="rounded-md px-3 py-1.5 transition-colors hover:bg-primary/10"
                  activeProps={{ className: "rounded-md px-3 py-1.5 bg-primary/10 text-primary font-semibold" }}
                  activeOptions={{ exact: true }}
                >
                  <LayoutDashboard className="ml-1 inline h-4 w-4" />
                  المكاتب
                </Link>
                <Link
                  to="/admin/users"
                  className="rounded-md px-3 py-1.5 transition-colors hover:bg-primary/10"
                  activeProps={{ className: "rounded-md px-3 py-1.5 bg-primary/10 text-primary font-semibold" }}
                >
                  <Users className="ml-1 inline h-4 w-4" />
                  المستخدمون
                </Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            {role === "admin" && <FirmSwitcher />}
            <span className="hidden text-sm text-muted-foreground md:inline">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="ml-1 h-4 w-4" /> خروج
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
