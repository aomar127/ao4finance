import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthHeaders, useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [bootstrapping, setBootstrapping] = useState(false);
  const bootstrap = useServerFn(bootstrapAdmin);

  useEffect(() => {
    if (loading || !user) return;
    if (role === "admin") navigate({ to: "/admin" });
    else if (role === "client") navigate({ to: "/ln" });
  }, [loading, user, role, navigate]);

  if (loading) return <div className="text-muted-foreground">جاري التحميل...</div>;
  if (!role) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-lg border bg-card p-6 text-center" dir="rtl">
        <h2 className="text-xl font-semibold">لم يتم تعيين دور لحسابك بعد</h2>
        <p className="text-sm text-muted-foreground">
          إذا كنت مالك النظام، اضغط الزر أدناه لتعيين نفسك كمشرف. هذا الإجراء يعمل لمرة واحدة فقط
          (إذا لم يوجد مشرف).
        </p>
        <Button
          disabled={bootstrapping}
          onClick={async () => {
            setBootstrapping(true);
            try {
              await bootstrap({ headers: await getAuthHeaders() });
              toast.success("تم تعيينك مشرفاً");
              navigate({ to: "/admin" });
            } catch (e: any) {
              toast.error(e?.message || "فشل");
            } finally {
              setBootstrapping(false);
            }
          }}
        >
          تعييني كمشرف
        </Button>
      </div>
    );
  }
  return <div className="text-muted-foreground">جاري التحويل...</div>;
}
