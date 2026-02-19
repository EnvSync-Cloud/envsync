import { Activity } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";
import {
  useAuditLogs,
  getActionDescription,
  getActionCategory,
  getActionBadgeColor,
  getResourceTypeFromAction,
} from "@/hooks/useAuditLogs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";

export const AuditLogs = () => {
  const {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    filterOptions,
    pagination,
    auditLogsData,
    isLoading,
    isRefetching,
    displayData,
    paginationInfo,
    isEmpty,
    handleFilterChange,
    handlePageChange,
    handlePageSizeChange,
    handleClearSearch,
    handleResetFilters,
    handleExportLogs,
    refetch,
  } = useAuditLogs();

  return (
    <PageShell
      title="Activity"
      description="Track all activities and changes in your organization"
      icon={Activity}
      actions={
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-200"
            disabled={isRefetching}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            onClick={handleExportLogs}
            variant="outline"
            size="sm"
            className="text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      }
    >
      <AuditFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={handleClearSearch}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        users={auditLogsData?.users}
      />

      <AuditTable
        displayData={displayData}
        isLoading={isLoading}
        isEmpty={isEmpty}
        pagination={pagination}
        paginationInfo={paginationInfo}
        debouncedSearchQuery={debouncedSearchQuery}
        filterOptions={filterOptions}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onResetFilters={handleResetFilters}
        getActionDescription={getActionDescription}
        getActionCategory={getActionCategory}
        getActionBadgeColor={getActionBadgeColor}
        getResourceTypeFromAction={getResourceTypeFromAction}
      />
    </PageShell>
  );
};

export default AuditLogs;
