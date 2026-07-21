import { toast } from "sonner";

export async function copyToClipboard(text: string, successMessage = "কপি হয়েছে") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("কপি করা যায়নি");
    return false;
  }
}

export async function nativeShare(url: string, title: string, text?: string) {
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title, text, url });
      return true;
    }
  } catch { /* cancelled */ }
  return copyToClipboard(url, "লিংক কপি হয়েছে");
}

export function whatsappShareUrl(text: string, phone?: string | null) {
  const base = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function openWhatsAppShare(url: string, invoiceNo?: string | null, phone?: string | null) {
  const msg = `ইনভয়েস ${invoiceNo ? `#${invoiceNo}` : ""}: ${url}`;
  window.open(whatsappShareUrl(msg, phone), "_blank", "noopener,noreferrer");
}

/**
 * PDF snapshot of a DOM element (typically the InvoicePreview).
 * Uses lazy imports so the base bundle stays small.
 */
export async function downloadInvoicePdf(elementId: string, filename: string) {
  const el = typeof document !== "undefined" ? document.getElementById(elementId) : null;
  if (!el) {
    toast.error("প্রিভিউ পাওয়া যায়নি");
    return;
  }
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const availW = pageW - margin * 2;
    const ratio = canvas.height / canvas.width;
    let w = availW;
    let h = availW * ratio;
    if (h > pageH - margin * 2) { h = pageH - margin * 2; w = h / ratio; }
    pdf.addImage(imgData, "PNG", (pageW - w) / 2, margin, w, h);
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
    toast.success("PDF ডাউনলোড হয়েছে");
  } catch (e: any) {
    toast.error(e?.message ?? "PDF তৈরি করা যায়নি");
  }
}

export function printElement(elementId: string) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(elementId);
  if (!el) return;
  document.body.classList.add("printing-invoice");
  // Ensure a wrapper class exists so print CSS knows what to keep visible
  el.closest(".invoice-print-root") ?? el.parentElement?.classList.add("invoice-print-root");
  const done = () => {
    document.body.classList.remove("printing-invoice");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 2000);
}