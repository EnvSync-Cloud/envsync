import { useState, useMemo, useCallback } from "react";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
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
  CheckCircle2,
  Save,
  X,
  Download,
} from "lucide-react";
import { EnvironmentVariable, EnvironmentType, SingleItemEnvVarUpdateData } from "@/constants";
import { useCopy } from "@/hooks/useClipboard";

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
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [editingRows, setEditingRows] = useState<Record<string, InlineEditState>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  const environmentTypesMap = useMemo(() => {
    return new Map(environmentTypes.map((env) => [env.id, env]));
  }, [environmentTypes]);

  const filteredVariables = useMemo(() => {
    if (selectedEnvironment === "all") return variables;
    return variables.filter((v) => v.env_type_id === selectedEnvironment);
  }, [variables, selectedEnvironment]);

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

  const saveInlineEdit = useCallback(
    async (variable: EnvironmentVariable) => {
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

        setEditingRows((prev) => {
          const next = { ...prev };
          delete next[variable.id];
          return next;
        });
      } catch (error) {
        console.error("Failed to save inline edit:", error);
      } finally {
        setSavingRows((prev) => {
          const next = { ...prev };
          delete next[variable.id];
          return next;
        });
      }
    },
    [onInlineEdit, editingRows]
  );

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

  const columns: ColumnDef<EnvironmentVariable>[] = useMemo(
    () => [
      {
        id: "key",
        header: "Key",
        sortable: true,
        sortValue: (row) => row.key,
        accessor: (variable) => {
          const isEditing = Boolean(editingRows[variable.id]);

          if (isEditing) {
            return (
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
            );
          }

          return (
            <div className="flex items-start space-x-2">
              <div>
                <code className="text-sm font-mono text-primary bg-muted px-2 py-1 rounded">
                  {variable.key}
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isSecrets ? "Encrypted secret entry" : "Runtime variable"}
                </p>
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
          );
        },
      },
      {
        id: "value",
        header: "Value",
        sortable: false,
        accessor: (variable) => {
          const isEditing = Boolean(editingRows[variable.id]);
          const editState = editingRows[variable.id];
          const isSaving = savingRows[variable.id];

          if (isEditing) {
            return (
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
            );
          }

          return (
            <div className="flex items-center space-x-2 max-w-xs">
              {isSensitiveVariable(variable) ? (
                <div className="flex items-center space-x-2">
                  <code className="hdx-mask select-none text-sm font-mono text-foreground bg-muted px-2 py-1 rounded flex-1 truncate">
                    {showSensitive[variable.id] ? variable.value : "••••••••"}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleSensitiveVisibility(variable.id)}
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
          );
        },
      },
      {
        id: "environment",
        header: "Environment",
        sortable: true,
        sortValue: (row) => environmentTypesMap.get(row.env_type_id)?.name || "",
        accessor: (variable) => getEnvironmentBadge(variable.env_type_id),
      },
      {
        id: "updated",
        header: "Updated",
        sortable: true,
        sortValue: (row) => row.updated_at.getTime(),
        accessor: (variable) => (
          <div>
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
          </div>
        ),
      },
    ],
    [
      editingRows,
      savingRows,
      showSensitive,
      lastCopiedValue,
      isSecrets,
      environmentTypesMap,
      copy,
      updateEditValue,
      handleKeyDown,
      saveInlineEdit,
      cancelEditing,
      toggleSensitiveVisibility,
    ]
  );

  const actionsColumn: ColumnDef<EnvironmentVariable> = {
    id: "actions",
    header: "Actions",
    sortable: false,
    align: "right",
    accessor: (variable) => {
      const isEditing = Boolean(editingRows[variable.id]);
      const editState = editingRows[variable.id];
      const isSaving = savingRows[variable.id];

      if (isEditing) {
        return (
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
        );
      }

      return (
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
              onClick={() => onEdit(variable)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Full Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive cursor-pointer"
              onClick={() => onDelete(variable)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isSecrets ? "Delete Secret" : "Delete Variable"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  };

  const allColumns = canEdit ? [...columns, actionsColumn] : columns;

  const searchFilter = useCallback(
    (variable: EnvironmentVariable, query: string) => {
      return (
        variable.key.toLowerCase().includes(query) ||
        (!isSensitiveVariable(variable) && variable.value.toLowerCase().includes(query))
      );
    },
    []
  );

  const bulkActions = (
    <>
      {onBulkExport && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onBulkExport(filteredVariables.filter((v) => selectedRows[v.id]))}
        >
          <Download className="mr-2 size-4" />
          Export
        </Button>
      )}
      {canEdit && onBulkDelete && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onBulkDelete(filteredVariables.filter((v) => selectedRows[v.id]))}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </Button>
      )}
    </>
  );

  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  const emptyState = (
    <>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Key className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No variables
      </h3>
      <p className="text-muted-foreground mb-4">
        Add your first variable to get started
      </p>
    </>
  );

  const emptySearchState = (
    <>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Key className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No variables found
      </h3>
      <p className="text-muted-foreground mb-4">
        No variables match your current search
      </p>
    </>
  );

  return (
    <DataTable
      data={filteredVariables}
      columns={allColumns}
      getRowId={(row) => row.id}
      title={isSecrets ? "Secrets" : "Variables"}
      titleIcon={
        isSecrets ? (
          <Shield className="size-6 mr-2 text-destructive" />
        ) : (
          <Key className="size-6 mr-2 text-primary" />
        )
      }
      sortable={true}
      pagination={true}
      pageSize={20}
      selectable={canEdit}
      onSelectionChange={(selected) => {
        const newSelectedRows: Record<string, boolean> = {};
        selected.forEach((row) => {
          newSelectedRows[row.id] = true;
        });
        setSelectedRows(newSelectedRows);
      }}
      bulkActions={bulkActions}
      searchable={true}
      searchPlaceholder={isSecrets ? "Search secrets…" : "Search variables…"}
      searchFilter={searchFilter}
      emptyState={emptyState}
      emptySearchState={emptySearchState}
    />
  );
};
