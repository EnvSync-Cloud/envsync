import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { ProjectEnvironmentsHeader } from "@/components/env-vars/ProjectEnvironmentsHeader";
import { EnvironmentVariablesTable } from "@/components/env-vars/EnvironmentVariablesTable";
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
} from "@/constants";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { parseAsString, useQueryState } from "nuqs";
import { getDefaultEnvironmentType } from "@/lib/utils";

export const ProjectEnvironments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectNameId } = useParams();

  const onBack = () => navigate("/");

  const {
    // Data
    project,
    environmentTypes,
    environmentVariables,
    secrets,
    enableSecrets,
    isLoading,
    error,

    // Mutations
    createVariable,
    updateVariable,
    deleteVariable,
    bulkImportVariables,
    createSecret,
    updateSecret,
    deleteSecret,
    bulkImportSecrets,

    // Utility functions
    refetch,
  } = useProjectEnvironments(projectNameId);

  const [selectedEnvironment, setSelectedEnvironment] = useQueryState(
    "selected",
    parseAsString.withDefault(getDefaultEnvironmentType(environmentTypes))
  );

  useEffect(() => {
    if (!selectedEnvironment && environmentTypes.length > 0) {
      setSelectedEnvironment(getDefaultEnvironmentType(environmentTypes));
    }
  }, [environmentTypes]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedVariable, setSelectedVariable] =
    useState<EnvironmentVariable | null>(null);

  // Event handlers
  const handleAddVariable = useCallback(
    (data: EnvVarFormData) => {
      createVariable.mutate(data, {
        onSuccess: () => {
          setShowAddModal(false);
        },
      });
    },
    [createVariable]
  );

  const handleEditVariable = (data: Partial<EnvVarFormData>, originalKey: string) => {
    updateVariable.mutate(
      { data, originalKey },
      {
        onSuccess: () => {
          setShowEditModal(false);
          setSelectedVariable(null);
        },
      }
    );
  };

  const handleDeleteVariable = useCallback(
    (env_type_id: string, key: string, projectNameId: string) => {
      deleteVariable.mutate(
        {
          env_type_id,
          key,
          projectNameId,
        },
        {
          onSuccess: () => {
            setShowDeleteModal(false);
            setSelectedVariable(null);
          },
        }
      );
    },
    [deleteVariable]
  );

  const handleBulkImport = useCallback(
    (data: BulkEnvVarData) => {
      bulkImportVariables.mutate(data, {
        onSuccess: () => {
          setShowBulkImportModal(false);
        },
      });
    },
    [bulkImportVariables]
  );

  const handleExport = useCallback(() => {
    const filtered = environmentVariables.filter(
      (v) => v.env_type_id === selectedEnvironment
    );
    if (filtered.length === 0) {
      toast.error("No variables to export for the selected environment");
      return;
    }
    const envTypeName =
      environmentTypes.find((e) => e.id === selectedEnvironment)?.name ?? selectedEnvironment;
    const content = filtered.map((v) => `${v.key}=${v.value}`).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project!.id}-${envTypeName}.env.var`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} variables`);
  }, [environmentVariables, selectedEnvironment, environmentTypes, project]);

  const handleEditClick = useCallback((variable: EnvironmentVariable) => {
    setSelectedVariable(variable);
    setShowEditModal(true);
  }, []);

  const handleDeleteClick = useCallback((variable: EnvironmentVariable) => {
    setSelectedVariable(variable);
    setShowDeleteModal(true);
  }, []);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Loading user data ...</p>
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
          <h3 className="text-lg font-semibold text-white mb-2">
            Project not found
          </h3>
          <p className="text-gray-400 mb-4">
            The requested project could not be found.
          </p>
          <Button
            onClick={onBack}
            variant="outline"
            className="text-white border-gray-700 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (environmentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center text-center max-w-md">
          <Settings className="w-12 h-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Environment Types
          </h3>
          <p className="text-gray-400 mb-6">
            Create at least one environment type (e.g. Development, Staging,
            Production) before adding variables.
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() =>
                navigate(`/applications/${projectNameId}/manage-environments`)
              }
              className="bg-violet-500 hover:bg-violet-600 text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Create Environment Type
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <ProjectEnvironmentsHeader
        environmentTypes={environmentTypes.length}
        environmentId={selectedEnvironment}
        environmentName={environmentTypes.find((e) => e.id === selectedEnvironment)?.name}
        isRefetching={
          createVariable.isPending ||
          updateVariable.isPending ||
          deleteVariable.isPending ||
          bulkImportVariables.isPending
        }
        projectName={project.name}
        totalSecrets={secrets.length}
        totalVariables={environmentVariables.length}
        enableSecrets={enableSecrets}
        onBack={onBack}
        onAddVariable={() => setShowAddModal(true)}
        onBulkImport={() => setShowBulkImportModal(true)}
        canEdit={user.role.can_edit}
        onExport={handleExport}
        onRefresh={handleRetry}
        onManageEnvironments={() => {
          navigate(`/applications/${projectNameId}/manage-environments`);
        }}
      />

      {/* Environment Variables Table */}
      <EnvironmentVariablesTable
        selectedEnvironment={selectedEnvironment}
        setSelectedEnvironment={setSelectedEnvironment}
        variables={environmentVariables}
        environmentTypes={environmentTypes}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        canEdit={user.role.can_edit}
      />

      {/* Add Variable Modal */}
      <AddEnvVarModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        environmentTypes={environmentTypes}
        onSave={handleAddVariable}
        isSaving={createVariable.isPending}
      />

      {/* Edit Variable Modal */}
      <EditEnvVarModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        variable={selectedVariable}
        environmentTypes={environmentTypes}
        onSave={handleEditVariable}
        isSaving={updateVariable.isPending}
      />

      {/* Delete Variable Modal */}
      <DeleteEnvVarModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        variable={selectedVariable}
        environmentTypes={environmentTypes}
        onDelete={handleDeleteVariable}
        isDeleting={deleteVariable.isPending}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        environmentTypes={environmentTypes}
        onImport={handleBulkImport}
        isImporting={bulkImportVariables.isPending}
      />
    </div>
  );
};

export default ProjectEnvironments;
