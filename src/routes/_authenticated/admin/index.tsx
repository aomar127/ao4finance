import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuthHeaders } from "@/lib/auth";
import {
  createFirm as createFirmFn,
  deleteFirm as deleteFirmFn,
  updateFirmDesign as updateFirmDesignFn,
  listAdminDashboard,
} from "@/lib/admin.functions";
import { REPORT_DESIGNS, reportDesignName } from "@/lib/report-designs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Briefcase, Building2, ArrowLeft, Palette, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminFirmsPage,
});

const mkFirmParams = (firmId: string) => ({ firmId });

interface Firm {
  id: string;
  name: string;
  created_at: string;
  report_design?: string;
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
  const updateDesign = useServerFn(updateFirmDesignFn);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newName, setNewName] = useState("");
  const [design, setDesign] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designOpen, setDesignOpen] = useState<string | null>(null);
  const [designSaving, setDesignSaving] = useState(false);

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
    if (!design) {
      toast.error("يجب اختيار تصميم التقارير لهذا المكتب");
      return;
    }
    setSaving(true);
    try {
      await createFirm({
        headers: await getAuthHeaders(),
        data: { name: newName.trim(), report_design: design },
      });
      setNewName("");
      setDesign("");
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

  const toggleDesign = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDesignOpen((cur) => (cur === id ? null : id));
  };

  const chooseDesign = async (e: React.MouseEvent, firmId: string, designId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDesignSaving(true);
    try {
      await updateDesign({
        headers: await getAuthHeaders(),
        data: { id: firmId, report_design: designId },
      });
      toast.success("تم تحديث تصميم تقارير المكتب");
      setDesignOpen(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "فشل تحديث التصميم");
    } finally {
      setDesignSaving(false);
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
        <form onSubmit={add} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">اسم المكتب</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم المكتب / الشركة الأم"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <label className="text-sm font-medium">
                تصميم التقارير لهذا المكتب <span className="text-destructive">*</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              اختر نوع التصميم الذي سيُطبَّق على تقارير جميع عملاء هذا المكتب. (إلزامي)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {REPORT_DESIGNS.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => setDesign(d.id)}
                  className={`rounded-lg border p-4 text-right transition-all hover:border-primary ${
                    design === d.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{d.nameAr}</span>
                    <span className="text-xs text-muted-foreground">{d.nameEn}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {d.descAr}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving || !newName.trim() || !design}>
            <Plus className="ml-1 h-4 w-4" /> {saving ? "جاري..." : "إضافة المكتب"}
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
              params={mkFirmParams(f.id)}
              className="group block"
            >
              <Card className="relative h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="إدارة التصميم"
                      className={`h-8 w-8 p-0 ${
                        designOpen === f.id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                      onClick={(e) => toggleDesign(e, f.id)}
                    >
                      <Palette className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => del(e, f.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {designOpen === f.id && (
                  <div
                    className="absolute left-3 right-3 top-16 z-20 rounded-lg border bg-popover p-2 shadow-xl"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                      اختر تصميم تقارير هذا المكتب
                    </p>
                    <div className="space-y-1">
                      {REPORT_DESIGNS.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          disabled={designSaving}
                          onClick={(ev) => chooseDesign(ev, f.id, d.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-right text-sm transition-colors hover:bg-muted disabled:opacity-50 ${
                            (f.report_design || "ln") === d.id ? "bg-primary/10 text-primary" : ""
                          }`}
                        >
                          <span className="font-medium">{d.nameAr}</span>
                          {(f.report_design || "ln") === d.id && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <h3 className="mb-2 text-lg font-semibold leading-tight group-hover:text-primary">
                  {f.name}
                </h3>
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Palette className="h-3 w-3" />
                  {reportDesignName(f.report_design)}
                </div>
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
            <Link to="/admin/firm/$firmId" params={mkFirmParams("unassigned")} className="group block">
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
