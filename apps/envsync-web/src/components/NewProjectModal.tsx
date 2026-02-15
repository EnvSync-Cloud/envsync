import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X, CheckCircle, ArrowLeft, Palette } from "lucide-react";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EnvType {
  id?: string;
  name: string;
  color: string;
  isCreating?: boolean;
}

const DEFAULT_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
  "#6366f1", // indigo
];

export const NewProjectModal = ({ isOpen, onClose }: NewProjectModalProps) => {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // Step 1 - Project Creation
  const [step, setStep] = useState<1 | 2>(1);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [createdProject, setCreatedProject] = useState<any>(null);
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});

  // Step 2 - Environment Types Creation
  const [envTypes, setEnvTypes] = useState<EnvType[]>([
    { name: "", color: DEFAULT_COLORS[0] }
  ]);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvColor, setNewEnvColor] = useState(DEFAULT_COLORS[1]);

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async (project: { name: string; description: string }) => {
      console.log("Creating project:", project);
      const response = await api.applications.createApp(project);
      console.log("Project created:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Project creation successful:", data);
      toast.success("Project created successfully!");
      setCreatedProject(data);
      setStep(2);
      // Reset env types with default values
      setEnvTypes([{ name: "", color: DEFAULT_COLORS[0] }]);
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create project";
      toast.error(errorMessage);
      setErrors({ general: errorMessage });
    },
  });

  // Create Environment Type Mutation
  const createEnvTypeMutation = useMutation({
    mutationFn: async (envType: { name: string; color: string; app_id: string }) => {
      console.log("Creating env_type:", envType);
      // Adjust this API call based on your actual API structure
      const response = await api.environmentTypes.createEnvType(envType);
      console.log("EnvType created:", response);
      return response;
    },
    onSuccess: (data, variables) => {
      console.log("EnvType creation successful:", data);
      // Update the env type in the list to show it's created
      setEnvTypes(prev => prev.map(env => 
        env.name === variables.name && env.color === variables.color 
          ? { ...env, id: data.id, isCreating: false }
          : env
      ));
      toast.success(`Environment "${variables.name}" created successfully!`);
    },
    onError: (error: any, variables) => {
      console.error("Error creating env_type:", error);
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create environment type";
      toast.error(`Failed to create "${variables.name}": ${errorMessage}`);
      // Reset the creating state
      setEnvTypes(prev => prev.map(env => 
        env.name === variables.name && env.color === variables.color 
          ? { ...env, isCreating: false }
          : env
      ));
    },
  });

  const validateProjectForm = () => {
    const newErrors: { name?: string } = {};
    
    if (!projectName.trim()) {
      newErrors.name = "Project name is required";
    } else if (projectName.trim().length < 2) {
      newErrors.name = "Project name must be at least 2 characters";
    } else if (projectName.trim().length > 50) {
      newErrors.name = "Project name must be less than 50 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateProjectForm()) {
      return;
    }

    if (createProjectMutation.isPending) {
      return;
    }

    setErrors({});
    createProjectMutation.mutate({
      name: projectName.trim(),
      description: projectDescription.trim(),
    });
  };

  const handleAddEnvType = () => {
    if (!newEnvName.trim()) {
      toast.error("Environment name is required");
      return;
    }

    // Check for duplicate names
    if (envTypes.some(env => env.name.toLowerCase() === newEnvName.trim().toLowerCase())) {
      toast.error("Environment name already exists");
      return;
    }

    const newEnvType: EnvType = {
      name: newEnvName.trim(),
      color: newEnvColor,
    };

    setEnvTypes(prev => [...prev, newEnvType]);
    setNewEnvName("");
    setNewEnvColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
  };

  const handleRemoveEnvType = (index: number) => {
    setEnvTypes(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateEnvType = (envType: EnvType, index: number) => {
    if (!createdProject?.id) return;

    // Set creating state
    setEnvTypes(prev => prev.map((env, i) => 
      i === index ? { ...env, isCreating: true } : env
    ));

    createEnvTypeMutation.mutate({
      name: envType.name,
      color: envType.color,
      app_id: createdProject.id,
    });
  };

  const handleFinish = () => {
    queryClient.invalidateQueries({
      queryKey: ["applications"],
    });
    handleClose();
  };

  const handleClose = () => {
    if (createProjectMutation.isPending || createEnvTypeMutation.isPending) {
      return;
    }
    
    // Reset all state
    setStep(1);
    setProjectName("");
    setProjectDescription("");
    setCreatedProject(null);
    setErrors({});
    setEnvTypes([{ name: "", color: DEFAULT_COLORS[0] }]);
    setNewEnvName("");
    setNewEnvColor(DEFAULT_COLORS[1]);
    onClose();
  };

  const handleBackToStep1 = () => {
    if (createEnvTypeMutation.isPending) return;
    setStep(1);
  };

  const createdEnvTypesCount = envTypes.filter(env => env.id).length;
  const canFinish = createdEnvTypesCount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={createProjectMutation.isPending ? undefined : handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white rounded-xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            {step === 2 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToStep1}
                disabled={createEnvTypeMutation.isPending}
                className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <DialogTitle className="text-xl font-semibold">
              {step === 1 ? "Create New Project" : "Setup Environment Types"}
            </DialogTitle>
          </div>
          {step === 2 && (
            <p className="text-sm text-slate-400 mt-2">
              Create environment types for "{createdProject?.name}". You can add multiple environments like Development, Staging, Production, etc.
            </p>
          )}
        </DialogHeader>
        
        {step === 1 ? (
          // Step 1: Project Creation Form
          <form onSubmit={handleProjectSubmit} className="space-y-4">
            {errors.general && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project-name" className="text-sm font-medium">
                Project Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (errors.name) {
                    setErrors(prev => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="Enter project name"
                className={`bg-slate-900 border-slate-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl ${
                  errors.name ? 'border-red-500 focus:border-red-500' : ''
                }`}
                disabled={createProjectMutation.isPending}
                maxLength={50}
                required
              />
              {errors.name && (
                <p className="text-red-400 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description" className="text-sm font-medium">
                Description (optional)
              </Label>
              <Textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe your project"
                className="bg-slate-900 border-slate-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl resize-none"
                rows={3}
                disabled={createProjectMutation.isPending}
                maxLength={500}
              />
              <p className="text-xs text-slate-400">
                {projectDescription.length}/500 characters
              </p>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createProjectMutation.isPending}
                className="border-slate-600 text-white hover:bg-slate-700 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProjectMutation.isPending || !projectName.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // Step 2: Environment Types Creation
          <div className="space-y-6">
            {/* Add New Environment Type */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-medium text-white mb-3">Add Environment Type</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="env-name" className="text-sm text-slate-300">
                    Environment Name
                  </Label>
                  <Input
                    id="env-name"
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value)}
                    placeholder="e.g., Development, Staging, Production"
                    className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 rounded-lg mt-1"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEnvType();
                      }
                    }}
                  />
                </div>
                
                <div>
                  <Label className="text-sm text-slate-300">Color</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div 
                      className="w-8 h-8 rounded-lg border-2 border-slate-600 flex items-center justify-center"
                      style={{ backgroundColor: newEnvColor }}
                    >
                      <Palette className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {DEFAULT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewEnvColor(color)}
                          className={`w-6 h-6 rounded-md border-2 transition-all ${
                            newEnvColor === color 
                              ? 'border-white scale-110' 
                              : 'border-slate-600 hover:border-slate-400'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddEnvType}
                  disabled={!newEnvName.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Environment
                </Button>
              </div>
            </div>

            {/* Environment Types List */}
            {envTypes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white">Environment Types</h3>
                <div className="space-y-2">
                  {envTypes.map((envType, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-6 h-6 rounded-md border border-slate-600"
                          style={{ backgroundColor: envType.color }}
                        />
                        <span className="text-white font-medium">{envType.name}</span>
                        {envType.id && (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {!envType.id && !envType.isCreating && (
                          <Button
                            size="sm"
                            onClick={() => handleCreateEnvType(envType, index)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                          >
                            Create
                          </Button>
                        )}
                        
                        {envType.isCreating && (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                            <span className="text-sm text-slate-400">Creating...</span>
                          </div>
                        )}
                        
                        {!envType.isCreating && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveEnvType(index)}
                            className="text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Summary */}
            {envTypes.length > 0 && (
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-white">
                    {createdEnvTypesCount} of {envTypes.length} environments created
                  </span>
                </div>
                <div className="mt-2 bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${envTypes.length > 0 ? (createdEnvTypesCount / envTypes.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={createEnvTypeMutation.isPending}
                className="border-slate-600 text-white hover:bg-slate-700 rounded-xl"
              >
                Cancel
              </Button>
              
              {canFinish ? (
                <Button
                  onClick={handleFinish}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Finish Setup
                </Button>
              ) : (
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 rounded-xl"
                >
                  Skip for Now
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
