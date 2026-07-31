import { useState, useEffect } from "react";
import { toast } from "sonner";

import { useCreateOrgSecret } from "../api/hooks";
import type { EnterpriseProvider } from "../api/types";
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

interface CreateOrgSecretModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerFilter?: EnterpriseProvider;
}

export function CreateOrgSecretModal({
  open,
  onOpenChange,
  providerFilter,
}: CreateOrgSecretModalProps) {
  const createOrgSecret = useCreateOrgSecret();

  const [form, setForm] = useState({
    key: "",
    value: "",
    description: "",
    providerRefs: providerFilter ?? "",
    rotationPolicy: "manual",
    metadataRaw: "{}",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      key: "",
      value: "",
      description: "",
      providerRefs: providerFilter ?? "",
      rotationPolicy: "manual",
      metadataRaw: "{}",
    });
  }, [open, providerFilter]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const providerRefs = form.providerRefs
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      await createOrgSecret.mutateAsync({
        key: form.key,
        value: form.value,
        description: form.description || null,
        metadata: {
          ...JSON.parse(form.metadataRaw) as Record<string, unknown>,
          ...(providerRefs.length > 0 ? { provider_refs: providerRefs } : {}),
          ...(form.rotationPolicy ? { rotation_policy: form.rotationPolicy } : {}),
        },
      });
      toast.success("Org secret created.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create org secret.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-border bg-card sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Create Org Secret</SheetTitle>
          <SheetDescription className="text-tertiary">
            Create reusable secret material once, then reference it from provider connections and project mappings.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Key</span>
            <Input
              value={form.key}
              onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
              placeholder="github-app-private-key"
              className="border-border bg-card text-foreground"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Value</span>
            <Textarea
              value={form.value}
              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
              className="min-h-[100px] border-border bg-card text-foreground font-mono text-xs"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Description</span>
            <Input
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Used by enterprise sync flows"
              className="border-border bg-card text-foreground"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Provider refs</span>
              <Input
                value={form.providerRefs}
                onChange={(event) => setForm((prev) => ({ ...prev, providerRefs: event.target.value }))}
                placeholder="github,vercel"
                className="border-border bg-card text-foreground"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Rotation policy</span>
              <select
                value={form.rotationPolicy}
                onChange={(event) => setForm((prev) => ({ ...prev, rotationPolicy: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="manual">manual</option>
                <option value="scheduled">scheduled</option>
                <option value="external">external</option>
              </select>
            </label>
          </div>

          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced metadata JSON</summary>
            <div className="mt-3">
              <Textarea
                value={form.metadataRaw}
                onChange={(event) => setForm((prev) => ({ ...prev, metadataRaw: event.target.value }))}
                className="min-h-[80px] border-border bg-card text-foreground font-mono text-xs"
              />
            </div>
          </details>

          <SheetFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createOrgSecret.isPending}
              className="bg-emerald-600 text-foreground hover:bg-emerald-700"
            >
              {createOrgSecret.isPending ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
