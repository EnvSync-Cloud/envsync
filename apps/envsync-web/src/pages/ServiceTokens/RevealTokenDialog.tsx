import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCopy } from "@/hooks/useClipboard";

interface RevealTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  mode: "created" | "rotated";
}

export function RevealTokenDialog({
  open,
  onOpenChange,
  token,
  mode,
}: RevealTokenDialogProps) {
  const copy = useCopy();
  const title = mode === "rotated" ? "Service Token Rotated" : "Service Token Created";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      copy.reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="reveal-service-token-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Copy this token now. You will not be able to see the raw value again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="revealed-service-token">Service Token</Label>
          <div className="relative">
            <Textarea
              id="revealed-service-token"
              data-testid="revealed-service-token"
              readOnly
              value={token || ""}
              className="hdx-block pr-12 font-mono text-sm"
              rows={3}
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-2 top-2 h-8 w-8 p-0"
              onClick={() => token && copy.mutate(token)}
              aria-label="Copy service token"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => token && copy.mutate(token)} disabled={!token}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
