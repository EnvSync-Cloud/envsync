import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  App,
  FilterOptions,
  Statistics,
  DEFAULT_FILTER_OPTIONS,
  DEBOUNCE_DELAY,
} from "@/constants";
import { api as Api } from "@/api";

export const useApplications = () => {
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(
    DEFAULT_FILTER_OPTIONS
  );

  // Modal states
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch applications data
  const {
    data: apps = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = Api.applications.allApplications();
  // useQuery({
  //   queryKey: [API_KEYS.ALL_APPLICATIONS],
  //   queryFn: async () => {
  //     const appsData = await api.applications.getApps();
  //     console.log(appsData);

  //     // Transform the data to match our App interface
  //     return appsData.map(
  //       (app): App => ({
  //         id: app.id,
  //         org_id: app.org_id,
  //         name: app.name,
  //         description: app.description || "",
  //         metadata: app.metadata || {},
  //         status: "active", // Default status since it's not in the API response
  //         created_at: new Date(app.created_at),
  //         updated_at: new Date(app.updated_at),
  //         env_count: 0, // This would need to be fetched separately or included in API
  //         secret_count: 0, // This would need to be fetched separately or included in API
  //       })
  //     );
  //   },
  //   staleTime: 5 * 60 * 1000, // 5 minutes
  //   retry: 3,
  // });

  // Update application mutation
  const updateAppMutation = useMutation({
    mutationFn: async ({
      appId,
      data,
    }: {
      appId: string;
      data: Partial<App>;
    }) => {
      return await api.applications.updateApp(appId, {
        name: data.name,
        description: data.description,
        // Note: status update might need a different API endpoint
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Project updated successfully");
      setIsEditModalOpen(false);
      setSelectedApp(null);
    },
    onError: (error) => {
      console.error("Failed to update project:", error);
      toast.error("Failed to update project");
    },
  });

  // Delete application mutation
  const deleteAppMutation = useMutation({
    mutationFn: async (appId: string) => {
      return await api.applications.deleteApp(appId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Project deleted successfully");
      setIsDeleteModalOpen(false);
      setSelectedApp(null);
      setDeleteConfirmText("");
    },
    onError: (error) => {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    },
  });

  // Filter and sort applications
  const filteredAndSortedApps = useMemo(() => {
    let filtered = [...apps];

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(query) ||
          app.description.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterOptions.status !== "all") {
      filtered = filtered.filter((app) => app.status === filterOptions.status);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;

      switch (filterOptions.sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "created_at":
          aValue = a.created_at.getTime();
          bValue = b.created_at.getTime();
          break;
        case "updated_at":
          aValue = a.updated_at.getTime();
          bValue = b.updated_at.getTime();
          break;
        default:
          return 0;
      }

      if (filterOptions.sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [apps, debouncedSearchQuery, filterOptions]);

  // Calculate statistics
  const statistics = useMemo((): Statistics => {
    const total = apps.length;
    const active = apps.filter((app) => app.status === "active").length;
    const inactive = total - active;
    const filtered = filteredAndSortedApps.length;

    return { total, active, inactive, filtered };
  }, [apps, filteredAndSortedApps]);

  // Check if user can edit
  const canEdit = useMemo(() => {
    if (!user?.role) return false;
    return user.role.is_admin || user.role.is_master;
  }, [user]);

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      debouncedSearchQuery !== "" ||
      filterOptions.status !== "all" ||
      filterOptions.sortBy !== "updated_at" ||
      filterOptions.sortOrder !== "desc"
    );
  }, [debouncedSearchQuery, filterOptions]);

  // Event handlers
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof FilterOptions, value: string) => {
      setFilterOptions((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSortOrderToggle = useCallback(() => {
    setFilterOptions((prev) => ({
      ...prev,
      sortOrder: prev.sortOrder === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterOptions(DEFAULT_FILTER_OPTIONS);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleCreateProject = useCallback(() => {
    navigate("/applications/create");
  }, [navigate]);

  // Modal handlers
  const handleViewProject = useCallback((app: App) => {
    setSelectedApp(app);
    setIsViewModalOpen(true);
  }, []);

  const handleEditProject = useCallback((app: App) => {
    setSelectedApp(app);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteProject = useCallback((app: App) => {
    setSelectedApp(app);
    setDeleteConfirmText("");
    setIsDeleteModalOpen(true);
  }, []);

  const handleSaveProject = useCallback(
    (appId: string, data: Partial<App>) => {
      updateAppMutation.mutate({ appId, data });
    },
    [updateAppMutation]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!selectedApp || deleteConfirmText !== selectedApp.name) return;
    deleteAppMutation.mutate(selectedApp.id);
  }, [selectedApp, deleteConfirmText, deleteAppMutation]);

  const handleCloseModals = useCallback(() => {
    setIsViewModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setSelectedApp(null);
    setDeleteConfirmText("");
  }, []);

  return {
    // Data
    apps: filteredAndSortedApps,
    statistics,
    isLoading,
    error,
    isRefetching,
    canEdit,

    // Search and filters
    searchQuery,
    debouncedSearchQuery,
    filterOptions,
    hasActiveFilters,

    // Modal states
    selectedApp,
    isViewModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    deleteConfirmText,

    // Loading states
    isSaving: updateAppMutation.isPending,
    isDeleting: deleteAppMutation.isPending,

    // Event handlers
    handleSearchChange,
    handleClearSearch,
    handleFilterChange,
    handleSortOrderToggle,
    handleResetFilters,
    handleRefresh,
    handleCreateProject,
    handleViewProject,
    handleEditProject,
    handleDeleteProject,
    handleSaveProject,
    handleConfirmDelete,
    handleCloseModals,
    setDeleteConfirmText,
  };
};
