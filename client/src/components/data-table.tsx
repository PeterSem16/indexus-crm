import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string | React.ReactNode;
  cell: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | Date | null;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (selectedKeys: Set<string>) => void;
  sortConfig?: SortConfig | null;
  onSortChange?: (config: SortConfig | null) => void;
}

export function DataTable<T>({ 
  columns, 
  data, 
  isLoading, 
  emptyMessage = "No data found",
  onRowClick,
  getRowKey,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  sortConfig = null,
  onSortChange
}: DataTableProps<T>) {
  
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;
    
    if (sortConfig?.key === column.key) {
      if (sortConfig.direction === "asc") {
        onSortChange({ key: column.key, direction: "desc" });
      } else if (sortConfig.direction === "desc") {
        onSortChange(null);
      } else {
        onSortChange({ key: column.key, direction: "asc" });
      }
    } else {
      onSortChange({ key: column.key, direction: "asc" });
    }
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;
    if (sortConfig?.key !== column.key) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="w-4 h-4 ml-1" />;
    }
    if (sortConfig.direction === "desc") {
      return <ArrowDown className="w-4 h-4 ml-1" />;
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
  };

  const sortedData = [...data];
  if (sortConfig && sortConfig.direction) {
    const column = columns.find(c => c.key === sortConfig.key);
    if (column?.sortValue) {
      sortedData.sort((a, b) => {
        const aVal = column.sortValue!(a);
        const bVal = column.sortValue!(b);
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        let comparison = 0;
        if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortConfig.direction === "desc" ? -comparison : comparison;
      });
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(new Set(sortedData.map(item => getRowKey(item))));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectOne = (key: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSet = new Set(selectedKeys);
    if (checked) {
      newSet.add(key);
    } else {
      newSet.delete(key);
    }
    onSelectionChange(newSet);
  };

  const allSelected = sortedData.length > 0 && sortedData.every(item => selectedKeys.has(getRowKey(item)));
  const someSelected = sortedData.some(item => selectedKeys.has(getRowKey(item)));

  const renderHeader = () => (
    <TableRow>
      {selectable && (
        <TableHead className="w-12">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all"
            data-testid="checkbox-select-all"
            className={someSelected && !allSelected ? "data-[state=checked]:bg-primary/50" : ""}
          />
        </TableHead>
      )}
      {columns.map((column) => (
        <TableHead 
          key={column.key} 
          className={cn(
            column.className,
            column.sortable && "cursor-pointer select-none"
          )}
          onClick={() => handleSort(column)}
        >
          <div className="flex items-center">
            {column.header}
            {getSortIcon(column)}
          </div>
        </TableHead>
      ))}
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>{renderHeader()}</TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {selectable && (
                  <TableCell className="w-12">
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>{renderHeader()}</TableHeader>
          <TableBody>
            <TableRow>
              <TableCell 
                colSpan={columns.length + (selectable ? 1 : 0)} 
                className="h-32 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>{renderHeader()}</TableHeader>
        <TableBody>
          {sortedData.map((item) => {
            const key = getRowKey(item);
            const isSelected = selectedKeys.has(key);
            return (
              <TableRow 
                key={key}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  onRowClick && "cursor-pointer",
                  isSelected && "bg-muted/50"
                )}
                data-testid={`table-row-${key}`}
              >
                {selectable && (
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(key, !!checked)}
                      aria-label={`Select row ${key}`}
                      data-testid={`checkbox-row-${key}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(item)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
