import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateServiceTokenInput } from "@/api/service-tokens.api";

export const ALL_ENVIRONMENTS_VALUE = "__all__";

export const EXPIRY_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "6 months" },
  { value: 365, label: "1 year" },
] as const;

export type ScopeDraft = {
  env_type_id: string;
  path: string;
};

export type ServiceTokenFormState = {
  name: string;
  scopes: ScopeDraft[];
  expires_in_days: number;
  access: "read" | "write";
};

export const INITIAL_SERVICE_TOKEN_FORM: ServiceTokenFormState = {
  name: "",
  scopes: [{ env_type_id: ALL_ENVIRONMENTS_VALUE, path: "/" }],
  expires_in_days: 90,
  access: "read",
};

interface CreateServiceTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ServiceTokenFormState;
  onFormChange: (form: ServiceTokenFormState) => void;
  environments: Array<{ id: string; name: string }>;
  isSubmitting: boolean;
  onSubmit: (input: CreateServiceTokenInput) => void;
  appId: string;
}

export function CreateServiceTokenDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  environments,
  isSubmitting,
  onSubmit,
  appId,
}: CreateServiceTokenDialogProps) {
  const updateScope = (index: number, patch: Partial<ScopeDraft>) => {
    onFormChange({
      ...form,
      scopes: form.scopes.map((scope, scopeIndex) =>
        scopeIndex === index ? { ...scope, ...patch } : scope,
      ),
    });
  };

  const addScope = () => {
    onFormChange({
      ...form,
      scopes: [...form.scopes, { env_type_id: ALL_ENVIRONMENTS_VALUE, path: "/" }],
    });
  };

  const removeScope = (index: number) => {
    if (form.scopes.length === 1) return;
    onFormChange({
      ...form,
      scopes: form.scopes.filter((_, scopeIndex) => scopeIndex !== index),
    });
  };

  const handleSubmit = () => {
    const name = form.name.trim();
    if (!name || isSubmitting) return;

    onSubmit({
      name,
      app_id: appId,
      scopes: form.scopes.map((scope) => ({
        env_type_id:
          scope.env_type_id === ALL_ENVIRONMENTS_VALUE ? null : scope.env_type_id,
        path: scope.path.trim() || "/",
      })),
      permissions: {
        read: true,
        write: form.access === "write",
      },
      expires_in_days: form.expires_in_days,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="create-service-token-dialog">
        <DialogHeader>
          <DialogTitle>Create Service Token</DialogTitle>
          <DialogDescription>
            Issue a project-scoped service token. The raw value is shown once after
            create or rotate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="service-token-name">Name</Label>
            <Input
              id="service-token-name"
              data-testid="service-token-name"
              placeholder="CI/CD Pipeline Token"
              value={form.name}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Scopes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addScope}
                disabled={isSubmitting}
                data-testid="add-scope"
              >
                <Plus className="mr-2 size-4" />
                Add Scope
              </Button>
            </div>

            <div className="space-y-3">
              {form.scopes.map((scope, index) => (
                <div
                  key={`scope-${index}`}
                  className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto]"
                  data-testid={`service-token-scope-${index}`}
                >
                  <div className="space-y-2">
                    <Label htmlFor={`service-token-env-${index}`}>Environment</Label>
                    <Select
                      value={scope.env_type_id}
                      onValueChange={(value) => updateScope(index, { env_type_id: value })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id={`service-token-env-${index}`}
                        data-testid={`service-token-scope-env-${index}`}
                      >
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_ENVIRONMENTS_VALUE}>All Environments</SelectItem>
                        {environments.map((environment) => (
                          <SelectItem key={environment.id} value={environment.id}>
                            {environment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`service-token-path-${index}`}>Secrets Path</Label>
                    <Input
                      id={`service-token-path-${index}`}
                      data-testid={`service-token-scope-path-${index}`}
                      value={scope.path}
                      onChange={(event) => updateScope(index, { path: event.target.value })}
                      placeholder="/"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeScope(index)}
                      disabled={isSubmitting || form.scopes.length === 1}
                      aria-label="Remove scope"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-token-expiry">Expiration</Label>
              <Select
                value={String(form.expires_in_days)}
                onValueChange={(value) =>
                  onFormChange({ ...form, expires_in_days: Number(value) })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="service-token-expiry" data-testid="service-token-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access</Label>
              <RadioGroup
                value={form.access}
                onValueChange={(value) =>
                  onFormChange({ ...form, access: value as "read" | "write" })
                }
                className="flex gap-4 pt-2"
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="read"
                    id="service-token-access-read"
                    data-testid="service-token-access-read"
                  />
                  <Label htmlFor="service-token-access-read" className="font-normal">
                    Read
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="write"
                    id="service-token-access-write"
                    data-testid="service-token-access-write"
                  />
                  <Label htmlFor="service-token-access-write" className="font-normal">
                    Read & Write
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.name.trim()}
            data-testid="create-service-token-submit"
          >
            {isSubmitting ? "Creating..." : "Create Service Token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
