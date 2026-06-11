import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuthHeaders } from "@/lib/auth";
import {
  createFirm as createFirmFn,
  deleteFirm as deleteFirmFn,
  listAdminDashboard,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Briefcase, Building2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminFirmsPage,
});

interface Firm {
  id: string;
  name: string;
  created_at: string;
}
interface Company {
  id: string;
  name: string;
  firm_id: string | null;
  created_at: string;
}

function AdminFirmsPage() {
  const listDashboard = useServerFn(listAdminDashboard);
  const createFirm = useServerFn(createFirmFn);
  const removeFirm = useServerFn(deleteFirmFn);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const dashboard = await listDashboard({ headers: await getAuthHeaders() });
      setFirms(dashboard.firms as Firm[]);
      setCompanies(dashboard.companies as Company[]);
    } catch (e: any) {
      toast.error(e?.message || "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createFirm({ headers: await getAuthHeaders(), data: { name: newName.trim() } });
      setNewName("");
      toast.success("تمت إضافة المكتب");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "فشلت الإضافة");
    } finally {
      setSaving(false);
    }
  };

  const del = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("حذف المكتب؟ (الشركات العميلة المرتبطة لن تُحذف لكنها ستفقد ارتباطها)")) return;
    try {
      await removeFirm({ headers: await getAuthHeaders(), data: { id } });
      toast.success("تم الحذف");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحذف");
    }
  };

  const countCompanies = (firmId: string) =>
    companies.filter((c) => c.firm_id === firmId).length;
  const unassignedCount = companies.filter((c) => !c.firm_id).length;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-1 rounded bg-primary" />
          <h2 className="text-lg font-semibold">إضافة مكتب جديد</h2>
        </div>
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم المكتب / الشركة الأم"
          />
          <Button type="submit" disabled={saving}>
            <Plus className="ml-1 h-4 w-4" /> {saving ? "جاري..." : "إضافة"}
          </Button>
        </form>
      </Card>

      <div className="flex items-center gap-2">
        <div className="h-8 w-1 rounded bg-primary" />
        <h2 className="text-lg font-semibold">المكاتب</h2>
        <span className="text-sm text-muted-foreground">
          ({firms.length} مكتب) — اضغط على مكتب لإدارة عملائه
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : firms.length === 0 && unassignedCount === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">لا توجد مكاتب بعد. أضف أول مكتب من الأعلى.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {firms.map((f) => (
            <Link
              key={f.id}
              to="/admin/firm/$firmId"
              params={{ firmId: f.id }}
              className="group block"
            >
              <Card className="relative h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={(e) => del(e, f.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="mb-2 text-lg font-semibold leading-tight group-hover:text-primary">
                  {f.name}
                </h3>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {countCompanies(f.id)} عميل
                  </span>
                  <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    دخول <ArrowLeft className="h-4 w-4" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          {unassignedCount > 0 && (
            <Link to="/admin/firm/$firmId" params={{ firmId: "unassigned" }} className="group block">
              <Card className="relative h-full border-dashed p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold leading-tight group-hover:text-primary">
                  عملاء بدون مكتب
                </h3>
                <div className="text-sm text-muted-foreground">
                  {unassignedCount} عميل غير مرتبط بأي مكتب
                </div>
              </Card>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
