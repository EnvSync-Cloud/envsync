import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter, Clock, User } from "lucide-react";
import { TIME_RANGE_OPTIONS, RESOURCE_TYPE_OPTIONS } from "@/hooks/useAuditLogs";

interface AuditFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  filterOptions: {
    action: string;
    user: string;
    timeRange: string;
    resourceType: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onResetFilters: () => void;
  users?: Array<{ id: string; full_name: string }>;
}

export function AuditFilters({
  searchQuery,
  onSearchChange,
  onClearSearch,
  filterOptions,
  onFilterChange,
  onResetFilters,
  users,
}: AuditFiltersProps) {
  const hasActiveFilters =
    searchQuery ||
    filterOptions.timeRange !== "all_time" ||
    filterOptions.resourceType !== "all" ||
    filterOptions.user !== "all";

  return (
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-500 h-9"
              />
              {searchQuery && (
                <button
                  onClick={onClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Time Range */}
          <Select
            value={filterOptions.timeRange}
            onValueChange={(value) => onFilterChange("timeRange", value)}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-300 h-9">
              <Clock className="w-3.5 h-3.5 mr-2 text-gray-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-gray-300 focus:bg-gray-800 focus:text-gray-100"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Resource Type */}
          <Select
            value={filterOptions.resourceType}
            onValueChange={(value) => onFilterChange("resourceType", value)}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-300 h-9">
              <Filter className="w-3.5 h-3.5 mr-2 text-gray-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              {RESOURCE_TYPE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-gray-300 focus:bg-gray-800 focus:text-gray-100"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User Filter */}
          <Select
            value={filterOptions.user}
            onValueChange={(value) => onFilterChange("user", value)}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-300 h-9">
              <User className="w-3.5 h-3.5 mr-2 text-gray-500" />
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              <SelectItem
                value="all"
                className="text-gray-300 focus:bg-gray-800 focus:text-gray-100"
              >
                All Users
              </SelectItem>
              {users?.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                  className="text-gray-300 focus:bg-gray-800 focus:text-gray-100"
                >
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs text-gray-500">Filters:</span>
              {searchQuery && (
                <Badge
                  variant="secondary"
                  className="bg-gray-800 text-gray-400 text-xs"
                >
                  "{searchQuery}"
                </Badge>
              )}
              {filterOptions.timeRange !== "all_time" && (
                <Badge
                  variant="secondary"
                  className="bg-gray-800 text-gray-400 text-xs"
                >
                  {TIME_RANGE_OPTIONS.find(
                    (o) => o.value === filterOptions.timeRange
                  )?.label}
                </Badge>
              )}
              {filterOptions.resourceType !== "all" && (
                <Badge
                  variant="secondary"
                  className="bg-gray-800 text-gray-400 text-xs"
                >
                  {RESOURCE_TYPE_OPTIONS.find(
                    (o) => o.value === filterOptions.resourceType
                  )?.label}
                </Badge>
              )}
            </div>
            <Button
              onClick={onResetFilters}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-300 h-7 text-xs"
            >
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
