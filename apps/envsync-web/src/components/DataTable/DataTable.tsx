import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Trash2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  title?: string;
  titleIcon?: React.ReactNode;
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  bulkActions?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  emptyState?: React.ReactNode;
  emptySearchState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  title,
  titleIcon,
  sortable = true,
  pagination = true,
  pageSize = 20,
  selectable = false,
  onSelectionChange,
  bulkActions,
  searchable = true,
  searchPlaceholder = "Search…",
  searchFilter,
  emptyState,
  emptySearchState,
  className,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = useCallback(
    (columnId: string) => {
      if (!sortable) return;
      if (sortColumn === columnId) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(columnId);
        setSortDirection("asc");
      }
      setCurrentPage(1);
    },
    [sortable, sortColumn]
  );

  const filteredData = useMemo(() => {
    if (!searchQuery || !searchFilter) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((row) => searchFilter(row, query));
  }, [data, searchQuery, searchFilter]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const column = columns.find((col) => col.id === sortColumn);
    if (!column?.sortValue) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = column.sortValue!(a);
      const bVal = column.sortValue!(b);
      const modifier = sortDirection === "asc" ? 1 : -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * modifier;
      }
      return String(aVal).localeCompare(String(bVal)) * modifier;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  const totalPages = pagination ? Math.ceil(sortedData.length / pageSize) : 1;
  const paginatedData = pagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData;

  const selectedItems = useMemo(() => {
    return data.filter((row) => selectedRows[getRowId(row)]);
  }, [data, selectedRows, getRowId]);

  const visibleSelectedCount = paginatedData.filter((row) => selectedRows[getRowId(row)]).length;
  const allVisibleSelected = paginatedData.length > 0 && visibleSelectedCount === paginatedData.length;

  const toggleAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedRows((prev) => {
        const next = { ...prev };
        paginatedData.forEach((row) => {
          next[getRowId(row)] = checked;
        });
        return next;
      });
    },
    [paginatedData, getRowId]
  );

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedRows((prev) => ({ ...prev, [id]: checked }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows({});
  }, []);

  const handleSelectionChange = useCallback(
    (selected: T[]) => {
      onSelectionChange?.(selected);
    },
    [onSelectionChange]
  );

  const renderSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="ml-2 size-4 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 size-4" />
    ) : (
      <ArrowDown className="ml-2 size-4" />
    );
  };

  const renderPagination = () => {
    if (!pagination || totalPages <= 1) return null;

    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
          {sortedData.length} results
        </div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
            {start > 1 && (
              <>
                <PaginationItem>
                  <PaginationLink onClick={() => setCurrentPage(1)}>
                    1
                  </PaginationLink>
                </PaginationItem>
                {start > 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
              </>
            )}
            {pages.map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === currentPage}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            {end < totalPages && (
              <>
                {end < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <Card className={className}>
      {(title || searchable || selectable) && (
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {title && (
              <CardTitle className="flex items-center">
                {titleIcon}
                {title}
                <Badge variant="secondary" className="ml-2">
                  {filteredData.length}
                </Badge>
              </CardTitle>
            )}
          </div>

          {searchable && (
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {selectable && visibleSelectedCount > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {visibleSelectedCount} selected
                </Badge>
                {!allVisibleSelected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80 h-7 px-2"
                    onClick={() => toggleAllVisible(true)}
                  >
                    Select all {paginatedData.length}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {bulkActions}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-7 px-2"
                  onClick={clearSelection}
                >
                  <XCircle className="mr-1 size-4" />
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
      )}

      <CardContent className="p-0">
        {filteredData.length === 0 ? (
          <div className="py-14 text-center">
            {searchQuery ? emptySearchState : emptyState}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectable && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))}
                          aria-label="Select all visible rows"
                        />
                      </TableHead>
                    )}
                    {columns.map((column) => (
                      <TableHead
                        key={column.id}
                        className={cn(
                          column.width && `w-${column.width}`,
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          sortable && column.sortable !== false && "cursor-pointer select-none"
                        )}
                        onClick={() => column.sortable !== false && handleSort(column.id)}
                      >
                        <div className="flex items-center">
                          {column.header}
                          {sortable && column.sortable !== false && renderSortIcon(column.id)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((row) => {
                    const rowId = getRowId(row);
                    return (
                      <TableRow
                        key={rowId}
                        data-state={selectedRows[rowId] ? "selected" : undefined}
                        className="text-sm"
                      >
                        {selectable && (
                          <TableCell>
                            <Checkbox
                              checked={Boolean(selectedRows[rowId])}
                              onCheckedChange={(checked) => toggleRow(rowId, Boolean(checked))}
                              aria-label={`Select row`}
                            />
                          </TableCell>
                        )}
                        {columns.map((column) => (
                          <TableCell
                            key={column.id}
                            className={cn(
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right"
                            )}
                          >
                            {column.accessor(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {renderPagination()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
