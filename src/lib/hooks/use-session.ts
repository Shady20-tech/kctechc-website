"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";

/**
 * Whether the browser currently holds a Supabase session.
 *
 * This reads the *browser* client, whose auth state is the same cookie the server
 * reads, so the header can reflect the session without a Server Component reading
 * `cookies()` (which would make every page dynamic).
 *
 * The initial value is `false` — the signed-out state — so the server render and
 * the first client render agree and there is no hydration mismatch. The real value
 * arrives in an effect, and `onAuthStateChange` keeps it correct across a sign-in
 * or sign-out that happens without a reload. Returning to the tab also re-reads,
 * because a sign-out in another tab is not reported here. A route change re-reads
 * too: sign-in is a Server Action, so it sets the cookie without emitting a browser
 * auth event, and the redirect after it is the first moment this can observe the
 * new session.
 */
export function useHasSession(): boolean {
  const [hasSession, setHasSession] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let active = true;

    const sync = (signedIn: boolean) => {
      if (active) setHasSession(signedIn);
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => sync(Boolean(data.session)));

    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      sync(Boolean(session)),
    );

    const onFocus = () => {
      void supabase.auth
        .getSession()
        .then(({ data }) => sync(Boolean(data.session)));
    };
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      data.subscription.unsubscribe();
    };
  }, [pathname]);

  return hasSession;
}
