// Client-side export helpers: CSV, Excel (xlsx), PDF (jsPDF + autotable)
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function toCSV(headers: string[], rows: (string | number)[][]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
}

export function downloadCSV(name: string, headers: string[], rows: (string | number)[][]) {
  const csv = toCSV(headers, rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, name.endsWith(".csv") ? name : `${name}.csv`);
}

export function downloadExcel(name: string, headers: string[], rows: (string | number)[][], sheetName = "Sheet1") {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, name.endsWith(".xlsx") ? name : `${name}.xlsx`);
}

export function downloadPDF(opts: {
  name: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(opts.title, 40, 40);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(opts.subtitle, 40, 58);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: opts.subtitle ? 72 : 56,
    head: [opts.headers],
    body: opts.rows.map(r => r.map(c => String(c ?? ""))),
    foot: opts.totalsRow ? [opts.totalsRow.map(c => String(c ?? ""))] : undefined,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
  });
  doc.save(opts.name.endsWith(".pdf") ? opts.name : `${opts.name}.pdf`);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
