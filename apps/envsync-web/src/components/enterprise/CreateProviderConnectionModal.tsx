import { useState, useEffect } from "react";
import { toast } from "sonner";

import {
  useCreateProviderConnection,
  useOrgSecrets,
} from "@/api/enterprise/hooks";
import type { EnterpriseProvider } from "@/api/enterprise/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  emptyFieldValues,
  enterpriseProviderUi,
  mergeFieldValuesIntoRecord,
  type ProviderFieldConfig,
} from "@/lib/enterprise-provider-ui";

type FieldState = Record<string, string>;

function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-zinc-500">{text}</p>;
}

function ProviderFieldEditor({
  field,
  value,
  onChange,
  secretOptions = [],
}: {
  field: ProviderFieldConfig;
  value: string;
  onChange: (value: string) => void;
  secretOptions?: string[];
}) {
  const commonClassName = "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white";
  const listId = `${field.key}-secret-options`;

  return (
    <label className="space-y-2">
      <span className="text-sm text-zinc-400">{field.label}</span>
      {field.kind === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={commonClassName}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            list={field.kind === "secret-ref" ? listId : undefined}
          />
          {field.kind === "secret-ref" && secretOptions.length > 0 && (
            <datalist id={listId}>
              {secretOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </>
      )}
      <FieldHint text={field.helper} />
    </label>
  );
}

interface CreateProviderConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerFilter?: EnterpriseProvider;
}

export function CreateProviderConnectionModal({
  open,
  onOpenChange,
  providerFilter,
}: CreateProviderConnectionModalProps) {
  const createProviderConnection = useCreateProviderConnection();
  const { data: orgSecrets = [] } = useOrgSecrets();
  const orgSecretKeys = orgSecrets.map((secret) => secret.key);

  const [form, setForm] = useState({
    provider_type: providerFilter ?? ("github" as EnterpriseProvider),
    name: "",
    status: "active" as "active" | "inactive" | "error",
    authFields: emptyFieldValues(enterpriseProviderUi[providerFilter ?? "github"].connectionAuthFields),
    metadataFields: emptyFieldValues(enterpriseProviderUi[providerFilter ?? "github"].connectionMetadataFields),
    authRaw: "{}",
    metadataRaw: "{}",
  });

  const providerConfig = enterpriseProviderUi[form.provider_type];

  useEffect(() => {
    if (!open) return;
    const defaultProvider = providerFilter ?? "github";
    setForm({
      provider_type: defaultProvider,
      name: "",
      status: "active",
      authFields: emptyFieldValues(enterpriseProviderUi[defaultProvider].connectionAuthFields),
      metadataFields: emptyFieldValues(enterpriseProviderUi[defaultProvider].connectionMetadataFields),
      authRaw: "{}",
      metadataRaw: "{}",
    });
  }, [open, providerFilter]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createProviderConnection.mutateAsync({
        provider_type: form.provider_type,
        name: form.name,
        status: form.status,
        auth_config: mergeFieldValuesIntoRecord(
          providerConfig.connectionAuthFields,
          form.authFields,
          JSON.parse(form.authRaw) as Record<string, unknown>,
        ),
        metadata: mergeFieldValuesIntoRecord(
          providerConfig.connectionMetadataFields,
          form.metadataFields,
          JSON.parse(form.metadataRaw) as Record<string, unknown>,
        ),
      });
      toast.success("Provider connection created.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create provider connection.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-zinc-800 bg-zinc-950 sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-zinc-100">Create Provider Connection</SheetTitle>
          <SheetDescription className="text-zinc-500">
            {providerConfig.providerHeadline}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {!providerFilter && (
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Provider</span>
              <select
                value={form.provider_type}
                onChange={(event) =>
                  setForm({
                    provider_type: event.target.value as EnterpriseProvider,
                    name: "",
                    status: "active",
                    authFields: emptyFieldValues(enterpriseProviderUi[event.target.value as EnterpriseProvider].connectionAuthFields),
                    metadataFields: emptyFieldValues(enterpriseProviderUi[event.target.value as EnterpriseProvider].connectionMetadataFields),
                    authRaw: "{}",
                    metadataRaw: "{}",
                  })
                }
                className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {Object.values(enterpriseProviderUi).map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-2">
            <span className="text-sm text-zinc-400">Connection name</span>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={`${providerConfig.name} production`}
              className="border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-zinc-400">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "active" | "inactive" | "error" }))}
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="error">error</option>
            </select>
          </label>

          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Auth fields</p>
            {providerConfig.connectionAuthFields.map((field) => (
              <ProviderFieldEditor
                key={field.key}
                field={field}
                value={form.authFields[field.key] ?? ""}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    authFields: { ...prev.authFields, [field.key]: value },
                  }))
                }
                secretOptions={field.kind === "secret-ref" ? orgSecretKeys : []}
              />
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Metadata fields</p>
            {providerConfig.connectionMetadataFields.map((field) => (
              <ProviderFieldEditor
                key={field.key}
                field={field}
                value={form.metadataFields[field.key] ?? ""}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    metadataFields: { ...prev.metadataFields, [field.key]: value },
                  }))
                }
              />
            ))}
          </div>

          <details className="rounded-lg border border-zinc-800 p-3">
            <summary className="cursor-pointer text-xs font-medium text-zinc-400">Advanced JSON</summary>
            <div className="mt-3 grid gap-3">
              <label className="space-y-1.5">
                <span className="text-xs text-zinc-500">Additional auth config</span>
                <Textarea
                  value={form.authRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, authRaw: event.target.value }))}
                  className="min-h-[80px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-zinc-500">Additional metadata</span>
                <Textarea
                  value={form.metadataRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, metadataRaw: event.target.value }))}
                  className="min-h-[80px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                />
              </label>
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
              disabled={createProviderConnection.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {createProviderConnection.isPending ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
