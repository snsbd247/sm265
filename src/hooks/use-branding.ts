import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getBranding } from "@/lib/admin.functions";

export type Branding = {
  site_name?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
  footer_note?: string | null;
  updated_at?: string | null;
};

export function useBranding() {
  const fn = useServerFn(getBranding);
  const q = useQuery<Branding | null>({
    queryKey: ["branding"],
    queryFn: () => fn() as any,
    staleTime: 5 * 60 * 1000,
  });
  const brand = q.data ?? null;
  return {
    brand,
    siteName: brand?.site_name || "Supershop",
    tagline: brand?.tagline || "",
    logoUrl: brand?.logo_url || "",
    faviconUrl: brand?.favicon_url || "",
    footerNote: brand?.footer_note || "",
    version: brand?.updated_at || "",
  };
}

/** Append a cache-busting version to non-data URLs. Data URLs are content-addressed. */
function bust(url: string, version: string) {
  if (!url || url.startsWith("data:")) return url;
  const v = encodeURIComponent(version || "1");
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

/** Applies favicon + document title from branding. Renders nothing. */
export function BrandingEffect() {
  const { siteName, faviconUrl, version } = useBranding();
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (faviconUrl) {
      // Remove any existing icon links so the browser picks up the new one
      document.querySelectorAll("link[rel~='icon']").forEach((el) => el.parentElement?.removeChild(el));
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = bust(faviconUrl, version);
      document.head.appendChild(link);
    }
    if (siteName && !document.title.includes(siteName)) {
      document.title = document.title ? `${document.title} — ${siteName}` : siteName;
    }
  }, [faviconUrl, siteName, version]);
  return null;
}

