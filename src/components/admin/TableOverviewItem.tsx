
"use client";
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TableStatusBadge from "./TableStatusBadge";
import type { Table, TableStatus } from "@/lib/types";
import { Users, SquareStack } from "lucide-react";

interface TableOverviewItemProps {
  table: Table;
  onStatusChange: (tableId: string, newStatus: TableStatus) => void;
}

const tableStatuses: TableStatus[] = ['available', 'occupied', 'reserved', 'cleaning', 'unavailable'];

const TableOverviewItem: FC<TableOverviewItemProps> = ({ table, onStatusChange }) => {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-lg flex items-center">
              <SquareStack className="mr-2 h-5 w-5 text-primary" />
              {table.name}
            </CardTitle>
            {table.location && <CardDescription className="text-xs font-body">{table.location}</CardDescription>}
          </div>
          <div className="flex items-center text-sm text-muted-foreground font-body">
            <Users className="mr-1 h-4 w-4" /> {table.capacity}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow justify-between pt-2">
        <div className="mb-3">
            <Select
                value={table.status}
                onValueChange={(newStatus: TableStatus) => onStatusChange(table.id, newStatus)}
            >
                <SelectTrigger className="w-full font-body text-sm capitalize">
                    <TableStatusBadge status={table.status} />
                </SelectTrigger>
                <SelectContent>
                {tableStatuses.map(status => (
                    <SelectItem key={status} value={status} className="font-body capitalize">
                    {status}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
        </div>
        {/* Placeholder for booking info if occupied/reserved */}
        {(table.status === 'occupied' || table.status === 'reserved') && (
          <div className="text-xs p-2 bg-muted/50 rounded-md mt-auto">
            <p className="font-body text-muted-foreground">
              {table.status === 'occupied' ? "Currently with guests." : "Reserved for upcoming."}
            </p>
            {/* Future: Display guest name or booking time */}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TableOverviewItem;
