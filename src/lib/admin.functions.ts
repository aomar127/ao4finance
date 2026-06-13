import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin.server";

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      throw new Response("An admin already exists", { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        full_name: z.string().min(1),
        company_name: z.string().min(1).optional(),
        company_id: z.string().uuid().optional(),
        subscription_start: z.string().nullable().optional(),
        subscription_end: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    let companyId = data.company_id;
    if (!companyId) {
      if (!data.company_name) throw new Error("company_name required");
      const { data: c, error: cErr } = await supabaseAdmin
        .from("companies")
        .insert({ name: data.company_name, created_by: context.userId })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      companyId = c.id;
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      full_name: data.full_name,
      company_id: companyId,
      subscription_start: data.subscription_start || null,
      subscription_end: data.subscription_end || null,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "client" });

    return { user_id: newUserId, company_id: companyId };
  });

export const updateClientSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        subscription_start: z.string().nullable(),
        subscription_end: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_start: data.subscription_start,
        subscription_end: data.subscription_end,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Update a user's access scope: whole office (firm), a single client, or
// multiple clients. Uses the service-role client (bypasses RLS).
export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        access_type: z.enum(["firm", "single", "multi"]),
        firm_id: z.string().uuid().nullable().optional(),
        company_id: z.string().uuid().nullable().optional(),
        company_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    let profilePatch: { company_id: string | null; firm_id: string | null };
    let links: string[] = [];

    if (data.access_type === "firm") {
      if (!data.firm_id) throw new Error("firm_id required");
      profilePatch = { firm_id: data.firm_id, company_id: null };
    } else if (data.access_type === "single") {
      if (!data.company_id) throw new Error("company_id required");
      profilePatch = { firm_id: null, company_id: data.company_id };
    } else {
      const ids = Array.from(new Set((data.company_ids || []).filter(Boolean)));
      if (ids.length === 0) throw new Error("company_ids required");
      profilePatch = { firm_id: null, company_id: ids[0] };
      links = ids;
    }

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update(profilePatch)
      .eq("id", data.user_id);
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("user_companies").delete().eq("user_id", data.user_id);
    if (links.length > 0) {
      const rows = links.map((cid) => ({ user_id: data.user_id, company_id: cid }));
      const { error: lErr } = await supabaseAdmin.from("user_companies").insert(rows);
      if (lErr) throw new Error(lErr.message);
    }

    return { ok: true };
  });

export const deleteClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const ids = list.users.map((u) => u.id);
    const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
    const [{ data: profiles }, { data: roles }, { data: companies }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, company_id, subscription_start, subscription_end")
        .in("id", safeIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", safeIds),
      supabaseAdmin.from("companies").select("id, name"),
    ]);

    // Access-scope enrichment (firm-level + multi-company). Guarded so the page
    // keeps working even if the access-scope migration has not been applied yet.
    const firmIdByUser = new Map<string, string | null>();
    const linksByUser = new Map<string, string[]>();
    const firmMap = new Map<string, string>();
    try {
      const [{ data: profFirms }, { data: links }, { data: firms }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, firm_id").in("id", safeIds),
        supabaseAdmin.from("user_companies").select("user_id, company_id").in("user_id", safeIds),
        supabaseAdmin.from("firms").select("id, name"),
      ]);
      (profFirms || []).forEach((p: any) => firmIdByUser.set(p.id, p.firm_id || null));
      (links || []).forEach((l: any) => {
        const arr = linksByUser.get(l.user_id) || [];
        arr.push(l.company_id);
        linksByUser.set(l.user_id, arr);
      });
      (firms || []).forEach((f: any) => firmMap.set(f.id, f.name));
    } catch (_e) {
      // schema not migrated yet -- fall back to single-company display
    }

    const profMap = new Map((profiles || []).map((p) => [p.id, p]));
    const compMap = new Map((companies || []).map((c) => [c.id, c.name]));
    const roleMap = new Map<string, string[]>();
    (roles || []).forEach((r) => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return list.users.map((u) => {
      const p = profMap.get(u.id) as any;
      const firmId = firmIdByUser.get(u.id) || null;
      const linkIds = linksByUser.get(u.id) || [];
      const accessType: "firm" | "multi" | "single" = firmId
        ? "firm"
        : linkIds.length > 0
          ? "multi"
          : "single";
      return {
        id: u.id,
        email: u.email,
        full_name: p?.full_name || null,
        company_id: p?.company_id || null,
        company_name: p?.company_id ? compMap.get(p.company_id) || null : null,
        roles: roleMap.get(u.id) || [],
        subscription_start: p?.subscription_start || null,
        subscription_end: p?.subscription_end || null,
        firm_id: firmId,
        firm_name: firmId ? firmMap.get(firmId) || null : null,
        company_ids: linkIds,
        company_names: linkIds.map((id) => compMap.get(id)).filter(Boolean) as string[],
        access_type: accessType,
      };
    });
  });

export const listAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [
      { data: firms, error: firmsError },
      { data: companies, error: companiesError },
      { data: reports, error: reportsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("firms")
        .select(
          "id, name, created_at, brand_name_ar, brand_name_en, brand_tagline, logo_url, primary_color, accent_color, dark_color, contact_phone, contact_email, contact_address",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("companies").select("id, name, firm_id, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("reports").select("id, company_id, title, period, updated_at").order("updated_at", { ascending: false }),
    ]);
    if (firmsError) throw new Error(firmsError.message);
    if (companiesError) throw new Error(companiesError.message);
    if (reportsError) throw new Error(reportsError.message);

    // Attach per-firm report design. Guarded so the dashboard keeps working even
    // if the report_design migration has not been applied yet.
    const designByFirm = new Map<string, string>();
    try {
      const { data: designs, error: dErr } = await (supabaseAdmin.from("firms") as any).select(
        "id, report_design",
      );
      if (!dErr) {
        (designs || []).forEach((r: any) => designByFirm.set(r.id, r.report_design || "ln"));
      }
    } catch (_e) {
      // report_design column not present yet -- default to "ln"
    }
    const firmsOut = (firms || []).map((f: any) => ({
      ...f,
      report_design: designByFirm.get(f.id) || "ln",
    }));
    return { firms: firmsOut, companies: companies || [], reports: reports || [] };
  });

export const createFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ name: z.string().min(1), report_design: z.string().max(40).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: firm, error } = await supabaseAdmin
      .from("firms")
      .insert({ name: data.name.trim(), created_by: context.userId })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);
    // Persist the chosen report design. Guarded so firm creation keeps working
    // even if the report_design migration has not been applied yet.
    if (data.report_design) {
      const { error: dErr } = await (supabaseAdmin.from("firms") as any)
        .update({ report_design: data.report_design })
        .eq("id", firm.id);
      // Ignore dErr: column may not be migrated yet.
      void dErr;
    }
    return firm;
  });

export const updateFirmDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), report_design: z.string().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await (supabaseAdmin.from("firms") as any)
      .update({ report_design: data.report_design })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("firms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "لون غير صالح")
  .nullable()
  .optional();

export const updateFirmBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        brand_name_ar: z.string().max(200).nullable().optional(),
        brand_name_en: z.string().max(200).nullable().optional(),
        brand_tagline: z.string().max(200).nullable().optional(),
        logo_url: z.string().url().nullable().optional().or(z.literal("")),
        primary_color: hexColor,
        accent_color: hexColor,
        dark_color: hexColor,
        contact_phone: z.string().max(100).nullable().optional(),
        contact_email: z.string().max(200).nullable().optional(),
        contact_address: z.string().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      patch[k] = v === "" ? null : v;
    }
    const { error } = await (supabaseAdmin.from("firms") as any).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFirmBrandByCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("firm_id")
      .eq("id", data.company_id)
      .single();
    if (!company?.firm_id) return null;
    const { data: firm } = await supabaseAdmin
      .from("firms")
      .select(
        "id, name, brand_name_ar, brand_name_en, brand_tagline, logo_url, primary_color, accent_color, dark_color, contact_phone, contact_email, contact_address",
      )
      .eq("id", company.firm_id)
      .single();
    if (!firm) return null;
    // Attach report design (guarded for pre-migration environments).
    let report_design = "ln";
    const { data: d, error: dErr } = await (supabaseAdmin.from("firms") as any)
      .select("report_design")
      .eq("id", company.firm_id)
      .single();
    if (!dErr && d?.report_design) report_design = d.report_design;
    return { ...firm, report_design };
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      name: z.string().min(1),
      firm_id: z.string().uuid().nullable().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .insert({ name: data.name.trim(), created_by: context.userId, firm_id: data.firm_id || null })
      .select("id, name, firm_id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return company;
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("companies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      id: z.string().uuid(),
      firm_id: z.string().uuid().nullable(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("companies")
      .update({ firm_id: data.firm_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ company_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: report, error } = await supabaseAdmin
      .from("reports")
      .insert({ company_id: data.company_id, title: "تقرير مالي", created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return report;
  });

export const saveReportState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        report_id: z.string().uuid(),
        state: z.any(),
        period: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("reports")
      .update({ state: data.state, period: data.period || null, updated_at: new Date().toISOString() })
      .eq("id", data.report_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const OWNER_EMAIL = "a.omarjob1@gmail.com";

export const getIsReportOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(context.claims?.email || "").trim().toLowerCase();
    return { isAllowed: email === OWNER_EMAIL };
  });
