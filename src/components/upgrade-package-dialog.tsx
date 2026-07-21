import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  message: string;
}

export function UpgradePackageDialog({ open, onOpenChange, title, message }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <TrendingUp className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">{title ?? "প্যাকেজ লিমিট শেষ"}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">{message}</p>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button asChild>
            <Link to="/app/subscription" onClick={() => onOpenChange(false)}>
              প্যাকেজ আপগ্রেড করুন
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}