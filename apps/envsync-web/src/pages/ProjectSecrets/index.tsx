import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { ProjectHeader } from "@/components/ProjectHeader";
import { EnvironmentVariablesTable } from "@/components/env-vars/EnvironmentVariablesTable";
import { VariableHistoryDrawer } from "@/components/env-vars/VariableHistoryDrawer";
import { AddEnvVarModal } from "@/components/env-vars/AddEnvVarModal";
import { EditEnvVarModal } from "@/components/env-vars/EditEnvVarModal";
import { DeleteEnvVarModal } from "@/components/env-vars/DeleteEnvVarModal";
import { BulkImportModal } from "@/components/env-vars/BulkImportModal";
import { ProjectEnvironmentsLoadingPage } from "./loading";
import { ProjectEnvironmentsErrorPage } from "./error";
import { useProjectEnvironments } from "@/hooks/useProjectEnvironments";
import {
  EnvironmentVariable,
  EnvVarFormData,
  BulkEnvVarData,
  SingleItemEnvVarUpdateData,
} from "@/constants";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/auth";
import { useNavigate, useParams } from "react-router-dom";
import { parseAsString, useQueryState } from "nuqs";
import { getDefaultEnvironmentType } from "@/lib/utils";
import { appManageEnvironmentsPath } from "@/lib/app-routes";

export const ProjectEnvironments = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { appId } = useParams();

  const onBack = () => navigate("/");

  const {
    project,
    environmentTypes,
    secrets,
    enableSecrets,
    isLoading,
    error,
    createSecret,
    updateSecret,
    deleteSecret,
    bulkImportSecrets,
    refetch,
  } = useProjectEnvironments(appId);

  const defaultEnvId = getDefaultEnvironmentType(environmentTypes);

  const [selectedEnvironment, setSelectedEnvironment] = useQueryState(
    "selected",
    parseAsString.withDefault("")
  );

  useEffect(() => {
    if (environmentTypes.length > 0 && !environmentTypes.find((e) => e.id === selectedEnvironment)) {
      setSelectedEnvironment(defaultEnvId);
    }
  }, [environmentTypes, selectedEnvironment, setSelectedEnvironment, defaultEnvId]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [selectedVariable, setSelectedVariable] =
    useState<EnvironmentVariable | null>(null);
  const [historyVariable, setHistoryVariable] =
    useState<EnvironmentVariable | null>(null);

  const handleAddVariable = useCallback(
    (data: EnvVarFormData) => {
      createSecret.mutate(data, {
        onSuccess: () => setShowAddModal(false),
      });
    },
    [createSecret]
  );

  const handleEditVariable = (data: SingleItemEnvVarUpdateData) => {
    updateSecret.mutate(data, {
      onSuccess: () => {
        setShowEditModal(false);
        setSelectedVariable(null);
      },
    });
  };

  const handleInlineEdit = useCallback(
    async (data: SingleItemEnvVarUpdateData) => {
      return new Promise<void>((resolve, reject) => {
        updateSecret.mutate(data, {
          onSuccess: () => {
            toast.success("Secret updated");
            resolve();
          },
          onError: (error) => {
            toast.error("Failed to update secret");
            reject(error);
          },
        });
      });
    },
    [updateSecret]
  );

  const handleDeleteVariable = useCallback(
    (env_type_id: string, key: string, appId: string) => {
      deleteSecret.mutate(
        { env_type_id, key, appId },
        {
          onSuccess: () => {
            setShowDeleteModal(false);
            setSelectedVariable(null);
          },
        }
      );
    },
    [deleteSecret]
  );

  const handleBulkImport = useCallback(
    (data: BulkEnvVarData) => {
      bulkImportSecrets.mutate(data, {
        onSuccess: () => setShowBulkImportModal(false),
      });
    },
    [bulkImportSecrets]
  );

  const handleExport = useCallback(() => {
    const filtered = secrets.filter(
      (v) => v.env_type_id === selectedEnvironment
    );
    if (filtered.length === 0) {
      toast.error("No secrets to export for the selected environment");
      return;
    }
    const envTypeName =
      environmentTypes.find((e) => e.id === selectedEnvironment)?.name ?? selectedEnvironment;
    const content = filtered.map((v) => `${v.key}=********`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project!.id}-${envTypeName}.secret.var`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} secrets`);
  }, [secrets, selectedEnvironment, environmentTypes, project]);

  const handleBulkDelete = useCallback(
    async (varsToDelete: EnvironmentVariable[]) => {
      const count = varsToDelete.length;
      const confirmed = window.confirm(
        `Are you sure you want to delete ${count} ${count === 1 ? "secret" : "secrets"}? This action cannot be undone.`
      );
      if (!confirmed) return;

      let successCount = 0;
      let errorCount = 0;

      for (const variable of varsToDelete) {
        try {
          await new Promise<void>((resolve, reject) => {
            deleteSecret.mutate(
              { env_type_id: variable.env_type_id, key: variable.key, appId: appId! },
              { onSuccess: () => resolve(), onError: (error) => reject(error) }
            );
          });
          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Deleted ${successCount} ${successCount === 1 ? "secret" : "secrets"}`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} ${errorCount === 1 ? "secret" : "secrets"}`);
      }
    },
    [deleteSecret, appId]
  );

  const handleBulkExport = useCallback(
    (varsToExport: EnvironmentVariable[]) => {
      if (varsToExport.length === 0) {
        toast.error("No secrets selected for export");
        return;
      }
      const content = varsToExport.map((v) => `${v.key}=********`).join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project!.id}-selected.secret.var`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${varsToExport.length} secrets`);
    },
    [project]
  );

  const handleEditClick = useCallback((variable: EnvironmentVariable) => {
    setSelectedVariable(variable);
    setShowEditModal(true);
  }, []);

  const handleDeleteClick = useCallback((variable: EnvironmentVariable) => {
    setSelectedVariable(variable);
    setShowDeleteModal(true);
  }, []);

  const handleViewHistory = useCallback((variable: EnvironmentVariable) => {
    setHistoryVariable(variable);
    setShowHistoryDrawer(true);
  }, []);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Loading user data ...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <ProjectEnvironmentsLoadingPage />;
  }

  if (error) {
    return (
      <ProjectEnvironmentsErrorPage
        error={error}
        onRetry={handleRetry}
        onBack={onBack}
      />
    );
  }

  if (!project?.name) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            Project not found
          </h3>
          <p className="text-muted-foreground mb-4">
            The requested project could not be found.
          </p>
          <Button
            onClick={onBack}
            variant="outline"
            className="text-foreground border-border hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ProjectHeader
        projectName={project.name}
        environmentTypes={environmentTypes}
        selectedEnvironment={selectedEnvironment}
        onEnvironmentChange={setSelectedEnvironment}
        totalVariables={secrets.length}
        totalSecrets={secrets.length}
        canEdit={user.role.can_edit}
        isRefetching={
          createSecret.isPending ||
          updateSecret.isPending ||
          deleteSecret.isPending ||
          bulkImportSecrets.isPending
        }
        enableSecrets={enableSecrets}
        onRefresh={handleRetry}
        onAddVariable={() => setShowAddModal(true)}
        onBulkImport={() => setShowBulkImportModal(true)}
        onExport={handleExport}
        onManageEnvironments={() => navigate(appManageEnvironmentsPath(appId ?? ""))}
      />

      <div className="mx-auto max-w-[1600px] px-5 md:px-6 py-6">
        <EnvironmentVariablesTable
          selectedEnvironment={selectedEnvironment}
          setSelectedEnvironment={setSelectedEnvironment}
          variables={secrets}
          environmentTypes={environmentTypes}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onViewHistory={handleViewHistory}
          onInlineEdit={handleInlineEdit}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
          canEdit={user.role.can_edit}
          isSecrets={true}
        />
      </div>

      <AddEnvVarModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        environmentTypes={environmentTypes}
        onSave={handleAddVariable}
        isSaving={createSecret.isPending}
        isSecret={true}
        defaultEnvironment={selectedEnvironment}
      />

      <EditEnvVarModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        variable={selectedVariable}
        environmentTypes={environmentTypes}
        onSave={handleEditVariable}
        isSaving={updateSecret.isPending}
      />

      <DeleteEnvVarModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        variable={selectedVariable}
        environmentTypes={environmentTypes}
        onDelete={handleDeleteVariable}
        isDeleting={deleteSecret.isPending}
      />

      <BulkImportModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        environmentTypes={environmentTypes}
        onImport={handleBulkImport}
        isImporting={bulkImportSecrets.isPending}
        isSecret={true}
        defaultEnvironment={selectedEnvironment}
      />

      <VariableHistoryDrawer
        variable={historyVariable}
        kind="secrets"
        isOpen={showHistoryDrawer}
        onOpenChange={setShowHistoryDrawer}
      />
    </div>
  );
};

export default ProjectEnvironments;
