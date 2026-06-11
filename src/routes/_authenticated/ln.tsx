import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/ln")({
  component: ClientReportPage,
});

function ClientReportPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && role === "admin") {
      navigate({ to: "/admin" });
    }
  }, [authLoading, role, navigate]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const frameReadyRef = useRef(false);
  const stateRef = useRef<any>(null);
  const reportIdRef = useRef<string | null>(null);
  const frameSrc = useMemo(
    () => `/report-template.html?v=202605212100&mode=view${reportId ? `&reportId=${reportId}` : ""}`,
    [reportId],
  );

  useEffect(() => {
    document.title = "تقرير الشركة | Cloud Report Hub";
  }, []);

  const syncViewFrame = useCallback(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w || !frameReadyRef.current || !stateRef.current) return;
    w.postMessage({ target: "report-frame", type: "view-only" }, "*");
    w.postMessage(
      {
        target: "report-frame",
        type: "import",
        reportId: reportIdRef.current,
        state: stateRef.current,
        autoGenerate: true,
      },
      "*",
    );
  }, []);

  const handleFrameReady = useCallback(() => {
    frameReadyRef.current = true;
    syncViewFrame();
  }, [syncViewFrame]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const cachedState = sessionStorage.getItem(`client-report-state:${user.id}`);
      const cachedReportId = sessionStorage.getItem(`client-report-id:${user.id}`);
      if (cachedState) {
        try {
          const parsed = JSON.parse(cachedState);
          stateRef.current = parsed;
          setState(parsed);
          if (cachedReportId) {
            reportIdRef.current = cachedReportId;
            setReportId(cachedReportId);
          }
          setLoading(false);
          setEmpty(false);
        } catch (_e) {}
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const companyId = profileData?.company_id;
      if (!companyId) {
        setLoading(false);
        setEmpty(true);
        return;
      }

      const { data, error } = await supabase
        .from("reports")
        .select("id, state")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLoading(false);
      if (error || !data) {
        setEmpty(true);
        return;
      }
      reportIdRef.current = data.id;
      setReportId(data.id);
      const nextState = data.state || {};
      stateRef.current = nextState;
      setState(nextState);
      sessionStorage.setItem(`client-report-state:${user.id}`, JSON.stringify(nextState));
      sessionStorage.setItem(`client-report-id:${user.id}`, data.id);
      setEmpty(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || d.source !== "report-frame") return;
      if (d.type === "ready") {
        frameReadyRef.current = true;
        syncViewFrame();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [syncViewFrame]);

  useEffect(() => {
    stateRef.current = state;
    reportIdRef.current = reportId;
    syncViewFrame();
  }, [state, reportId, syncViewFrame]);

  if (authLoading || loading) return <div className="text-muted-foreground" dir="rtl">جاري التحميل...</div>;
  if (role === "admin") return <div className="text-muted-foreground" dir="rtl">جاري التحويل إلى لوحة الإدارة...</div>;
  if (empty)
    return (
      <div className="rounded-lg border bg-card p-8 text-center" dir="rtl">
        <h2 className="text-lg font-semibold">لا يوجد تقرير متاح بعد</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          يقوم المشرف بإعداد تقريرك قريباً. يرجى المحاولة لاحقاً.
        </p>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-lg border bg-white" style={{ height: "calc(100vh - 130px)" }}>
      <ReportViewFrame frameRef={iframeRef} src={frameSrc} onReady={handleFrameReady} />
    </div>
  );
}

const ReportViewFrame = memo(function ReportViewFrame({
  frameRef,
  src,
  onReady,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  src: string;
  onReady: () => void;
}) {
  return (
    <iframe
      ref={frameRef}
      src={src}
      title="My Report"
      className="h-full w-full"
      onLoad={onReady}
    />
  );
});
