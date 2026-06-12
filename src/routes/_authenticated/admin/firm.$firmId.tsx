import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuthHeaders } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createCompany as createCompanyFn,
  deleteCompany as deleteCompanyFn,
  moveCompany as moveCompanyFn,
  updateFirmBrand as updateFirmBrandFn,
  updateFirmDesign as updateFirmDesignFn,
  listAdminDashboard,
} from "@/lib/admin.functions";
import { REPORT_DESIGNS } from "@/lib/report-designs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Building2,
  FileText,
  ArrowLeft,
  Briefcase,
  ChevronRight,
  ArrowRightLeft,
  Palette,
  Upload,
  LayoutTemplate,
  Check,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/firm/$firmId")({
  component: AdminFirmPage,
});

interface Firm {
  id: string;
  name: string;
  brand_name_ar?: string | null;
  brand_name_en?: string | null;
  brand_tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  dark_color?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  report_design?: string | null;
}
interface Company {
  id: string;
  name: string;
  firm_id: string | null;
}
interface Report {
  id: string;
  company_id: string;
}

const EMPTY_BRAND = {
  brand_name_ar: "",
  brand_name_en: "",
  brand_tagline: "",
  logo_url: "",
  primary_color: "#1E5392",
  accent_color: "#C8392E",
  dark_color: "#15406F",
  contact_phone: "",
  contact_email: "",
  contact_address: "",
};

function AdminFirmPage() {
  const { firmId } = Route.useParams();
  const isUnassigned = firmId === "unassigned";
  const listDashboard = useServerFn(listAdminDashboard);
  const createCompany = useServerFn(createCompanyFn);
  const removeCompany = useServerFn(deleteCompanyFn);
  const moveCompany = useServerFn(moveCompanyFn);
  const updateBrand = useServerFn(updateFirmBrandFn);
  const updateDesign = useServerFn(updateFirmDesignFn);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Company | null>(null);
  const [moveFirmId, setMoveFirmId] = useState<string>("unassigned");
  const [moving, setMoving] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandForm, setBrandForm] = useState({ ...EMPTY_BRAND });
  const [brandSaving, setBrandSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [designSaving, setDesignSaving] = useState<string | null>(null);


  const firm = useMemo(
    () => (isUnassigned ? null : firms.find((f) => f.id === firmId)),
    [firms, firmId, isUnassigned],
  );
  const firmCompanies = useMemo(
    () =>
      isUnassigned
        ? companies.filter((c) => !c.firm_id)
        : companies.filter((c) => c.firm_id === firmId),
    [companies, firmId, isUnassigned],
  );

  const reload = async () => {
    setLoading(true);
    try {
      const dashboard = await listDashboard({ headers: await getAuthHeaders() });
      setFirms(dashboard.firms as Firm[]);
      setCompanies(dashboard.companies as Company[]);
      setReports(dashboard.reports as Report[]);
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644 \u0627\u0644\u062a\u062d\u0645\u064a\u0644");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, [firmId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createCompany({
        headers: await getAuthHeaders(),
        data: {
          name: newName.trim(),
          firm_id: isUnassigned ? null : firmId,
        },
      });
      setNewName("");
      toast.success("\u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0645\u064a\u0644");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644\u062a \u0627\u0644\u0625\u0636\u0627\u0641\u0629");
    } finally {
      setSaving(false);
    }
  };

  const del = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("\u062d\u0630\u0641 \u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0639\u0645\u064a\u0644\u0629 \u0648\u062c\u0645\u064a\u0639 \u062a\u0642\u0627\u0631\u064a\u0631\u0647\u0627\u061f")) return;
    try {
      await removeCompany({ headers: await getAuthHeaders(), data: { id } });
      toast.success("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644 \u0627\u0644\u062d\u0630\u0641");
    }
  };

  const openMove = (e: React.MouseEvent, company: Company) => {
    e.preventDefault();
    e.stopPropagation();
    setMoveTarget(company);
    setMoveFirmId(company.firm_id || "unassigned");
  };

  const confirmMove = async () => {
    if (!moveTarget) return;
    const newFirmId = moveFirmId === "unassigned" ? null : moveFirmId;
    if ((moveTarget.firm_id || null) === newFirmId) {
      setMoveTarget(null);
      return;
    }
    setMoving(true);
    try {
      await moveCompany({
        headers: await getAuthHeaders(),
        data: { id: moveTarget.id, firm_id: newFirmId },
      });
      toast.success("\u062a\u0645 \u0646\u0642\u0644 \u0627\u0644\u0639\u0645\u064a\u0644");
      setMoveTarget(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644 \u0627\u0644\u0646\u0642\u0644");
    } finally {
      setMoving(false);
    }
  };

  const changeDesign = async (designId: string) => {
    if (!firm || (firm.report_design || "ln") === designId) return;
    setDesignSaving(designId);
    try {
      await updateDesign({
        headers: await getAuthHeaders(),
        data: { id: firm.id, report_design: designId },
      });
      toast.success("\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u062a\u0635\u0645\u064a\u0645 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062a\u0635\u0645\u064a\u0645");
    } finally {
      setDesignSaving(null);
    }
  };

  const openBrand = () => {
    if (!firm) return;
    setBrandForm({
      brand_name_ar: firm.brand_name_ar || "",
      brand_name_en: firm.brand_name_en || "",
      brand_tagline: firm.brand_tagline || "",
      logo_url: firm.logo_url || "",
      primary_color: firm.primary_color || "#1E5392",
      accent_color: firm.accent_color || "#C8392E",
      dark_color: firm.dark_color || "#15406F",
      contact_phone: firm.contact_phone || "",
      contact_email: firm.contact_email || "",
      contact_address: firm.contact_address || "",
    });
    setBrandOpen(true);
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${firmId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("firm-brands").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("firm-brands").getPublicUrl(path);
      setBrandForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u0644\u0648\u062c\u0648");
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644 \u0631\u0641\u0639 \u0627\u0644\u0644\u0648\u062c\u0648");
    } finally {
      setUploading(false);
    }
  };

  const saveBrand = async () => {
    if (!firm) return;
    setBrandSaving(true);
    try {
      await updateBrand({ headers: await getAuthHeaders(), data: { id: firm.id, ...brandForm } });
      toast.success("\u062a\u0645 \u062d\u0641\u0638 \u0647\u0648\u064a\u0629 \u0627\u0644\u0645\u0643\u062a\u0628");
      setBrandOpen(false);
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "\u0641\u0634\u0644 \u0627\u0644\u062d\u0641\u0638");
    } finally {
      setBrandSaving(false);
    }
  };

  const countReports = (companyId: string) =>
    reports.filter((r) => r.company_id === companyId).length;

  if (loading) {
    return <p className="text-muted-foreground">\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...</p>;
  }
  if (!isUnassigned && !firm) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-muted-foreground">\u0627\u0644\u0645\u0643\u062a\u0628 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f.</p>
        <Link to="/admin">
          <Button variant="outline">\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0645\u0643\u0627\u062a\u0628</Button>
        </Link>
      </Card>
    );
  }

  const title = isUnassigned ? "\u0639\u0645\u0644\u0627\u0621 \u0628\u062f\u0648\u0646 \u0645\u0643\u062a\u0628" : firm!.name;
  const activeDesign = firm?.report_design || "ln";

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/admin" className="hover:text-primary">\u0627\u0644\u0645\u0643\u0627\u062a\u0628</Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <Card className="bg-gradient-to-l from-primary/5 to-transparent p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary overflow-hidden">
              {firm?.logo_url ? (
                <img src={firm.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Briefcase className="h-6 w-6" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {firmCompanies.length} \u0639\u0645\u064a\u0644
              </p>
            </div>
          </div>
          {!isUnassigned && firm && (
            <Button variant="outline" onClick={openBrand}>
              <Palette className="ml-1 h-4 w-4" /> \u0647\u0648\u064a\u0629 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631
            </Button>
          )}
        </div>
      </Card>

      {!isUnassigned && firm && (
        <Card className="p-6">
          <div className="mb-2 flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">\u062a\u0635\u0645\u064a\u0645 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0627\u0644\u0645\u0627\u0644\u064a\u0629</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            \u064a\u064f\u0637\u0628\u0651\u0642 \u0647\u0630\u0627 \u0627\u0644\u062a\u0635\u0645\u064a\u0645 \u0639\u0644\u0649 \u062a\u0642\u0627\u0631\u064a\u0631 \u062c\u0645\u064a\u0639 \u0639\u0645\u0644\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0645\u0643\u062a\u0628.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_DESIGNS.map((d) => {
              const active = activeDesign === d.id;
              const busy = designSaving === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={!!designSaving}
                  onClick={() => changeDesign(d.id)}
                  className={`rounded-lg border p-4 text-right transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50 hover:-translate-y-0.5"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{d.nameAr}</span>
                    {active ? (
                      <span className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        <Check className="h-3 w-3" /> \u0645\u0641\u0639\u0651\u0644
                      </span>
                    ) : busy ? (
                      <span className="text-xs text-muted-foreground">\u062c\u0627\u0631\u064a...</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{d.nameEn}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.descAr}</p>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {!isUnassigned && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-8 w-1 rounded bg-primary" />
            <h2 className="text-lg font-semibold">\u0625\u0636\u0627\u0641\u0629 \u0634\u0631\u0643\u0629 \u0639\u0645\u064a\u0644\u0629</h2>
          </div>
          <form onSubmit={add} className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u0639\u0645\u064a\u0644\u0629"
            />
            <Button type="submit" disabled={saving}>
              <Plus className="ml-1 h-4 w-4" /> {saving ? "\u062c\u0627\u0631\u064a..." : "\u0625\u0636\u0627\u0641\u0629"}
            </Button>
          </form>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <div className="h-8 w-1 rounded bg-primary" />
        <h2 className="text-lg font-semibold">\u0627\u0644\u0639\u0645\u0644\u0627\u0621</h2>
        <span className="text-sm text-muted-foreground">
          \u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0639\u0645\u064a\u0644 \u0644\u0625\u062f\u0627\u0631\u0629 \u062a\u0642\u0627\u0631\u064a\u0631\u0647 \u0648\u0628\u064a\u0627\u0646\u0627\u062a\u0647
        </span>
      </div>

      {firmCompanies.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {isUnassigned
              ? "\u0644\u0627 \u064a\u0648\u062c\u062f \u0639\u0645\u0644\u0627\u0621 \u0628\u062f\u0648\u0646 \u0627\u0631\u062a\u0628\u0627\u0637."
              : "\u0644\u0627 \u064a\u0648\u062c\u062f \u0639\u0645\u0644\u0627\u0621 \u0628\u0639\u062f. \u0623\u0636\u0641 \u0623\u0648\u0644 \u0639\u0645\u064a\u0644 \u0645\u0646 \u0627\u0644\u0623\u0639\u0644\u0649."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {firmCompanies.map((c) => {
            const companyParams = { companyId: c.id };
            return (
            <Link
              key={c.id}
              to="/admin/company/$companyId"
              params={companyParams}
              className="group block"
            >
              <Card className="relative h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="\u0646\u0642\u0644 \u0625\u0644\u0649 \u0645\u0643\u062a\u0628 \u0622\u062e\u0631"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      onClick={(e) => openMove(e, c)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="\u062d\u0630\u0641"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => del(e, c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                </div>
                <h3 className="mb-2 text-lg font-semibold leading-tight group-hover:text-primary">
                  {c.name}
                </h3>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {countReports(c.id)} \u062a\u0642\u0631\u064a\u0631
                  </span>
                  <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    \u062f\u062e\u0648\u0644 <ArrowLeft className="h-4 w-4" />
                  </span>
                </div>
              </Card>
            </Link>
            );
          })}
        </div>
      )}

      <Dialog open={!!moveTarget} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>\u0646\u0642\u0644 \u0627\u0644\u0639\u0645\u064a\u0644 \u0625\u0644\u0649 \u0645\u0643\u062a\u0628 \u0622\u062e\u0631</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              \u0627\u0644\u0639\u0645\u064a\u0644: <span className="font-semibold text-foreground">{moveTarget?.name}</span>
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0645\u0643\u062a\u0628 \u0627\u0644\u062c\u062f\u064a\u062f</label>
              <Select value={moveFirmId} onValueChange={setMoveFirmId}>
                <SelectTrigger>
                  <SelectValue placeholder="\u0627\u062e\u062a\u0631 \u0645\u0643\u062a\u0628\u0627\u064b" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">\u0628\u062f\u0648\u0646 \u0645\u0643\u062a\u0628</SelectItem>
                  {firms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={moving}>
              \u0625\u0644\u063a\u0627\u0621
            </Button>
            <Button onClick={confirmMove} disabled={moving}>
              {moving ? "\u062c\u0627\u0631\u064a \u0627\u0644\u0646\u0642\u0644..." : "\u0646\u0642\u0644"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>\u0647\u0648\u064a\u0629 \u062a\u0642\u0627\u0631\u064a\u0631 \u0627\u0644\u0645\u0643\u062a\u0628</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">\u0627\u0644\u0644\u0648\u062c\u0648</label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {brandForm.logo_url ? (
                    <img src={brandForm.logo_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleLogoUpload(f);
                    }}
                  />
                  <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" />
                    {uploading ? "\u062c\u0627\u0631\u064a \u0627\u0644\u0631\u0641\u0639..." : "\u0631\u0641\u0639 \u0644\u0648\u062c\u0648"}
                  </span>
                </label>
                {brandForm.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => setBrandForm((f) => ({ ...f, logo_url: "" }))}>
                    \u0625\u0632\u0627\u0644\u0629
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629</label>
              <Input value={brandForm.brand_name_ar} onChange={(e) => setBrandForm((f) => ({ ...f, brand_name_ar: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629</label>
              <Input value={brandForm.brand_name_en} onChange={(e) => setBrandForm((f) => ({ ...f, brand_name_en: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">\u0627\u0644\u0634\u0639\u0627\u0631 \u0627\u0644\u0646\u0635\u064a (Tagline)</label>
              <Input value={brandForm.brand_tagline} onChange={(e) => setBrandForm((f) => ({ ...f, brand_tagline: e.target.value }))} placeholder="\u0645\u062b\u0627\u0644: \u0636\u0631\u0627\u0626\u0628 \u00b7 \u0645\u0627\u0644\u064a\u0629 \u00b7 \u0645\u062d\u0627\u0633\u0628\u0629" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0644\u0648\u0646 \u0627\u0644\u0623\u0633\u0627\u0633\u064a</label>
              <div className="flex gap-2">
                <input type="color" className="h-10 w-12 cursor-pointer rounded border" value={brandForm.primary_color} onChange={(e) => setBrandForm((f) => ({ ...f, primary_color: e.target.value }))} />
                <Input value={brandForm.primary_color} onChange={(e) => setBrandForm((f) => ({ ...f, primary_color: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0644\u0648\u0646 \u0627\u0644\u0645\u0645\u064a\u0632 (\u0627\u0644\u0630\u0647\u0628\u064a/\u0627\u0644\u0623\u062d\u0645\u0631)</label>
              <div className="flex gap-2">
                <input type="color" className="h-10 w-12 cursor-pointer rounded border" value={brandForm.accent_color} onChange={(e) => setBrandForm((f) => ({ ...f, accent_color: e.target.value }))} />
                <Input value={brandForm.accent_color} onChange={(e) => setBrandForm((f) => ({ ...f, accent_color: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0644\u0648\u0646 \u0627\u0644\u062f\u0627\u0643\u0646</label>
              <div className="flex gap-2">
                <input type="color" className="h-10 w-12 cursor-pointer rounded border" value={brandForm.dark_color} onChange={(e) => setBrandForm((f) => ({ ...f, dark_color: e.target.value }))} />
                <Input value={brandForm.dark_color} onChange={(e) => setBrandForm((f) => ({ ...f, dark_color: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0647\u0627\u062a\u0641</label>
              <Input value={brandForm.contact_phone} onChange={(e) => setBrandForm((f) => ({ ...f, contact_phone: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a</label>
              <Input value={brandForm.contact_email} onChange={(e) => setBrandForm((f) => ({ ...f, contact_email: e.target.value }))} dir="ltr" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">\u0627\u0644\u0639\u0646\u0648\u0627\u0646</label>
              <Input value={brandForm.contact_address} onChange={(e) => setBrandForm((f) => ({ ...f, contact_address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandOpen(false)} disabled={brandSaving}>\u0625\u0644\u063a\u0627\u0621</Button>
            <Button onClick={saveBrand} disabled={brandSaving || uploading}>
              {brandSaving ? "\u062c\u0627\u0631\u064a \u0627\u0644\u062d\u0641\u0638..." : "\u062d\u0641\u0638 \u0627\u0644\u0647\u0648\u064a\u0629"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}
