import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ROLE, isAppRole, type AppRole } from "./roles";

export type Profile = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  locale: string | null;
  isActive: boolean;
};

export type AuthState =
  | { status: "unauthenticated" }
  | { status: "unconfigured" }
  | {
      status: "authenticated";
      userId: string;
      email: string | null;
      profile: Profile | null;
    };

/**
 * Resolve the current session and profile.
 *
 * Wrapped in React `cache` so a layout and its pages share one lookup per
 * request. Authorization decisions always read `profile.role`, which comes from
 * the database and is protected by RLS — never from client-supplied state.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();
  if (!supabase) return { status: "unconfigured" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { status: "unauthenticated" };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, locale, is_active")
    .eq("id", user.id)
    .maybeSingle();

  const role: AppRole =
    profileRow && isAppRole(profileRow.role) ? profileRow.role : DEFAULT_ROLE;

  const profile: Profile | null = profileRow
    ? {
        id: profileRow.id,
        email: profileRow.email,
        fullName: profileRow.full_name,
        role,
        locale: profileRow.locale,
        isActive: profileRow.is_active ?? true,
      }
    : null;

  return {
    status: "authenticated",
    userId: user.id,
    email: user.email ?? null,
    profile,
  };
});

export async function getCurrentProfile(): Promise<Profile | null> {
  const state = await getAuthState();
  return state.status === "authenticated" ? state.profile : null;
}

export async function getCurrentRole(): Promise<AppRole | null> {
  const profile = await getCurrentProfile();
  return profile?.role ?? null;
}
