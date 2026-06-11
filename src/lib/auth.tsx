import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "client";

export interface AuthState {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
}

type AuthListener = () => void;

let authState: AuthState = { loading: true, user: null, role: null };
let authStarted = false;
let currentUid: string | null | undefined = undefined;
let roleRequestId = 0;
const authListeners = new Set<AuthListener>();

function publishAuthState(next: Partial<AuthState>) {
  authState = { ...authState, ...next };
  authListeners.forEach((listener) => listener());
}

async function loadRole(uid: string | null, requestId: number) {
  if (!uid) {
    if (requestId === roleRequestId) publishAuthState({ role: null, loading: false });
    return;
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid);

  if (requestId !== roleRequestId) return;

  if (error) {
    console.error("Failed to load user role", error);
    publishAuthState({ role: null, loading: false });
    return;
  }

  const roles = (data || []).map((r) => r.role as AppRole);
  publishAuthState({
    role: roles.includes("admin") ? "admin" : roles.includes("client") ? "client" : null,
    loading: false,
  });
}

function startAuthStore() {
  if (authStarted) return;
  authStarted = true;

  const applySession = (nextUser: User | null) => {
    const nextUid = nextUser?.id ?? null;

    if (currentUid === nextUid) {
      if (authState.user !== nextUser) publishAuthState({ user: nextUser });
      return;
    }

    currentUid = nextUid;
    const requestId = ++roleRequestId;
    publishAuthState({ user: nextUser, loading: true });
    void loadRole(nextUid, requestId);
  };

  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") && !session && currentUid) {
      return;
    }
    applySession(session?.user ?? null);
  });

  void supabase.auth.getSession().then(({ data }) => {
    applySession(data.session?.user ?? null);
  });
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    startAuthStore();
    const listener = () => setState(authState);
    authListeners.add(listener);
    setState(authState);

    return () => {
      authListeners.delete(listener);
    };
  }, []);

  return state;
}

export async function getAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("انتهت جلسة الدخول، سجل الدخول مرة أخرى");
  return { Authorization: `Bearer ${token}` };
}

export async function signOut() {
  await supabase.auth.signOut();
}
