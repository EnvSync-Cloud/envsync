import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter, SortAsc, SortDesc } from "lucide-react";
import {
  FilterOptions,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  Statistics,
} from "@/constants";

interface ApplicationsFiltersProps {
  searchQuery: string;
  debouncedSearchQuery: string;
  filterOptions: FilterOptions;
  statistics: Statistics;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onFilterChange: (key: keyof FilterOptions, value: string) => void;
  onSortOrderToggle: () => void;
  onResetFilters: () => void;
}

export const ApplicationsFilters = ({
  searchQuery,
  debouncedSearchQuery,
  filterOptions,
  statistics,
  onSearchChange,
  onClearSearch,
  onFilterChange,
  onSortOrderToggle,
  onResetFilters,
}: ApplicationsFiltersProps) => {
  const hasActiveFilters =
    searchQuery ||
    filterOptions.status !== "all" ||
    filterOptions.sortBy !== "updated_at" ||
    filterOptions.sortOrder !== "desc";

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-white"
              />
              {searchQuery && (
                <button
                  onClick={onClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full lg:w-48">
            <Select
              value={filterOptions.status}
              onValueChange={(value) => onFilterChange("status", value)}
            >
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Options */}
          <div className="w-full lg:w-48">
            <Select
              value={filterOptions.sortBy}
              onValueChange={(value) => onFilterChange("sortBy", value)}
            >
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Order Toggle */}
          <Button
            onClick={onSortOrderToggle}
            variant="outline"
            size="sm"
            className="text-slate-400 border-slate-600 hover:bg-slate-700"
            title={`Sort ${
              filterOptions.sortOrder === "asc" ? "ascending" : "descending"
            }`}
          >
            {filterOptions.sortOrder === "asc" ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
          </Button>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              onClick={onResetFilters}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Results Summary */}
        {(debouncedSearchQuery || filterOptions.status !== "all") && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Showing {statistics.filtered} of {statistics.total} projects
              {debouncedSearchQuery && (
                <span> matching "{debouncedSearchQuery}"</span>
              )}
              {filterOptions.status !== "all" && (
                <span> with status "{filterOptions.status}"</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
