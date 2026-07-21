import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
};

export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        // Enumerate cameras — prefer back camera
        let cams: MediaDeviceInfo[] = [];
        try {
          cams = await (BrowserMultiFormatReader as any).listVideoInputDevices();
        } catch { /* ignore */ }
        if (cancelled) return;
        setDevices(cams);
        const back = cams.find((d) => /back|rear|environment/i.test(d.label));
        const chosen = deviceId ?? back?.deviceId ?? cams[0]?.deviceId ?? null;
        setDeviceId(chosen);

        const controls = await reader.decodeFromVideoDevice(
          chosen ?? undefined,
          videoRef.current!,
          (result, _err, ctl) => {
            if (result) {
              const text = result.getText();
              try { ctl.stop(); } catch { /* ignore */ }
              controlsRef.current = null;
              onDetected(text);
              onOpenChange(false);
            }
          },
        );
        controlsRef.current = controls as unknown as { stop: () => void };
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? "ক্যামেরা চালু করা যায়নি";
        setError(msg);
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* ignore */ }
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 sm:p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> বারকোড স্ক্যান
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-4/5 rounded-lg border-2 border-orange-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <div className="text-xs text-muted-foreground">
            {devices.length > 1 ? `${devices.length} ক্যামেরা` : "স্ক্যান হচ্ছে..."}
          </div>
          <div className="flex gap-2">
            {devices.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const idx = devices.findIndex((d) => d.deviceId === deviceId);
                  const next = devices[(idx + 1) % devices.length];
                  setDeviceId(next.deviceId);
                }}
              >
                <Camera className="mr-1 h-3.5 w-3.5" /> সুইচ
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-1 h-3.5 w-3.5" /> বন্ধ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}