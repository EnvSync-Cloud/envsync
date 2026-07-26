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
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-card to-card border-border/80 shadow-xl rounded-xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary w-4 h-4" />
              <Input
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground placeholder:text-tertiary h-9"
              />
              {searchQuery && (
                <button
                  onClick={onClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-muted-foreground"
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
            <SelectTrigger className="bg-muted border-border text-muted-foreground h-9">
              <Clock className="w-3.5 h-3.5 mr-2 text-tertiary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-muted-foreground focus:bg-muted focus:text-foreground"
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
            <SelectTrigger className="bg-muted border-border text-muted-foreground h-9">
              <Filter className="w-3.5 h-3.5 mr-2 text-tertiary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {RESOURCE_TYPE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-muted-foreground focus:bg-muted focus:text-foreground"
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
            <SelectTrigger className="bg-muted border-border text-muted-foreground h-9">
              <User className="w-3.5 h-3.5 mr-2 text-tertiary" />
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem
                value="all"
                className="text-muted-foreground focus:bg-muted focus:text-foreground"
              >
                All Users
              </SelectItem>
              {users?.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                  className="text-muted-foreground focus:bg-muted focus:text-foreground"
                >
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs text-tertiary">Filters:</span>
              {searchQuery && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground text-xs"
                >
                  "{searchQuery}"
                </Badge>
              )}
              {filterOptions.timeRange !== "all_time" && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground text-xs"
                >
                  {TIME_RANGE_OPTIONS.find(
                    (o) => o.value === filterOptions.timeRange
                  )?.label}
                </Badge>
              )}
              {filterOptions.resourceType !== "all" && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground text-xs"
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
              className="text-tertiary hover:text-muted-foreground h-7 text-xs"
            >
              Reset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
