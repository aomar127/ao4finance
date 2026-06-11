import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders } from "@/lib/auth";
import {
  createClientUser,
  deleteClientUser,
  listAllUsers,
  updateClientSubscription,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, CalendarClock, CheckCircle2, XCircle, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

interface UserRow {
  id: string;
  email?: string;
  full_name: string | null;
  company_name: string | null;
  company_id: string | null;
  roles: string[];
  subscription_start: string | null;
  subscription_end: string | null;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInput(v: string): string | null {
  if (!v) return null;
  // تخزين ك ISO في منتصف اليوم لتجاوز مشاكل المنطقة الزمنية
  return new Date(v + "T00:00:00").toISOString();
}

function isActive(u: UserRow): boolean {
  const now = new Date();
  const s = u.subscription_start ? new Date(u.subscription_start) : null;
  const e = u.subscription_end ? new Date(u.subscription_end) : null;
  if (s && s > now) return false;
  if (e && e < now) return false;
  return true;
}

function AdminUsersPage() {
  const list = useServerFn(listAllUsers);
  const create = useServerFn(createClientUser);
  const remove = useServerFn(deleteClientUser);
  const updateSub = useServerFn(updateClientSubscription);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyMode, setCompanyMode] = useState<"existing" | "new">("new");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subStart, setSubStart] = useState<string>("");
  const [subEnd, setSubEnd] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Edit subscription dialog
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [u, { data: c }] = await Promise.all([
        list({ headers }),
        supabase.from("companies").select("id, name").order("name"),
      ]);
      setUsers(u as UserRow[]);
      setCompanies(c || []);
    } catch (e: any) {
      toast.error(e?.message || "فشل التحميل");
    }
    setLoading(false);
  };
  useEffect(() => {
    reload();
  }, []);

  // افتراضي: شهر من اليوم
  useEffect(() => {
    if (!subStart) {
      const today = new Date();
      setSubStart(toDateInput(today.toISOString()));
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setSubEnd(toDateInput(nextMonth.toISOString()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      await create({
        headers,
        data: {
          email,
          password,
          full_name: fullName,
          subscription_start: fromDateInput(subStart),
          subscription_end: fromDateInput(subEnd),
          ...(companyMode === "existing"
            ? { company_id: companyId }
            : { company_name: companyName }),
        },
      });
      toast.success("تم إنشاء المستخدم");
      setEmail("");
      setPassword("");
      setFullName("");
      setCompanyName("");
      setCompanyId("");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "فشل الإنشاء");
    }
    setBusy(false);
  };

  const del = async (uid: string) => {
    if (!confirm("حذف المستخدم نهائياً؟")) return;
    try {
      await remove({ headers: await getAuthHeaders(), data: { user_id: uid } });
      toast.success("تم الحذف");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحذف");
    }
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditStart(toDateInput(u.subscription_start));
    setEditEnd(toDateInput(u.subscription_end));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateSub({
        headers: await getAuthHeaders(),
        data: {
          user_id: editing.id,
          subscription_start: fromDateInput(editStart),
          subscription_end: fromDateInput(editEnd),
        },
      });
      toast.success("تم تحديث الاشتراك");
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    }
    setSavingEdit(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 rounded bg-primary" />
          <h2 className="text-lg font-semibold">إنشاء مستخدم جديد (عميل باشتراك)</h2>
        </div>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>كلمة المرور (8 أحرف على الأقل)</Label>
            <Input required type="text" dir="ltr" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الشركة</Label>
            <Select value={companyMode} onValueChange={(v: any) => setCompanyMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">شركة جديدة</SelectItem>
                <SelectItem value="existing">شركة موجودة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {companyMode === "new" ? (
            <div className="space-y-2 md:col-span-2">
              <Label>اسم الشركة الجديدة</Label>
              <Input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label>اختر الشركة</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="اختر شركة" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4 text-primary" /> بداية الاشتراك
            </Label>
            <Input type="date" required value={subStart} onChange={(e) => setSubStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4 text-primary" /> نهاية الاشتراك
            </Label>
            <Input type="date" required value={subEnd} onChange={(e) => setSubEnd(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy} className="w-full md:w-auto">
              <Plus className="ml-1 h-4 w-4" /> {busy ? "جاري..." : "إنشاء المستخدم"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-8 w-1 rounded bg-primary" />
          <h2 className="text-lg font-semibold">المستخدمون الحاليون</h2>
        </div>
        {loading ? (
          <p className="text-muted-foreground">جاري التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="p-2">الاسم</th>
                  <th className="p-2">البريد</th>
                  <th className="p-2">الشركة</th>
                  <th className="p-2">الأدوار</th>
                  <th className="p-2">بداية الاشتراك</th>
                  <th className="p-2">نهاية الاشتراك</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = u.roles.includes("admin");
                  const active = isAdmin || isActive(u);
                  return (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium">{u.full_name || "-"}</td>
                      <td className="p-2" dir="ltr">{u.email}</td>
                      <td className="p-2">{u.company_name || "-"}</td>
                      <td className="p-2">{u.roles.join(", ") || "-"}</td>
                      <td className="p-2 text-xs" dir="ltr">
                        {u.subscription_start ? new Date(u.subscription_start).toLocaleDateString("ar-EG") : "—"}
                      </td>
                      <td className="p-2 text-xs" dir="ltr">
                        {u.subscription_end ? new Date(u.subscription_end).toLocaleDateString("ar-EG") : "—"}
                      </td>
                      <td className="p-2">
                        {isAdmin ? (
                          <Badge variant="secondary">مسؤول</Badge>
                        ) : active ? (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="ml-1 h-3 w-3" /> ساري
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="ml-1 h-3 w-3" /> منتهي
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-left">
                        <div className="flex justify-end gap-1">
                          {!isAdmin && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => del(u.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل اشتراك {editing?.full_name || editing?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>بداية الاشتراك</Label>
              <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>نهاية الاشتراك</Label>
              <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              اترك الحقول فارغة لإلغاء حدود الاشتراك (وصول دائم).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
