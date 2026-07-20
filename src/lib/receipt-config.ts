import { useEffect, useState } from "react";

export type SeparatorStyle = "dashed" | "dotted" | "solid" | "double" | "stars";

export type ReceiptConfig = {
  fontSize: number;        // px, base text
  titleSize: number;       // px, shop title
  totalSize: number;       // px, total row
  lineHeight: number;      // unitless
  paperWidth: number;      // mm (80 or 58)
  marginX: number;         // mm horizontal padding
  marginY: number;         // mm vertical padding
  separator: SeparatorStyle;
  fontFamily: string;      // css font-family
  autoPrint: boolean;      // if false, always show preview
};

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  fontSize: 12,
  titleSize: 15,
  totalSize: 14,
  lineHeight: 1.25,
  paperWidth: 80,
  marginX: 3,
  marginY: 4,
  separator: "dashed",
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  autoPrint: false,
};

const STORAGE_KEY = "supershop.receipt.config.v1";

export function loadReceiptConfig(): ReceiptConfig {
  if (typeof window === "undefined") return DEFAULT_RECEIPT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RECEIPT_CONFIG;
    return { ...DEFAULT_RECEIPT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_RECEIPT_CONFIG;
  }
}

export function saveReceiptConfig(cfg: ReceiptConfig) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function useReceiptConfig() {
  const [cfg, setCfg] = useState<ReceiptConfig>(DEFAULT_RECEIPT_CONFIG);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setCfg(loadReceiptConfig());
    setReady(true);
  }, []);
  const update = (patch: Partial<ReceiptConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      saveReceiptConfig(next);
      return next;
    });
  };
  const reset = () => {
    setCfg(DEFAULT_RECEIPT_CONFIG);
    saveReceiptConfig(DEFAULT_RECEIPT_CONFIG);
  };
  return { cfg, update, reset, ready };
}

export function separatorChar(s: SeparatorStyle): string {
  switch (s) {
    case "dotted":
      return "................................";
    case "solid":
      return "________________________________";
    case "double":
      return "================================";
    case "stars":
      return "* * * * * * * * * * * * * * * *";
    case "dashed":
    default:
      return "--------------------------------";
  }
}

/** Build the <style> block that applies the config to #pos-receipt. */
export function receiptStyleCss(cfg: ReceiptConfig): string {
  const widthPx = Math.round((cfg.paperWidth / 80) * 302);
  return `
    @page { size: ${cfg.paperWidth}mm auto; margin: 0; }
    @media print {
      html, body { background: white !important; margin: 0; padding: 0; }
      aside, .print\\:hidden { display: none !important; }
      #pos-receipt {
        width: ${cfg.paperWidth}mm;
        box-shadow: none;
        padding: ${cfg.marginY}mm ${cfg.marginX}mm;
      }
    }
    #pos-receipt {
      width: ${widthPx}px;
      font-family: ${cfg.fontFamily};
      font-size: ${cfg.fontSize}px;
      line-height: ${cfg.lineHeight};
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    #pos-receipt .r-title { font-size: ${cfg.titleSize}px; }
    #pos-receipt .r-total { font-size: ${cfg.totalSize}px; }
    #pos-receipt .r-wrap { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  `;
}
