import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
  EnvironmentType,
} from "@/constants";
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
    secrets,
    isLoading,
    error,

    // Mutations
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
      createSecret.mutate(data, {
        onSuccess: () => {
          setShowAddModal(false);
        },
      });
    },
    [createSecret]
  );

  const handleEditVariable = (data: Partial<EnvVarFormData>) => {
    console.log(data);
    updateSecret.mutate(
      { data },
      {
        onSuccess: () => {
          setShowEditModal(false);
          setSelectedVariable(null);
        },
      }
    );
  };

  const handledeleteSecret = useCallback(
    (env_type_id: string, key: string, projectNameId: string) => {
      deleteSecret.mutate(
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
    [deleteSecret]
  );

  const handleBulkImport = useCallback(
    (data: BulkEnvVarData) => {
      bulkImportSecrets.mutate(data, {
        onSuccess: () => {
          setShowBulkImportModal(false);
        },
      });
    },
    [bulkImportSecrets]
  );

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
          <p className="text-slate-400 mb-4">Loading user data ...</p>
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
          <p className="text-slate-400 mb-4">
            The requested project could not be found.
          </p>
          <Button
            onClick={onBack}
            variant="outline"
            className="text-white border-slate-600 hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
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
        isRefetching={
          createSecret.isPending ||
          updateSecret.isPending ||
          deleteSecret.isPending ||
          bulkImportSecrets.isPending
        }
        projectName={project.name}
        totalSecrets={secrets.length}
        totalVariables={secrets.length}
        onBack={onBack}
        onAddVariable={() => setShowAddModal(true)}
        onBulkImport={() => setShowBulkImportModal(true)}
        canEdit={user.role.can_edit}
        onExport={() => console.log("Export functionality not implemented yet")}
        onRefresh={handleRetry}
        onManageEnvironments={() => {
          navigate(`/applications/${projectNameId}/manage-environments`);
        }}
      />

      {/* Environment Variables Table */}
      <EnvironmentVariablesTable
        selectedEnvironment={selectedEnvironment}
        setSelectedEnvironment={setSelectedEnvironment}
        variables={secrets}
        environmentTypes={environmentTypes}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        canEdit={user.role.can_edit}
        isSecrets={true}
      />

      {/* Add Variable Modal */}
      <AddEnvVarModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        environmentTypes={environmentTypes}
        onSave={handleAddVariable}
        isSaving={createSecret.isPending}
        isSecret={true}
      />

      {/* Edit Variable Modal */}
      <EditEnvVarModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        variable={selectedVariable}
        environmentTypes={environmentTypes}
        onSave={handleEditVariable}
        isSaving={updateSecret.isPending}
      />

      {/* Delete Variable Modal */}
      <DeleteEnvVarModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        variable={selectedVariable}
        environmentTypes={environmentTypes}
        onDelete={handledeleteSecret}
        isDeleting={deleteSecret.isPending}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
        environmentTypes={environmentTypes}
        onImport={handleBulkImport}
        isImporting={bulkImportSecrets.isPending}
        isSecret={true}
      />
    </div>
  );
};

export default ProjectEnvironments;
