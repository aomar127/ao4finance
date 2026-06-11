import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== "admin") {
      navigate({ to: "/ln", replace: true });
    }
  }, [loading, role, navigate]);

  if (loading || role !== "admin") {
    return <div className="text-muted-foreground" dir="rtl">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <nav className="flex gap-4 border-b pb-3 text-sm">
        <Link to="/admin" activeProps={{ className: "text-primary font-semibold" }} activeOptions={{ exact: true }}>
          المكاتب والعملاء
        </Link>
        <Link to="/admin/users" activeProps={{ className: "text-primary font-semibold" }}>
          المستخدمون
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
