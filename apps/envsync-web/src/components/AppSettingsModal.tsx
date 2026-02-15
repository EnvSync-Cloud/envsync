import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Loader2, 
  Plus, 
  X, 
  Save, 
  Trash2, 
  Edit3, 
  Palette,
  Settings,
  Database,
  Tag,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: {
    id: string;
    name: string;
    description: string;
    metadata: Record<string, any>;
  };
}

interface EnvType {
  id: string;
  name: string;
  color: string;
  app_id: string;
  created_at?: string;
  updated_at?: string;
}

interface MetadataEntry {
  key: string;
  value: string;
  isEditing?: boolean;
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

export const AppSettingsModal = ({ isOpen, onClose, app }: AppSettingsModalProps) => {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // App Details State
  const [appName, setAppName] = useState(app.name);
  const [appDescription, setAppDescription] = useState(app.description);
  const [appErrors, setAppErrors] = useState<{ name?: string }>({});

  // Environment Types State
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvColor, setNewEnvColor] = useState(DEFAULT_COLORS[0]);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [editingEnvName, setEditingEnvName] = useState("");
  const [editingEnvColor, setEditingEnvColor] = useState("");

  // Metadata State
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);
  const [newMetadataKey, setNewMetadataKey] = useState("");
  const [newMetadataValue, setNewMetadataValue] = useState("");

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'envType' | 'metadata';
    id: string;
    name: string;
  } | null>(null);

  // Initialize metadata entries
  useEffect(() => {
    if (app.metadata) {
      const entries = Object.entries(app.metadata).map(([key, value]) => ({
        key,
        value: String(value),
        isEditing: false,
      }));
      setMetadataEntries(entries);
    }
  }, [app.metadata]);

  // Fetch Environment Types
  const { 
    data: envTypes = [], 
    isLoading: envTypesLoading,
    refetch: refetchEnvTypes 
  } = useQuery({
    queryKey: ["envTypes", app.id],
    queryFn: async () => {
        const response = await api.environmentTypes.getEnvTypes();
        // Filter by app ID
        return response.filter((env: EnvType) => env.app_id === app.id);
    },
    enabled: isOpen,
  });

  // Update App Mutation
  const updateAppMutation = useMutation({
    mutationFn: async (updates: { name: string; description: string }) => {
      return await api.applications.updateApp(app.id, updates);
    },
    onSuccess: () => {
      toast.success("App details updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to update app";
      toast.error(errorMessage);
      setAppErrors({ name: errorMessage });
    },
  });

  // Create Environment Type Mutation
  const createEnvTypeMutation = useMutation({
    mutationFn: async (envType: { name: string; color: string; app_id: string }) => {
      return await api.environmentTypes.createEnvType(envType);
    },
    onSuccess: () => {
      toast.success("Environment type created successfully!");
      setNewEnvName("");
      setNewEnvColor(DEFAULT_COLORS[0]);
      refetchEnvTypes();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to create environment type";
      toast.error(errorMessage);
    },
  });

  // Update Environment Type Mutation
  const updateEnvTypeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name: string; color: string } }) => {
      return await api.environmentTypes.updateEnvType(id, {
        id,
        ...updates,
      });
    },
    onSuccess: () => {
      toast.success("Environment type updated successfully!");
      setEditingEnvId(null);
      setEditingEnvName("");
      setEditingEnvColor("");
      refetchEnvTypes();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to update environment type";
      toast.error(errorMessage);
    },
  });

  // Delete Environment Type Mutation
  const deleteEnvTypeMutation = useMutation({
    mutationFn: async (envTypeId: string) => {
      return await api.environmentTypes.deleteEnvType(envTypeId);
    },
    onSuccess: () => {
      toast.success("Environment type deleted successfully!");
      setDeleteConfirmation(null);
      refetchEnvTypes();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to delete environment type";
      toast.error(errorMessage);
    },
  });

  // Update App Metadata Mutation
  const updateMetadataMutation = useMutation({
    mutationFn: async (metadata: Record<string, any>) => {
      return await api.applications.updateApp(app.id, { metadata });
    },
    onSuccess: () => {
      toast.success("Metadata updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || "Failed to update metadata";
      toast.error(errorMessage);
    },
  });

  // Handlers
  const handleUpdateApp = () => {
    if (!appName.trim()) {
      setAppErrors({ name: "App name is required" });
      return;
    }

    if (appName.trim().length < 2) {
      setAppErrors({ name: "App name must be at least 2 characters" });
      return;
    }

    setAppErrors({});
    updateAppMutation.mutate({
      name: appName.trim(),
      description: appDescription.trim(),
    });
  };

  const handleCreateEnvType = () => {
    if (!newEnvName.trim()) {
      toast.error("Environment name is required");
      return;
    }

    // Check for duplicate names
    if (envTypes.some(env => env.name.toLowerCase() === newEnvName.trim().toLowerCase())) {
      toast.error("Environment name already exists");
      return;
    }

    createEnvTypeMutation.mutate({
      name: newEnvName.trim(),
      color: newEnvColor,
      app_id: app.id,
    });
  };

  const handleStartEditEnvType = (envType: EnvType) => {
    setEditingEnvId(envType.id);
    setEditingEnvName(envType.name);
    setEditingEnvColor(envType.color);
  };

  const handleUpdateEnvType = () => {
    if (!editingEnvName.trim()) {
      toast.error("Environment name is required");
      return;
    }

    // Check for duplicate names (excluding current)
    if (envTypes.some(env => 
      env.id !== editingEnvId && 
      env.name.toLowerCase() === editingEnvName.trim().toLowerCase()
    )) {
      toast.error("Environment name already exists");
      return;
    }

    updateEnvTypeMutation.mutate({
      id: editingEnvId!,
      updates: {
        name: editingEnvName.trim(),
        color: editingEnvColor,
      },
    });
  };

  const handleCancelEditEnvType = () => {
    setEditingEnvId(null);
    setEditingEnvName("");
    setEditingEnvColor("");
  };

  const handleDeleteEnvType = (envType: EnvType) => {
    setDeleteConfirmation({
      type: 'envType',
      id: envType.id,
      name: envType.name,
    });
  };

  const handleAddMetadata = () => {
    if (!newMetadataKey.trim() || !newMetadataValue.trim()) {
      toast.error("Both key and value are required");
      return;
    }

    // Check for duplicate keys
    if (metadataEntries.some(entry => entry.key === newMetadataKey.trim())) {
      toast.error("Metadata key already exists");
      return;
    }

    const newEntry: MetadataEntry = {
      key: newMetadataKey.trim(),
      value: newMetadataValue.trim(),
      isEditing: false,
    };

    setMetadataEntries(prev => [...prev, newEntry]);
    setNewMetadataKey("");
    setNewMetadataValue("");
  };

  const handleEditMetadata = (index: number) => {
    setMetadataEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, isEditing: true } : entry
    ));
  };

  const handleSaveMetadata = (index: number) => {
    setMetadataEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, isEditing: false } : entry
    ));
  };

  const handleDeleteMetadata = (index: number) => {
    const entry = metadataEntries[index];
    setDeleteConfirmation({
      type: 'metadata',
      id: index.toString(),
      name: entry.key,
    });
  };

  const handleUpdateMetadataEntry = (index: number, field: 'key' | 'value', value: string) => {
    setMetadataEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSaveAllMetadata = () => {
    const metadata: Record<string, any> = {};
    metadataEntries.forEach(entry => {
      if (entry.key.trim()) {
        metadata[entry.key.trim()] = entry.value.trim();
      }
    });

    updateMetadataMutation.mutate(metadata);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === 'envType') {
      deleteEnvTypeMutation.mutate(deleteConfirmation.id);
    } else if (deleteConfirmation.type === 'metadata') {
      const index = parseInt(deleteConfirmation.id);
      setMetadataEntries(prev => prev.filter((_, i) => i !== index));
      setDeleteConfirmation(null);
      toast.success("Metadata entry removed");
    }
  };

  const handleClose = () => {
    if (updateAppMutation.isPending || 
        createEnvTypeMutation.isPending || 
        updateEnvTypeMutation.isPending || 
        deleteEnvTypeMutation.isPending ||
        updateMetadataMutation.isPending) {
      return;
    }

    // Reset state
    setAppName(app.name);
    setAppDescription(app.description);
    setAppErrors({});
    setNewEnvName("");
    setNewEnvColor(DEFAULT_COLORS[0]);
    setEditingEnvId(null);
    setEditingEnvName("");
    setEditingEnvColor("");
    setDeleteConfirmation(null);
    
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>App Settings - {app.name}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 bg-slate-900">
              <TabsTrigger value="details" className="data-[state=active]:bg-slate-700">
                <Database className="w-4 h-4 mr-2" />
                App Details
              </TabsTrigger>
              <TabsTrigger value="environments" className="data-[state=active]:bg-slate-700">
                <Palette className="w-4 h-4 mr-2" />
                Environment Types
              </TabsTrigger>
              <TabsTrigger value="metadata" className="data-[state=active]:bg-slate-700">
                <Tag className="w-4 h-4 mr-2" />
                Metadata
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 overflow-y-auto max-h-[60vh]">
              {/* App Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app-name" className="text-sm font-medium">
                      App Name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="app-name"
                      value={appName}
                      onChange={(e) => {
                        setAppName(e.target.value);
                        if (appErrors.name) {
                          setAppErrors(prev => ({ ...prev, name: undefined }));
                        }
                      }}
                      placeholder="Enter app name"
                      className={`bg-slate-900 border-slate-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl ${
                        appErrors.name ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                      disabled={updateAppMutation.isPending}
                      maxLength={50}
                    />
                    {appErrors.name && (
                      <p className="text-red-400 text-sm mt-1">{appErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="app-description" className="text-sm font-medium">
                      Description
                    </Label>
                    <Textarea
                      id="app-description"
                      value={appDescription}
                      onChange={(e) => setAppDescription(e.target.value)}
                      placeholder="Describe your app"
                      className="bg-slate-900 border-slate-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl resize-none"
                      rows={3}
                      disabled={updateAppMutation.isPending}
                      maxLength={500}
                    />
                    <p className="text-xs text-slate-400">
                      {appDescription.length}/500 characters
                    </p>
                  </div>

                  <Button
                    onClick={handleUpdateApp}
                    disabled={updateAppMutation.isPending || !appName.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
                  >
                    {updateAppMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Update App Details
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Environment Types Tab */}
              <TabsContent value="environments" className="space-y-4">
                {/* Add New Environment Type */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-sm font-medium text-white mb-3">Add New Environment Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-env-name" className="text-sm text-slate-300">
                        Environment Name
                      </Label>
                      <Input
                        id="new-env-name"
                        value={newEnvName}
                        onChange={(e) => setNewEnvName(e.target.value)}
                        placeholder="e.g., Development, Staging, Production"
                        className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 rounded-lg"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateEnvType();
                          }
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Color</Label>
                      <div className="flex items-center space-x-2">
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
                  </div>

                  <Button
                    onClick={handleCreateEnvType}
                    disabled={!newEnvName.trim() || createEnvTypeMutation.isPending}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg mt-4"
                  >
                    {createEnvTypeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Environment Type
                      </>
                    )}
                  </Button>
                </div>

                {/* Existing Environment Types */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white">Existing Environment Types</h3>
                  {envTypesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                    </div>
                  ) : envTypes.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Palette className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                      <p>No environment types found</p>
                      <p className="text-sm">Add your first environment type above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {envTypes.map((envType) => (
                        <div
                          key={envType.id}
                          className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700"
                        >
                          {editingEnvId === envType.id ? (
                            // Edit Mode
                            <div className="flex items-center space-x-3 flex-1">
                              <div
                                className="w-6 h-6 rounded-md border border-slate-600"
                                style={{ backgroundColor: editingEnvColor }}
                              />
                              <Input
                                value={editingEnvName}
                                onChange={(e) => setEditingEnvName(e.target.value)}
                                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 rounded-lg flex-1"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleUpdateEnvType();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEditEnvType();
                                  }
                                }}
                              />
                              <div className="flex gap-1">
                                {DEFAULT_COLORS.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setEditingEnvColor(color)}
                                    className={`w-5 h-5 rounded-md border transition-all ${
                                      editingEnvColor === color 
                                        ? 'border-white scale-110' 
                                        : 'border-slate-600 hover:border-slate-400'
                                    }`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <div className="flex items-center space-x-3">
                              <div
                                className="w-6 h-6 rounded-md border border-slate-600"
                                style={{ backgroundColor: envType.color }}
                              />
                              <span className="text-white font-medium">{envType.name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2">
                            {editingEnvId === envType.id ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={handleUpdateEnvType}
                                  disabled={updateEnvTypeMutation.isPending}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                                >
                                  {updateEnvTypeMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEditEnvType}
                                  className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEditEnvType(envType)}
                                  className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteEnvType(envType)}
                                  className="text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="space-y-4">
                {/* Add New Metadata */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-sm font-medium text-white mb-3">Add New Metadata</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-meta-key" className="text-sm text-slate-300">
                        Key
                      </Label>
                      <Input
                        id="new-meta-key"
                        value={newMetadataKey}
                        onChange={(e) => setNewMetadataKey(e.target.value)}
                        placeholder="e.g., version, environment, team"
                        className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 rounded-lg"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-meta-value" className="text-sm text-slate-300">
                        Value
                      </Label>
                      <Input
                        id="new-meta-value"
                        value={newMetadataValue}
                        onChange={(e) => setNewMetadataValue(e.target.value)}
                        placeholder="Enter value"
                        className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 rounded-lg"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMetadata();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleAddMetadata}
                    disabled={!newMetadataKey.trim() || !newMetadataValue.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Metadata
                  </Button>
                </div>

                {/* Existing Metadata */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">Existing Metadata</h3>
                    {metadataEntries.length > 0 && (
                      <Button
                        onClick={handleSaveAllMetadata}
                        disabled={updateMetadataMutation.isPending}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                        size="sm"
                      >
                        {updateMetadataMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save All Changes
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {metadataEntries.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Tag className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                      <p>No metadata found</p>
                      <p className="text-sm">Add your first metadata entry above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {metadataEntries.map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-3 bg-slate-900 rounded-lg border border-slate-700"
                        >
                          {entry.isEditing ? (
                            <>
                              <Input
                                value={entry.key}
                                onChange={(e) => handleUpdateMetadataEntry(index, 'key', e.target.value)}
                                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500
                                rounded-lg flex-1"
                                placeholder="Key"
                              />
                              <Input
                                value={entry.value}
                                onChange={(e) => handleUpdateMetadataEntry(index, 'value', e.target.value)}
                                className="bg-slate-800 border-slate-600 text-white focus:border-emerald-500 rounded-lg flex-1"
                                placeholder="Value"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveMetadata(index)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveMetadata(index)}
                                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-xs text-slate-400 block">Key</span>
                                  <span className="text-white font-medium">{entry.key}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-slate-400 block">Value</span>
                                  <span className="text-white">{entry.value}</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditMetadata(index)}
                                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteMetadata(index)}
                                className="text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Confirm Deletion</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete {deleteConfirmation?.type === 'envType' ? 'environment type' : 'metadata entry'} "{deleteConfirmation?.name}"? 
              {deleteConfirmation?.type === 'envType' && (
                <span className="block mt-2 text-red-400">
                  Warning: This may affect existing environments using this type.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600"
              disabled={deleteEnvTypeMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteEnvTypeMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteEnvTypeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
