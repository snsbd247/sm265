import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "shop_owner" | "shop_manager" | "shop_cashier";

export interface UserRoleRow {
  role: AppRole;
  shop_id: string | null;
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  roles: UserRoleRow[];
  isSuperAdmin: boolean;
  primaryShopId: string | null;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (uid: string | undefined) => {
      if (!uid) {
        if (mounted) { setRoles([]); setRolesLoaded(true); }
        return;
      }
      if (mounted) setRolesLoaded(false);
      const { data } = await supabase
        .from("user_roles")
        .select("role, shop_id")
        .eq("user_id", uid);
      if (mounted) { setRoles((data as UserRoleRow[]) ?? []); setRolesLoaded(true); }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
      loadRoles(s?.user.id);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionLoaded(true);
      loadRoles(data.session?.user.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isSuperAdmin = roles.some((r) => r.role === "super_admin");
  const primaryShopId = roles.find((r) => r.shop_id)?.shop_id ?? null;
  // Keep "loading" true until BOTH the session and the corresponding roles
  // for that session are fetched. Prevents a race where an authenticated
  // user briefly appears role-less and gets redirected away.
  const loading = !sessionLoaded || (!!session && !rolesLoaded);

  return { loading, session, roles, isSuperAdmin, primaryShopId };
}
