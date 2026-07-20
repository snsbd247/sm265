import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/setup"];

function AdminLayout() {
  const { loading, session, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const isPublic = PUBLIC_ADMIN_PATHS.includes(loc.pathname);

  useEffect(() => {
    if (loading || isPublic) return;
    if (!session) navigate({ to: "/admin/login" });
    else if (!isSuperAdmin) navigate({ to: "/" });
  }, [loading, session, isSuperAdmin, navigate, isPublic]);

  if (isPublic) return <Outlet />;

  if (loading || !session || !isSuperAdmin) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">লোড হচ্ছে...</div>;
  }

  return <Outlet />;
}
