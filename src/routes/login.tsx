import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, TrendingUp, Sparkles, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Ahmed Omar" },
      { name: "description", content: "بوابة العملاء — Ahmed Omar للاستشارات والتقارير المالية. سجّل الدخول للوصول إلى لوحاتك وتقاريرك الخاصة." },
      { property: "og:title", content: "تسجيل الدخول — Ahmed Omar" },
      { property: "og:description", content: "بوابة العملاء — Ahmed Omar للاستشارات والتقارير المالية." },
      { property: "og:url", content: "https://finances7.lovable.app/login" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://finances7.lovable.app/login" },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      toast.error("فشل تسجيل الدخول: " + error.message);
      return;
    }
    const uid = data.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("subscription_start, subscription_end")
        .eq("id", uid)
        .maybeSingle();
      const now = new Date();
      const start = prof?.subscription_start ? new Date(prof.subscription_start) : null;
      const end = prof?.subscription_end ? new Date(prof.subscription_end) : null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const isAdmin = (roles || []).some((r) => r.role === "admin");
      if (!isAdmin) {
        if ((start && start > now) || (end && end < now)) {
          await supabase.auth.signOut();
          setBusy(false);
          toast.error("اشتراكك غير ساري. تواصل مع الإدارة.");
          return;
        }
      }
    }
    setBusy(false);
    navigate({ to: "/" });
  };

  // Local design tokens — Noir + Gold (premium accounting identity)
  const NOIR = "#0B1220";
  const NOIR_2 = "#111A2E";
  const GOLD = "#C9A24B";
  const GOLD_SOFT = "#E6CB7F";
  const GOLD_DEEP = "#A07F2E";

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      dir="rtl"
      style={{
        background: `radial-gradient(1200px 600px at 80% -10%, ${NOIR_2} 0%, ${NOIR} 55%, #05080F 100%)`,
      }}
    >
      {/* Ambient gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${GOLD}55 0%, transparent 60%)` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-[-8%] h-[460px] w-[460px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${GOLD_DEEP}40 0%, transparent 60%)` }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(201,162,75,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,75,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[28px] shadow-2xl md:grid-cols-2"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${GOLD}26`,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Brand panel */}
        <div
          className="relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex"
          style={{
            background: `linear-gradient(155deg, ${NOIR_2} 0%, ${NOIR} 60%, #05080F 100%)`,
            borderLeft: `1px solid ${GOLD}33`,
          }}
        >
          {/* Gold corner accents */}
          <div
            aria-hidden
            className="absolute right-6 top-6 h-12 w-12 rounded-tr-lg border-l-0 border-b-0"
            style={{ borderTop: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` }}
          />
          <div
            aria-hidden
            className="absolute bottom-6 left-6 h-12 w-12 rounded-bl-lg border-t-0 border-r-0"
            style={{ borderBottom: `2px solid ${GOLD}`, borderLeft: `2px solid ${GOLD}` }}
          />

          <div className="relative">
            {/* Monogram AO */}
            <div className="mb-6 flex items-center gap-3">
              <div
                className="relative flex h-14 w-14 items-center justify-center rounded-xl text-xl font-black tracking-tighter"
                style={{
                  background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                  color: NOIR,
                  boxShadow: `0 12px 30px -10px ${GOLD}66, inset 0 1px 0 ${GOLD_SOFT}`,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                AO
              </div>
              <div>
                <div
                  className="text-[10px] font-semibold uppercase tracking-[0.35em]"
                  style={{ color: GOLD_SOFT }}
                >
                  Financial Consultancy
                </div>
                <div
                  className="text-2xl font-bold leading-tight"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "-0.01em" }}
                >
                  Ahmed Omar
                </div>
              </div>
            </div>

            <div
              className="h-px w-16"
              style={{ background: `linear-gradient(90deg, ${GOLD} 0%, transparent 100%)` }}
            />

            <h2 className="mt-6 text-3xl font-bold leading-snug">
              الدقة في الأرقام،
              <br />
              <span style={{ color: GOLD_SOFT }}>والوضوح في القرار.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              خدمات محاسبية وتقارير مالية بجودة احترافية لرواد الأعمال والشركات.
            </p>
          </div>

          <ul className="relative space-y-4 text-sm">
            {[
              { icon: TrendingUp, text: "تقارير مالية تفاعلية بمعايير دولية" },
              { icon: ShieldCheck, text: "سرية تامة وحفظ سحابي آمن لبياناتك" },
              { icon: Sparkles, text: "تجربة عميل مخصصة وفق احتياجك" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: `${GOLD}1A`,
                    border: `1px solid ${GOLD}40`,
                    color: GOLD_SOFT,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-white/80">{text}</span>
              </li>
            ))}
          </ul>

          <div className="relative flex items-center justify-between text-[11px]" style={{ color: `${GOLD_SOFT}99` }}>
            <span>© {new Date().getFullYear()} Ahmed Omar</span>
            <span className="tracking-widest">CLIENT PORTAL</span>
          </div>
        </div>

        {/* Form panel */}
        <div
          className="flex flex-col justify-center p-8 md:p-12"
          style={{ background: "#FAFAF7" }}
        >
          {/* Mobile monogram */}
          <div className="mb-6 flex items-center justify-center gap-3 md:hidden">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-black"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                color: NOIR,
                fontFamily: "Georgia, serif",
              }}
            >
              AO
            </div>
            <div className="text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD_DEEP }}>
                Financial Consultancy
              </div>
              <div className="text-lg font-bold" style={{ color: NOIR, fontFamily: "Georgia, serif" }}>
                Ahmed Omar
              </div>
            </div>
          </div>

          <div className="mb-8 text-center md:text-right">
            <div
              className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em]"
              style={{ background: `${GOLD}1A`, color: GOLD_DEEP, border: `1px solid ${GOLD}33` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
              Welcome Back
            </div>
            <h1
              className="text-3xl font-bold"
              style={{ color: NOIR, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              تسجيل الدخول
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              ادخل بياناتك للوصول إلى بوابة العميل
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold" style={{ color: NOIR }}>
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: GOLD_DEEP }} />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  className="h-12 border-slate-200 pr-10 text-right transition-colors focus-visible:border-[var(--ao-gold,#C9A24B)] focus-visible:ring-[3px] focus-visible:ring-[#C9A24B33]"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold" style={{ color: NOIR }}>
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: GOLD_DEEP }} />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="h-12 border-slate-200 pr-10 text-right transition-colors focus-visible:border-[#C9A24B] focus-visible:ring-[3px] focus-visible:ring-[#C9A24B33]"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="group relative h-12 w-full overflow-hidden text-base font-bold text-white transition-all hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${NOIR_2} 0%, ${NOIR} 100%)`,
                boxShadow: `0 12px 28px -10px ${NOIR}AA, inset 0 1px 0 ${GOLD}66`,
                border: `1px solid ${GOLD}55`,
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? "جاري الدخول..." : "تسجيل الدخول"}
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" style={{ color: GOLD_SOFT }} />
              </span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
              />
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>بوابة العملاء الخاصة</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            للحصول على حساب، تواصل مع مكتب{" "}
            <span className="font-bold" style={{ color: NOIR }}>
              Ahmed Omar
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
