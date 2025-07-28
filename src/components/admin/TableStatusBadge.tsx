
import type { FC } from 'react';
import { Badge } from "@/components/ui/badge";
import type { TableStatus } from "@/lib/types";
import { cn } from '@/lib/utils';

interface TableStatusBadgeProps {
  status: TableStatus;
  className?: string;
}

const statusColors: Record<TableStatus, string> = {
  available: "bg-green-500 hover:bg-green-600",
  occupied: "bg-red-500 hover:bg-red-600",
  reserved: "bg-blue-500 hover:bg-blue-600",
  pending: "bg-orange-500 hover:bg-orange-600",
  cleaning: "bg-yellow-500 hover:bg-yellow-600 text-yellow-800",
  unavailable: "bg-gray-500 hover:bg-gray-600",
};

const TableStatusBadge: FC<TableStatusBadgeProps> = ({ status, className }) => {
  return (
    <Badge className={cn(statusColors[status], 'text-white capitalize', className)}>
      {status === 'cleaning' ? 'Needs Cleaning' : status}
    </Badge>
  );
};

export default TableStatusBadge;
