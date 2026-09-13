import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCreateOrgKmsCredential } from "../api/hooks";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Textarea } from "@shell/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

interface CreateKmsCredentialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateKmsCredentialModal({
  open,
  onOpenChange,
  onCreated,
}: CreateKmsCredentialModalProps) {
  const createCredential = useCreateOrgKmsCredential();
  const [form, setForm] = useState({ key: "", value: "", description: "" });

  useEffect(() => {
    if (!open) return;
    setForm({ key: "", value: "", description: "" });
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.key.trim() || !form.value.trim()) {
      toast.error("Key and credential value are required.");
      return;
    }
    try {
      const created = await createCredential.mutateAsync({
        key: form.key.trim(),
        value: form.value,
        description: form.description.trim() || null,
      });
      setForm({ key: "", value: "", description: "" });
      toast.success("KMS credential stored. The value is not shown again.");
      onCreated?.(created.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create KMS credential.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-border bg-card sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Add KMS credential</SheetTitle>
          <SheetDescription className="text-tertiary">
            Long-lived cloud keys used only for organization wrapping (AWS access key, GCP
            service-account JSON, or Azure client secret). The value is encrypted on write and
            never displayed after save.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm text-muted-foreground">Name *</span>
            <Input
              value={form.key}
              onChange={event => setForm(prev => ({ ...prev, key: event.target.value }))}
              placeholder="aws-kms-prod"
              autoComplete="off"
              className="border-border bg-card text-foreground"
            />
          </label>

          <label className="space-y-2 block">
            <span className="text-sm text-muted-foreground">Credential value *</span>
            <Textarea
              value={form.value}
              onChange={event => setForm(prev => ({ ...prev, value: event.target.value }))}
              className="min-h-[120px] border-border bg-card text-foreground font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="block text-xs text-muted-foreground">
              Paste the cloud credential here. It will not be shown in this dashboard after save.
            </span>
          </label>

          <label className="space-y-2 block">
            <span className="text-sm text-muted-foreground">Description</span>
            <Input
              value={form.description}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
              placeholder="AWS access key for org CMK"
              className="border-border bg-card text-foreground"
            />
          </label>

          <SheetFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCredential.isPending}>
              {createCredential.isPending ? "Saving…" : "Save credential"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
