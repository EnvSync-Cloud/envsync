import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
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
} from "lucide-react";
import { EnvironmentVariable, EnvironmentType } from "@/constants";
import { useCopy } from "@/hooks/useClipboard";
import { getDefaultEnvironmentType } from "@/lib/utils";
import { Count } from "../ui/count";

interface EnvironmentVariablesTableProps {
  variables: EnvironmentVariable[];
  environmentTypes: EnvironmentType[];
  selectedEnvironment: string;
  setSelectedEnvironment: (envTypeId: string) => void;
  canEdit: boolean;
  onEdit: (variable: EnvironmentVariable) => void;
  onDelete: (variable: EnvironmentVariable) => void;
  isSecrets?: boolean; // Optional prop to indicate if these are secrets
}

export const EnvironmentVariablesTable = ({
  variables,
  environmentTypes,
  selectedEnvironment,
  setSelectedEnvironment,
  canEdit,
  onEdit,
  onDelete,
  isSecrets,
}: EnvironmentVariablesTableProps) => {
  const copy = useCopy();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>(
    {}
  );

  // Create environment types map
  const environmentTypesMap = useMemo(() => {
    return new Map(environmentTypes.map((env) => [env.id, env]));
  }, [environmentTypes]);

  // Filter variables
  const filteredVariables = useMemo(() => {
    let filtered = variables;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (variable) =>
          variable.key.toLowerCase().includes(query) ||
          (!variable.sensitive && variable.value.toLowerCase().includes(query))
      );
    }

    // Apply environment filter
    if (selectedEnvironment !== "all") {
      filtered = filtered.filter(
        (variable) => variable.env_type_id === selectedEnvironment
      );
    }

    return filtered.sort((a, b) => a.key.localeCompare(b.key));
  }, [variables, searchQuery, selectedEnvironment]);

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

  const hasActiveFilters =
    searchQuery !== "" ||
    selectedEnvironment !== getDefaultEnvironmentType(environmentTypes);

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-white flex items-center">
            {isSecrets ? (
              <Shield className="size-8 mr-2 bg-red-500 border border-red-700 p-2 stroke-[3] text-white rounded-md" />
            ) : (
              <Key className="size-8 mr-2 bg-emerald-500 border border-emerald-700 p-2 stroke-[3] text-white rounded-md" />
            )}
            {isSecrets ? "Secrets" : "Variables"}
            <Count
              count={filteredVariables.length}
              variant="subtle"
              size="xl"
              className="ml-2"
            />
          </CardTitle>

          {/* Filters */}
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-slate-900 border-slate-700 text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Environment Filter */}
            <Select
              value={selectedEnvironment}
              onValueChange={setSelectedEnvironment}
            >
              <SelectTrigger className="w-48 bg-slate-900 border-slate-700 text-white">
                <Filter className="size-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {environmentTypes.map((envType) => (
                  <SelectItem
                    key={envType.id}
                    value={envType.id}
                    className="text-white"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: envType.color }}
                      />
                      <span>{envType.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center space-x-2 pt-2">
            <span className="text-sm text-slate-400">Active filters:</span>
            {searchQuery && (
              <Badge
                variant="secondary"
                className="bg-slate-700 text-slate-300"
              >
                Search: "{searchQuery}"
              </Badge>
            )}
            {selectedEnvironment !==
              getDefaultEnvironmentType(environmentTypes) && (
              <Badge
                variant="secondary"
                className="bg-slate-700 text-slate-300"
              >
                Environment:{" "}
                {environmentTypesMap.get(selectedEnvironment)?.name}
              </Badge>
            )}
            <Button
              onClick={() => {
                setSearchQuery("");
                setSelectedEnvironment(
                  getDefaultEnvironmentType(environmentTypes)
                );
              }}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white h-6 px-2"
            >
              Clear
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {filteredVariables.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {hasActiveFilters
                ? "No variables found"
                : "No variables"}
            </h3>
            <p className="text-slate-400 mb-4">
              {hasActiveFilters
                ? "No variables match your current filters"
                : "Add your first variable to get started"}
            </p>
            {hasActiveFilters && (
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedEnvironment(
                    getDefaultEnvironmentType(environmentTypes)
                  );
                }}
                variant="outline"
                className="text-white border-slate-600 hover:bg-slate-700"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">
                    Key
                  </th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">
                    Value
                  </th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">
                    Environment
                  </th>
                  {/* <th className="text-left py-3 px-4 text-slate-400 font-medium">
                    Type
                  </th> */}
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">
                    Updated
                  </th>
                  {canEdit && (
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredVariables.map((variable) => (
                  <tr
                    key={variable.id}
                    className="border-b border-slate-700 hover:bg-slate-750 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono text-emerald-400 bg-slate-900 px-2 py-1 rounded">
                          {variable.key}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          onClick={() => copy.mutate(variable.key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2 max-w-xs">
                        {variable.sensitive ? (
                          <div className="flex items-center space-x-2">
                            <code className="select-none text-sm font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded flex-1 truncate">
                              {showSensitive[variable.id]
                                ? variable.value
                                : "••••••••"}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                              onClick={() =>
                                toggleSensitiveVisibility(variable.id)
                              }
                              disabled={variable.sensitive}
                            >
                              {showSensitive[variable.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            {showSensitive[variable.id] && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                                onClick={() => copy.mutate(variable.value)}
                                disabled={variable.sensitive}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <code className="select-all text-sm font-mono text-slate-300 bg-slate-900 px-2 py-1 rounded flex-1 truncate">
                              {variable.value}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                              onClick={() => copy.mutate(variable.value)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {getEnvironmentBadge(variable.env_type_id)}
                    </td>

                    {/* <td className="py-4 px-4">
                      <Badge
                        variant="secondary"
                        className={`${
                          variable.sensitive
                            ? "bg-red-900/20 text-red-400 border-red-800"
                            : "bg-slate-700 text-slate-300 border-slate-600"
                        } border flex items-center space-x-1 w-fit`}
                      >
                        {variable.sensitive ? (
                          <Shield className="w-3 h-3" />
                        ) : (
                          <Key className="w-3 h-3" />
                        )}
                        <span>
                          {variable.sensitive ? "Secret" : "Variable"}
                        </span>
                      </Badge>
                    </td> */}

                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-1 text-sm text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(variable.updated_at)}</span>
                      </div>
                      {variable.created_by && (
                        <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1">
                          <User className="w-3 h-3" />
                          <span>{variable.created_by.name}</span>
                        </div>
                      )}
                    </td>
                    {canEdit && (
                      <td className="p-4 flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 w-8"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="bg-slate-800 border-slate-700"
                            align="end"
                          >
                            <DropdownMenuItem
                              className="text-white hover:bg-slate-700 cursor-pointer"
                              onClick={() => onEdit(variable)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Variable
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400 hover:bg-slate-700 cursor-pointer"
                              onClick={() => onDelete(variable)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Variable
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
