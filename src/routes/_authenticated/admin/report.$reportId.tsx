import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders } from "@/lib/auth";
import { saveReportState, getFirmBrandByCompany, getIsReportOwner } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight, Cloud, CloudOff, Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/report/$reportId")({
  component: ReportEditorPage,
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

function ReportEditorPage() {
  const { reportId } = Route.useParams();
  const navigate = useNavigate();
  const saveReport = useServerFn(saveReportState);
  const fetchBrand = useServerFn(getFirmBrandByCompany);
  const fetchIsOwner = useServerFn(getIsReportOwner);
  const brandRef = useRef<any>(null);
  const ownerAllowedRef = useRef<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const stateRef = useRef<any>(null);
  const lastSavedRef = useRef<string>("");
  const resolverRef = useRef<((s: any) => void) | null>(null);
  const readyRef = useRef(false);
  const dirtyRef = useRef(false);

  const sendOwnerAccess = useCallback(async () => {
    try {
      const res = await fetchIsOwner({ headers: await getAuthHeaders() });
      ownerAllowedRef.current = !!res?.isAllowed;
    } catch (_e) {
      ownerAllowedRef.current = false;
    }
    iframeRef.current?.contentWindow?.postMessage(
      {
        target: "report-frame",
        type: "set-owner-access",
        isAllowed: ownerAllowedRef.current,
      },
      "*",
    );
  }, [fetchIsOwner]);


  useEffect(() => {
    document.title = companyName
      ? `تحرير تقرير - ${companyName} | Cloud Report Hub`
      : "تحرير تقرير | Cloud Report Hub";
  }, [companyName]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("state, company_id, companies(name)")
        .eq("id", reportId)
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      stateRef.current = data.state || null;
      lastSavedRef.current = JSON.stringify(stateRef.current ?? {});
      setCompanyName((data as any).companies?.name || "");
      try {
        const brand = await fetchBrand({ headers: await getAuthHeaders(), data: { company_id: (data as any).company_id } });
        brandRef.current = brand;
        if (brand && readyRef.current) {
          iframeRef.current?.contentWindow?.postMessage(
            { target: "report-frame", type: "set-brand", brand },
            "*",
          );
        }
      } catch (_e) {}
      if (readyRef.current && stateRef.current && Object.keys(stateRef.current).length > 0) {
        iframeRef.current?.contentWindow?.postMessage(
            {
              target: "report-frame",
              type: "import",
              reportId,
              state: stateRef.current,
              autoGenerate: false,
            },
          "*",
        );
      }
    })();
  }, [reportId]);

  const requestState = useCallback(
    () =>
      new Promise<any>((resolve) => {
        const w = iframeRef.current?.contentWindow;
        if (!w || !readyRef.current) return resolve(null);
        resolverRef.current = resolve;
        w.postMessage({ target: "report-frame", type: "export" }, "*");
        setTimeout(() => {
          if (resolverRef.current) {
            resolverRef.current(null);
            resolverRef.current = null;
          }
        }, 4000);
      }),
    [],
  );

  const saveStateToCloud = useCallback(
    async (state: any, showToast = false): Promise<boolean> => {
      if (!state) {
        if (showToast) toast.error("المحرر غير جاهز بعد");
        return false;
      }
      const serialized = JSON.stringify(state);
      const forceCloudSync = showToast;
      if (!forceCloudSync && serialized === lastSavedRef.current) {
        return true;
      }
      setStatus("saving");
      const period =
        (state.values?.month1 || "") +
        (state.values?.month2 ? " / " + state.values.month2 : "");
      try {
        await saveReport({
          headers: await getAuthHeaders(),
          data: { report_id: reportId, state, period: period || null },
        });
      } catch (error: any) {
        setStatus("error");
        toast.error("تعذر الحفظ: " + (error?.message || "حدث خطأ غير متوقع"));
        return false;
      }
      lastSavedRef.current = serialized;
      dirtyRef.current = false;
      setStatus("saved");
      if (showToast) toast.success("تم الحفظ في السحابة");
      return true;
    },
    [reportId, saveReport],
  );

  const performSave = useCallback(
    async (showToast = false): Promise<boolean> => {
      const state = await requestState();
      return saveStateToCloud(state, showToast);
    },
    [requestState, saveStateToCloud],
  );

  // Listen for messages from iframe
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || d.source !== "report-frame") return;
      if (d.type === "ready") {
        readyRef.current = true;
        void sendOwnerAccess();
        if (brandRef.current) {
          iframeRef.current?.contentWindow?.postMessage(
            { target: "report-frame", type: "set-brand", brand: brandRef.current },
            "*",
          );
        }
        if (stateRef.current && Object.keys(stateRef.current).length > 0) {
          iframeRef.current?.contentWindow?.postMessage(
            {
              target: "report-frame",
              type: "import",
              reportId,
              state: stateRef.current,
              autoGenerate: false,
            },
            "*",
          );
        }
      } else if (d.type === "state" && resolverRef.current) {
        resolverRef.current(d.payload);
        resolverRef.current = null;
      } else if (d.type === "generated") {
        dirtyRef.current = true;
        void saveStateToCloud(d.payload, false);
      } else if (d.type === "changed") {
        dirtyRef.current = true;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [sendOwnerAccess, reportId]);

  // Auto-save: every 2s if dirty
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !dirtyRef.current) return;
      await performSave(false);
    };
    const interval = setInterval(tick, 2000);
    const onBeforeUnload = () => {
      void performSave(false);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [performSave]);

  const StatusBadge = () => {
    if (status === "saving")
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> جاري الحفظ...
        </span>
      );
    if (status === "error")
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <CloudOff className="h-3 w-3" /> فشل الحفظ
        </span>
      );
    if (status === "saved")
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Cloud className="h-3 w-3" /> تم الحفظ تلقائياً
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Cloud className="h-3 w-3" /> الحفظ التلقائي مفعّل
      </span>
    );
  };

  const handleBack = async () => {
    await performSave(false);
    navigate({ to: "/admin" });
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowRight className="ml-1 h-4 w-4" /> رجوع
          </Button>
          <span className="text-sm text-muted-foreground">
            {companyName ? `الشركة: ${companyName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge />
          <Button
            size="sm"
            onClick={() => performSave(true)}
            disabled={status === "saving"}
          >
            <Save className="ml-1 h-4 w-4" /> حفظ في السحابة
          </Button>
        </div>
      </div>
      <div
        className="overflow-hidden rounded-lg border bg-card"
        style={{ height: "calc(100vh - 180px)" }}
      >
        <iframe
          ref={iframeRef}
          src={`/report-template.html?v=202605212100&reportId=${reportId}`}
          title="Report Editor"
          className="h-full w-full"
          onLoad={async () => {
            readyRef.current = true;
            await sendOwnerAccess();
            if (stateRef.current && Object.keys(stateRef.current).length > 0) {
              iframeRef.current?.contentWindow?.postMessage(
                {
                  target: "report-frame",
                  type: "import",
                  reportId,
                  state: stateRef.current,
                  autoGenerate: false,
                },
                "*",
              );
            }
          }}
        />
      </div>
    </div>
  );
}
