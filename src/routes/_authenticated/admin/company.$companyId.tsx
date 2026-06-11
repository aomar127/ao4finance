import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuthHeaders } from "@/lib/auth";
import {
  createReport as createReportFn,
  deleteReport as deleteReportFn,
  listAdminDashboard,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Building2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/company/$companyId")({
  component: AdminCompanyPage,
});

interface Company {
  id: string;
  name: string;
  firm_id: string | null;
  created_at: string;
}
interface Firm {
  id: string;
  name: string;
}
interface Report {
  id: string;
  company_id: string;
  title: string;
  period: string | null;
  updated_at: string;
}

function AdminCompanyPage() {
  const { companyId } = Route.useParams();
  const navigate = useNavigate();
  const listDashboard = useServerFn(listAdminDashboard);
  const createReport = useServerFn(createReportFn);
  const removeReport = useServerFn(deleteReportFn);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const company = useMemo(() => companies.find((c) => c.id === companyId), [companies, companyId]);
  const firm = useMemo(
    () => (company?.firm_id ? firms.find((f) => f.id === company.firm_id) : null),
    [firms, company],
  );
  const companyReports = useMemo(
    () => reports.filter((r) => r.company_id === companyId),
    [reports, companyId],
  );

  const reload = async () => {
    setLoading(true);
    try {
      const dashboard = await listDashboard({ headers: await getAuthHeaders() });
      setFirms(dashboard.firms as Firm[]);
      setCompanies(dashboard.companies as Company[]);
      setReports(dashboard.reports as Report[]);
    } catch (e: any) {
      toast.error(e?.message || "فشل التحميل");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, [companyId]);

  const newReport = async () => {
    try {
      const data = await createReport({
        headers: await getAuthHeaders(),
        data: { company_id: companyId },
      });
      navigate({ to: "/admin/report/$reportId", params: { reportId: data.id } });
    } catch (e: any) {
      toast.error(e?.message || "فشل إنشاء التقرير");
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("حذف التقرير؟")) return;
    try {
      await removeReport({ headers: await getAuthHeaders(), data: { id } });
      toast.success("تم حذف التقرير");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "فشل حذف التقرير");
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">جاري التحميل...</p>;
  }
  if (!company) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-muted-foreground">الشركة غير موجودة.</p>
        <Link to="/admin">
          <Button variant="outline">العودة للشركات</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin" className="hover:text-primary">المكاتب</Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        {firm ? (
          <Link
            to="/admin/firm/$firmId"
            params={{ firmId: firm.id }}
            className="hover:text-primary"
          >
            {firm.name}
          </Link>
        ) : (
          <Link
            to="/admin/firm/$firmId"
            params={{ firmId: "unassigned" }}
            className="hover:text-primary"
          >
            عملاء بدون مكتب
          </Link>
        )}
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="font-medium text-foreground">{company.name}</span>
      </nav>

      <Card className="bg-gradient-to-l from-primary/5 to-transparent p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <p className="text-sm text-muted-foreground">
                {companyReports.length} تقرير
              </p>
            </div>
          </div>
          <Button onClick={newReport} size="lg">
            <Plus className="ml-1 h-5 w-5" /> تقرير جديد
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-1 rounded bg-primary" />
          <h2 className="text-lg font-semibold">تقارير الشركة</h2>
        </div>
        {companyReports.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="mb-4 text-muted-foreground">لا توجد تقارير لهذه الشركة بعد.</p>
            <Button onClick={newReport}>
              <Plus className="ml-1 h-4 w-4" /> إنشاء أول تقرير
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {companyReports.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {r.period && <span>({r.period})</span>}
                      <span>آخر تحديث: {new Date(r.updated_at).toLocaleString("ar")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to="/admin/report/$reportId" params={{ reportId: r.id }}>
                    <Button size="sm" variant="outline">تحرير</Button>
                  </Link>
                  <Button size="sm" variant="destructive" onClick={() => deleteReport(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
