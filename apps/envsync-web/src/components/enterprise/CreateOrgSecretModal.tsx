import { useState, useEffect } from "react";
import { toast } from "sonner";

import { useCreateOrgSecret } from "@/api/enterprise/hooks";
import type { EnterpriseProvider } from "@/api/enterprise/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
        className="w-full border-zinc-800 bg-zinc-950 sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-zinc-100">Create Org Secret</SheetTitle>
          <SheetDescription className="text-zinc-500">
            Create reusable secret material once, then reference it from provider connections and project mappings.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="space-y-2">
            <span className="text-sm text-zinc-400">Key</span>
            <Input
              value={form.key}
              onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
              placeholder="github-app-private-key"
              className="border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-zinc-400">Value</span>
            <Textarea
              value={form.value}
              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
              className="min-h-[100px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-zinc-400">Description</span>
            <Input
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Used by enterprise sync flows"
              className="border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Provider refs</span>
              <Input
                value={form.providerRefs}
                onChange={(event) => setForm((prev) => ({ ...prev, providerRefs: event.target.value }))}
                placeholder="github,vercel"
                className="border-zinc-700 bg-zinc-900 text-zinc-100"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Rotation policy</span>
              <select
                value={form.rotationPolicy}
                onChange={(event) => setForm((prev) => ({ ...prev, rotationPolicy: event.target.value }))}
                className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                <option value="manual">manual</option>
                <option value="scheduled">scheduled</option>
                <option value="external">external</option>
              </select>
            </label>
          </div>

          <details className="rounded-lg border border-zinc-800 p-3">
            <summary className="cursor-pointer text-xs font-medium text-zinc-400">Advanced metadata JSON</summary>
            <div className="mt-3">
              <Textarea
                value={form.metadataRaw}
                onChange={(event) => setForm((prev) => ({ ...prev, metadataRaw: event.target.value }))}
                className="min-h-[80px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
              />
            </div>
          </details>

          <SheetFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createOrgSecret.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {createOrgSecret.isPending ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
