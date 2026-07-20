import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Printer, Settings2, X } from "lucide-react";
import {
  useReceiptConfig,
  type ReceiptConfig,
  type SeparatorStyle,
} from "@/lib/receipt-config";

type Props = {
  children: React.ReactNode;
  /** show preview modal automatically on mount */
  autoOpen?: boolean;
};

/**
 * Wraps a POS receipt. Renders:
 *  - the printable receipt itself (children with id="pos-receipt")
 *  - a floating toolbar (hidden in print) with Print / Settings
 *  - an on-screen preview modal that opens before printing
 *  - a settings sheet to configure font size, margins, separator, etc.
 *
 * If auto-print is disabled or unsupported, users can print manually
 * from the toolbar or preview modal.
 */
export function ReceiptShell({ children, autoOpen = true }: Props) {
  const { cfg, update, reset, ready } = useReceiptConfig();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printSupported, setPrintSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.print !== "function") {
      setPrintSupported(false);
    }
  }, []);

  // Open preview once the config has loaded.
  useEffect(() => {
    if (ready && autoOpen) setPreviewOpen(true);
  }, [ready, autoOpen]);

  const doPrint = () => {
    try {
      if (typeof window.print === "function") {
        window.print();
      } else {
        setPrintSupported(false);
        alert(
          "এই ব্রাউজার/ডিভাইসে অটো-প্রিন্ট সাপোর্ট নেই। ব্রাউজার মেন্যু থেকে Print নির্বাচন করুন (Ctrl/Cmd + P)।",
        );
      }
    } catch {
      setPrintSupported(false);
    }
  };

  return (
    <>
      {/* Floating toolbar — hidden during print */}
      <div className="mx-auto mb-3 flex max-w-[302px] items-center justify-end gap-2 print:hidden">
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-1 h-4 w-4" /> টেমপ্লেট
            </Button>
          </SheetTrigger>
          <SettingsSheet cfg={cfg} update={update} reset={reset} />
        </Sheet>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          প্রিভিউ
        </Button>
        <Button size="sm" onClick={doPrint}>
          <Printer className="mr-1 h-4 w-4" /> প্রিন্ট
        </Button>
      </div>

      {children}

      {/* Preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-[420px] overflow-hidden p-0">
          <DialogHeader className="border-b p-4">
            <DialogTitle>প্রিন্ট প্রিভিউ</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto bg-muted/40 p-4">
            <PreviewClone />
          </div>
          <DialogFooter className="gap-2 border-t p-4 sm:justify-between">
            {!printSupported && (
              <p className="text-xs text-destructive">
                অটো-প্রিন্ট সাপোর্ট নেই — Ctrl/Cmd + P চাপুন।
              </p>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
                <X className="mr-1 h-4 w-4" /> বন্ধ
              </Button>
              <Button
                onClick={() => {
                  setPreviewOpen(false);
                  setTimeout(doPrint, 150);
                }}
              >
                <Printer className="mr-1 h-4 w-4" /> প্রিন্ট
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Clones the on-page #pos-receipt into the modal so preview matches print exactly. */
function PreviewClone() {
  const [html, setHtml] = useState<string>("");
  useEffect(() => {
    const el = document.getElementById("pos-receipt");
    if (el) setHtml(el.outerHTML);
  });
  return (
    <div
      className="mx-auto"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SettingsSheet({
  cfg,
  update,
  reset,
}: {
  cfg: ReceiptConfig;
  update: (p: Partial<ReceiptConfig>) => void;
  reset: () => void;
}) {
  return (
    <SheetContent side="right" className="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>রিসিট টেমপ্লেট সেটিংস</SheetTitle>
      </SheetHeader>
      <div className="mt-4 grid gap-4 text-sm">
        <Field label="কাগজের প্রস্থ (mm)">
          <Select
            value={String(cfg.paperWidth)}
            onValueChange={(v) => update({ paperWidth: Number(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58 mm</SelectItem>
              <SelectItem value="80">80 mm</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="সাধারণ ফন্ট সাইজ (px)">
          <Input
            type="number" min={9} max={20}
            value={cfg.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
          />
        </Field>
        <Field label="শিরোনাম সাইজ (px)">
          <Input
            type="number" min={12} max={26}
            value={cfg.titleSize}
            onChange={(e) => update({ titleSize: Number(e.target.value) })}
          />
        </Field>
        <Field label="মোট সাইজ (px)">
          <Input
            type="number" min={11} max={22}
            value={cfg.totalSize}
            onChange={(e) => update({ totalSize: Number(e.target.value) })}
          />
        </Field>
        <Field label="লাইন হাইট">
          <Input
            type="number" step={0.05} min={1} max={2}
            value={cfg.lineHeight}
            onChange={(e) => update({ lineHeight: Number(e.target.value) })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="মার্জিন X (mm)">
            <Input
              type="number" min={0} max={10}
              value={cfg.marginX}
              onChange={(e) => update({ marginX: Number(e.target.value) })}
            />
          </Field>
          <Field label="মার্জিন Y (mm)">
            <Input
              type="number" min={0} max={10}
              value={cfg.marginY}
              onChange={(e) => update({ marginY: Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label="সেপারেটর স্টাইল">
          <Select
            value={cfg.separator}
            onValueChange={(v) => update({ separator: v as SeparatorStyle })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dashed">Dashed  ----</SelectItem>
              <SelectItem value="dotted">Dotted  ....</SelectItem>
              <SelectItem value="solid">Solid  ____</SelectItem>
              <SelectItem value="double">Double  ====</SelectItem>
              <SelectItem value="stars">Stars  * *</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="text-sm">অটো-প্রিন্ট</Label>
            <p className="text-xs text-muted-foreground">
              রিসিট খুললেই সরাসরি প্রিন্ট ডায়ালগ আসবে।
            </p>
          </div>
          <Switch
            checked={cfg.autoPrint}
            onCheckedChange={(v) => update({ autoPrint: v })}
          />
        </div>

        <Button variant="outline" onClick={reset}>
          ডিফল্টে ফিরে যান
        </Button>
      </div>
    </SheetContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
