import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getAuthHeaders } from "@/lib/auth";
import { getFirmBrandByCompany } from "@/lib/admin.functions";
import { applyReportTheme } from "@/lib/report-theme";

export const Route = createFileRoute("/_authenticated/ln")({
  component: ClientReportPage,
});

interface AccessibleCompany {
  id: string;
  name: string;
}

const frameWrapStyle = { height: "calc(100vh - 160px)" } as const;

function ClientReportPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchBrand = useServerFn(getFirmBrandByCompany);

  useEffect(() => {
    if (!authLoading && role === "admin") {
      navigate({ to: "/admin" });
    }
  }, [authLoading, role, navigate]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [companies, setCompanies] = useState<AccessibleCompany[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [state, setState] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const frameReadyRef = useRef(false);
  const stateRef = useRef<any>(null);
  const reportIdRef = useRef<string | null>(null);
  const brandRef = useRef<any>(null);
  const frameSrc = useMemo(
    () => `/report-template.html?v=202605212100&mode=view${reportId ? `&reportId=${reportId}` : ""}`,
    [reportId],
  );

  useEffect(() => {
    document.title = "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 | Cloud Report Hub";
  }, []);

  const syncBrandFrame = useCallback(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w || !frameReadyRef.current || !brandRef.current) return;
    w.postMessage({ target: "report-frame", type: "set-brand", brand: brandRef.current }, "*");
    applyReportTheme(iframeRef.current, brandRef.current?.report_design);
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
    syncBrandFrame();
    syncViewFrame();
  }, [syncViewFrame, syncBrandFrame]);

  // 1) Resolve accessible companies (single / firm / multi are all enforced by RLS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data: comps } = await supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true });
      if (cancelled) return;
      const list = (comps || []) as AccessibleCompany[];
      setCompanies(list);
      if (list.length === 0) {
        setLoading(false);
        setEmpty(true);
        return;
      }
      const cachedCompany = sessionStorage.getItem(`client-company:${user.id}`);
      const initial = list.find((c) => c.id === cachedCompany)?.id || list[0].id;
      setCompanyId(initial);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // 1b) Load the firm brand (carries report_design) for the selected company
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!companyId) return;
      try {
        const brand = await fetchBrand({
          headers: await getAuthHeaders(),
          data: { company_id: companyId },
        });
        if (cancelled) return;
        brandRef.current = brand;
        syncBrandFrame();
      } catch (_e) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, fetchBrand, syncBrandFrame]);

  // 2) Load the latest report for the selected company
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || !companyId) return;
      setLoading(true);
      setEmpty(false);
      sessionStorage.setItem(`client-company:${user.id}`, companyId);
      const cacheKey = `client-report-state:${user.id}:${companyId}`;
      const cacheIdKey = `client-report-id:${user.id}:${companyId}`;
      const cachedState = sessionStorage.getItem(cacheKey);
      const cachedReportId = sessionStorage.getItem(cacheIdKey);
      if (cachedState) {
        try {
          const parsed = JSON.parse(cachedState);
          stateRef.current = parsed;
          setState(parsed);
          if (cachedReportId) {
            reportIdRef.current = cachedReportId;
            setReportId(cachedReportId);
          }
        } catch (_e) {}
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
        reportIdRef.current = null;
        setReportId(null);
        stateRef.current = null;
        setState(null);
        setEmpty(true);
        return;
      }
      reportIdRef.current = data.id;
      setReportId(data.id);
      const nextState = data.state || {};
      stateRef.current = nextState;
      setState(nextState);
      sessionStorage.setItem(cacheKey, JSON.stringify(nextState));
      sessionStorage.setItem(cacheIdKey, data.id);
      setEmpty(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, companyId]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || d.source !== "report-frame") return;
      if (d.type === "ready") {
        frameReadyRef.current = true;
        syncBrandFrame();
        syncViewFrame();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [syncViewFrame, syncBrandFrame]);

  useEffect(() => {
    stateRef.current = state;
    reportIdRef.current = reportId;
    syncViewFrame();
  }, [state, reportId, syncViewFrame]);

  if (authLoading || (loading && !state))
    return (
      <div className="text-muted-foreground" dir="rtl">
        \u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...
      </div>
    );
  if (role === "admin")
    return (
      <div className="text-muted-foreground" dir="rtl">
        \u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629...
      </div>
    );

  const switcher =
    companies.length > 1 ? (
      <div className="mb-3 flex items-center gap-2" dir="rtl">
        <label className="text-sm font-medium text-muted-foreground">\u0627\u0644\u0639\u0645\u064a\u0644:</label>
        <select
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={companyId || ""}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  if (empty)
    return (
      <div dir="rtl">
        {switcher}
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">\u0644\u0627 \u064a\u0648\u062c\u062f \u062a\u0642\u0631\u064a\u0631 \u0645\u062a\u0627\u062d \u0628\u0639\u062f</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            \u064a\u0642\u0648\u0645 \u0627\u0644\u0645\u0634\u0631\u0641 \u0628\u0625\u0639\u062f\u0627\u062f \u062a\u0642\u0631\u064a\u0631\u0643 \u0642\u0631\u064a\u0628\u0627\u064b. \u064a\u0631\u062c\u0649 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u0627\u062d\u0642\u0627\u064b.
          </p>
        </div>
      </div>
    );

  return (
    <div dir="rtl">
      {switcher}
      <div className="overflow-hidden rounded-lg border bg-white" style={frameWrapStyle}>
        <ReportViewFrame frameRef={iframeRef} src={frameSrc} onReady={handleFrameReady} />
      </div>
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
    <iframe ref={frameRef} src={src} title="My Report" className="h-full w-full" onLoad={onReady} />
  );
});
