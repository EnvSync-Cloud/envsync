import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Eye,
  EyeOff,
  Copy,
  Edit,
  Trash2,
  MoreHorizontal,
  Key,
  Shield,
  Calendar,
  User,
  X,
  CheckCircle2,
  Download,
  XCircle,
  Save,
  History,
} from "lucide-react";
import { EnvironmentVariable, EnvironmentType, SingleItemEnvVarUpdateData } from "@/constants";
import { useCopy } from "@/hooks/useClipboard";
import { cn } from "@/lib/utils";
import { Count } from "../ui/count";

/** Detect keys that look like secrets even when API doesn't mark them sensitive */
const SENSITIVE_KEY_PATTERN = /(?:^|[_-])(?:secret|password|token|auth|credential|private|api[_-]?key)(?:[_-]|$)/i;

function isSensitiveVariable(variable: EnvironmentVariable): boolean {
  return variable.sensitive || SENSITIVE_KEY_PATTERN.test(variable.key);
}

interface InlineEditState {
  value: string;
  isDirty: boolean;
}

interface EnvironmentVariablesTableProps {
  variables: EnvironmentVariable[];
  environmentTypes: EnvironmentType[];
  selectedEnvironment: string;
  setSelectedEnvironment: (envTypeId: string) => void;
  canEdit: boolean;
  onEdit: (variable: EnvironmentVariable) => void;
  onDelete: (variable: EnvironmentVariable) => void;
  onViewHistory?: (variable: EnvironmentVariable) => void;
  onInlineEdit?: (data: SingleItemEnvVarUpdateData) => Promise<void>;
  onBulkDelete?: (variables: EnvironmentVariable[]) => void;
  onBulkExport?: (variables: EnvironmentVariable[]) => void;
  isSecrets?: boolean;
}

export const EnvironmentVariablesTable = ({
  variables,
  environmentTypes,
  selectedEnvironment,
  setSelectedEnvironment,
  canEdit,
  onEdit,
  onDelete,
  onViewHistory,
  onInlineEdit,
  onBulkDelete,
  onBulkExport,
  isSecrets,
}: EnvironmentVariablesTableProps) => {
  const [lastCopiedValue, setLastCopiedValue] = useState<string | null>(null);
  const copy = useCopy({
    onSuccess: (value) => {
      setLastCopiedValue(value);
      window.setTimeout(() => setLastCopiedValue(null), 1500);
    },
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  // Inline editing state
  const [editingRows, setEditingRows] = useState<Record<string, InlineEditState>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  const environmentTypesMap = useMemo(() => {
    return new Map(environmentTypes.map((env) => [env.id, env]));
  }, [environmentTypes]);

  const filteredVariables = useMemo(() => {
    let filtered = variables;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (variable) =>
          variable.key.toLowerCase().includes(query) ||
          (!isSensitiveVariable(variable) && variable.value.toLowerCase().includes(query))
      );
    }

    if (selectedEnvironment !== "all") {
      filtered = filtered.filter(
        (variable) => variable.env_type_id === selectedEnvironment
      );
    }

    return filtered.sort((a, b) => a.key.localeCompare(b.key));
  }, [variables, searchQuery, selectedEnvironment]);

  const selectedVariables = useMemo(() => {
    return filteredVariables.filter((v) => selectedRows[v.id]);
  }, [filteredVariables, selectedRows]);

  const hasDirtyRows = Object.values(editingRows).some((row) => row.isDirty);

  const toggleSensitiveVisibility = (variableId: string) => {
    setShowSensitive((prev) => ({
      ...prev,
      [variableId]: !prev[variableId],
    }));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getEnvironmentBadge = (envTypeId: string) => {
    const envType = environmentTypesMap.get(envTypeId);
    if (!envType) return null;

    return (
      <Badge
        variant="secondary"
        className="text-xs"
        style={{
          backgroundColor: `${envType.color}20`,
          color: envType.color,
          borderColor: `${envType.color}40`,
        }}
      >
        {envType.name}
      </Badge>
    );
  };

  const showEnvironmentColumn = selectedEnvironment === "all";
  const visibleSelectedCount = filteredVariables.filter((variable) => selectedRows[variable.id]).length;
  const allVisibleSelected = filteredVariables.length > 0 && visibleSelectedCount === filteredVariables.length;

  const toggleAllVisible = (checked: boolean) => {
    setSelectedRows((prev) => {
      const next = { ...prev };
      filteredVariables.forEach((variable) => {
        next[variable.id] = checked;
      });
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));
  };

  const clearSelection = () => {
    setSelectedRows({});
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedVariables.length > 0) {
      onBulkDelete(selectedVariables);
    }
  };

  const handleBulkExport = () => {
    if (onBulkExport && selectedVariables.length > 0) {
      onBulkExport(selectedVariables);
    }
  };

  // Inline editing functions
  const startEditing = useCallback((variable: EnvironmentVariable) => {
    setEditingRows((prev) => ({
      ...prev,
      [variable.id]: {
        value: variable.value,
        isDirty: false,
      },
    }));
  }, []);

  const cancelEditing = useCallback((variableId: string) => {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[variableId];
      return next;
    });
  }, []);

  const updateEditValue = useCallback((variableId: string, value: string) => {
    setEditingRows((prev) => ({
      ...prev,
      [variableId]: {
        ...prev[variableId],
        value,
        isDirty: true,
      },
    }));
  }, []);

  const saveInlineEdit = useCallback(async (variable: EnvironmentVariable) => {
    if (!onInlineEdit) return;
    
    const editState = editingRows[variable.id];
    if (!editState || !editState.isDirty) return;

    setSavingRows((prev) => ({ ...prev, [variable.id]: true }));
    
    try {
      await onInlineEdit({
        originalKey: variable.key,
        value: editState.value,
        env_type_id: variable.env_type_id,
      });
      
      // Remove from editing state on success
      setEditingRows((prev) => {
        const next = { ...prev };
        delete next[variable.id];
        return next;
      });
    } catch (error) {
      // Keep in editing state on error
      console.error("Failed to save inline edit:", error);
    } finally {
      setSavingRows((prev) => {
        const next = { ...prev };
        delete next[variable.id];
        return next;
      });
    }
  }, [onInlineEdit, editingRows]);

  const saveAllDirtyRows = useCallback(async () => {
    if (!onInlineEdit) return;

    const dirtyEntries = Object.entries(editingRows).filter(([_, state]) => state.isDirty);
    
    for (const [variableId, _] of dirtyEntries) {
      const variable = variables.find((v) => v.id === variableId);
      if (variable) {
        await saveInlineEdit(variable);
      }
    }
  }, [onInlineEdit, editingRows, variables, saveInlineEdit]);

  const discardAllEdits = useCallback(() => {
    setEditingRows({});
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, variable: EnvironmentVariable) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        saveInlineEdit(variable);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing(variable.id);
      }
    },
    [saveInlineEdit, cancelEditing]
  );

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center">
            {isSecrets ? (
              <Shield className="size-6 mr-2 text-destructive" />
            ) : (
              <Key className="size-6 mr-2 text-primary" />
            )}
            {isSecrets ? "Secrets" : "Variables"}
            <Count
              count={filteredVariables.length}
              variant="subtle"
              size="xl"
              className="ml-2"
            />
          </CardTitle>

        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={isSecrets ? "Search secrets…" : "Search variables…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Edits Bar */}
        {hasDirtyRows && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
                {Object.values(editingRows).filter((r) => r.isDirty).length} unsaved changes
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveAllDirtyRows}
              >
                <Save className="mr-2 size-4" />
                Save all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={discardAllEdits}
              >
                <XCircle className="mr-1 size-4" />
                Discard all
              </Button>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {visibleSelectedCount > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {visibleSelectedCount} selected
              </Badge>
              {!allVisibleSelected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80 h-7 px-2"
                  onClick={() => toggleAllVisible(true)}
                >
                  Select all {filteredVariables.length}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onBulkExport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                >
                  <Download className="mr-2 size-4" />
                  Export {visibleSelectedCount}
                </Button>
              )}
              {canEdit && onBulkDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete {visibleSelectedCount}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-7 px-2"
                onClick={clearSelection}
              >
                <XCircle className="mr-1 size-4" />
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredVariables.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Key className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery ? "No variables found" : "No variables"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "No variables match your current search"
                : "Add your first variable to get started"}
            </p>
            {searchQuery && (
              <Button
                onClick={() => setSearchQuery("")}
                variant="outline"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-left">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))}
                      aria-label="Select all visible rows"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Key
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Value
                  </th>
                  {showEnvironmentColumn && (
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                      Environment
                    </th>
                  )}
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    Updated
                  </th>
                  {canEdit && (
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredVariables.map((variable) => {
                  const isEditing = Boolean(editingRows[variable.id]);
                  const editState = editingRows[variable.id];
                  const isSaving = savingRows[variable.id];

                  return (
                    <tr
                      key={variable.id}
                      className={cn(
                        "border-b border-border transition-colors",
                        isEditing
                          ? "bg-muted/30"
                          : "hover:bg-muted/50",
                        selectedRows[variable.id] && "bg-primary/5",
                        "text-sm"
                      )}
                    >
                      <td className="px-4 py-4 align-top">
                        <Checkbox
                          checked={Boolean(selectedRows[variable.id])}
                          onCheckedChange={(checked) => toggleRow(variable.id, Boolean(checked))}
                          aria-label={`Select ${variable.key}`}
                        />
                      </td>
                      
                      {/* Key column */}
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="flex items-start space-x-2">
                            <div className="flex-1">
                              <code className="text-sm font-mono text-primary bg-muted px-2 py-1 rounded block">
                                {variable.key}
                              </code>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Key cannot be changed
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start space-x-2">
                            <div>
                              <code className="text-sm font-mono text-primary bg-muted px-2 py-1 rounded">
                                {variable.key}
                              </code>
                              {isSecrets && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Encrypted secret entry
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => copy.mutate(variable.key)}
                              aria-label="Copy variable key"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {lastCopiedValue === variable.key && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">
                                <CheckCircle2 className="h-3 w-3" />
                                Copied
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Value column */}
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <div className="flex items-center space-x-2 max-w-xs">
                            <Input
                              value={editState?.value || ""}
                              onChange={(e) => updateEditValue(variable.id, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, variable)}
                              type={isSensitiveVariable(variable) ? "password" : "text"}
                              className="font-mono text-sm"
                              disabled={isSaving}
                              autoFocus
                            />
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-primary hover:text-primary/80"
                                onClick={() => saveInlineEdit(variable)}
                                disabled={isSaving || !editState?.isDirty}
                                aria-label="Save changes"
                              >
                                {isSaving ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => cancelEditing(variable.id)}
                                disabled={isSaving}
                                aria-label="Cancel editing"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 max-w-xs">
                            {isSensitiveVariable(variable) ? (
                              <div className="flex items-center space-x-2">
                                <code className="hdx-mask select-none text-sm font-mono text-foreground bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {showSensitive[variable.id]
                                    ? variable.value
                                    : "••••••••"}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    toggleSensitiveVisibility(variable.id)
                                  }
                                  aria-label={showSensitive[variable.id] ? "Hide value" : "Show value"}
                                >
                                  {showSensitive[variable.id] ? (
                                    <EyeOff className="h-3 w-3" />
                                  ) : (
                                    <Eye className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => copy.mutate(variable.value)}
                                  aria-label="Copy value"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <code className="hdx-mask select-all text-sm font-mono text-foreground bg-muted px-2 py-1 rounded flex-1 truncate">
                                  {variable.value}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => copy.mutate(variable.value)}
                                  aria-label="Copy value"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {showEnvironmentColumn && (
                        <td className="py-4 px-4">
                          {getEnvironmentBadge(variable.env_type_id)}
                        </td>
                      )}

                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(variable.updated_at)}</span>
                        </div>
                        {variable.created_by && (
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                            <User className="w-3 h-3" />
                            <span>{variable.created_by.name}</span>
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="p-4 flex justify-end">
                          {isEditing ? (
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveInlineEdit(variable)}
                                disabled={isSaving || !editState?.isDirty}
                              >
                                {isSaving ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelEditing(variable.id)}
                                disabled={isSaving}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                                  aria-label="Row actions"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {onInlineEdit && (
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => startEditing(variable)}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Quick Edit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onSelect={() => onEdit(variable)}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Full Edit
                                </DropdownMenuItem>
                                {onViewHistory && (
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => onViewHistory(variable)}
                                  >
                                    <History className="w-4 h-4 mr-2" />
                                    Version History
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive cursor-pointer"
                                  onClick={() => onDelete(variable)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {isSecrets ? "Delete Secret" : "Delete Variable"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
