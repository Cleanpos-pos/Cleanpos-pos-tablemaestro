
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Table, Booking, TableStatus } from '@/lib/types';
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import TableStatusBadge from './TableStatusBadge';
import { Users, SquareStack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';


const GRID_SIZE = 10;

interface DraggableTableProps {
  table: Table;
  initialPosition: { x: number, y: number };
  children: React.ReactNode;
}

function DraggableTable({ table, initialPosition, children }: DraggableTableProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: table.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    left: `${initialPosition.x}px`,
    top: `${initialPosition.y}px`,
    position: 'absolute' as const,
  } : {
    left: `${initialPosition.x}px`,
    top: `${initialPosition.y}px`,
    position: 'absolute' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      {children}
    </div>
  );
}

interface FloorPlanProps {
  allTables: Table[];
  allBookings: Booking[];
  selectedDate: Date;
  onLayoutChange: (id: string, x: number, y: number) => void;
  updatedLayout: Record<string, { x: number, y: number }>;
}

export default function FloorPlan({ allTables, allBookings, selectedDate, onLayoutChange, updatedLayout }: FloorPlanProps) {
  
    const tablesWithCorrectStatus = useMemo(() => {
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const dateBookings = allBookings.filter(b => b.date === formattedDate && b.tableId && b.status !== 'cancelled' && b.status !== 'completed');
    
    const tableBookingMap = new Map<string, Booking>();
    // Prioritize seated > confirmed > pending
    for (const booking of dateBookings) {
      if (!booking.tableId) continue;
      const existing = tableBookingMap.get(booking.tableId);
      if (!existing) {
        tableBookingMap.set(booking.tableId, booking);
      } else {
        const priority = { 'seated': 3, 'confirmed': 2, 'pending': 1, 'completed': 0, 'cancelled': 0 };
        if ((priority[booking.status] || 0) > (priority[existing.status] || 0)) {
           tableBookingMap.set(booking.tableId, booking);
        }
      }
    }

    const bookingStatusToTableStatus: Record<string, TableStatus> = {
      pending: 'pending',
      confirmed: 'reserved',
      seated: 'occupied'
    };
    
    return allTables.map(table => {
      const booking = tableBookingMap.get(table.id);
      if (booking) {
        const newStatus = bookingStatusToTableStatus[booking.status];
        if (newStatus) {
            return { ...table, status: newStatus };
        }
      }
      // If no booking, return the table with its live status from the database
      return table; 
    });
  }, [allTables, allBookings, selectedDate]);

  const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>({});

  useEffect(() => {
    const initialPositions: Record<string, { x: number, y: number }> = {};
    allTables.forEach((table, index) => {
      initialPositions[table.id] = {
        x: table.x ?? (index % 5) * (80 + GRID_SIZE * 2), // Adjusted for smaller tables
        y: table.y ?? Math.floor(index / 5) * (50 + GRID_SIZE * 2), // Adjusted for smaller tables
      };
    });
    setPositions(initialPositions);
  }, [allTables]);


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    const id = String(active.id);
    
    setPositions(prev => {
        const currentPos = prev[id] || {x: 0, y: 0};
        const newPosition = {
          x: Math.round((currentPos.x + delta.x) / GRID_SIZE) * GRID_SIZE,
          y: Math.round((currentPos.y + delta.y) / GRID_SIZE) * GRID_SIZE,
        };
        onLayoutChange(id, newPosition.x, newPosition.y);
        return {
          ...prev,
          [id]: newPosition,
        };
    });
  }

  const combinedPositions = useMemo(() => {
    const result = {...positions};
    for (const id in updatedLayout) {
        if(result[id]) {
            result[id] = updatedLayout[id];
        }
    }
    return result;
  }, [positions, updatedLayout])

  return (
    <DndContext 
      onDragEnd={handleDragEnd} 
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
    >
      <div className="relative w-full min-h-[600px] bg-muted/30 rounded-lg border-2 border-dashed border-gray-300 p-4">
        {tablesWithCorrectStatus.map(table => {
          const pos = combinedPositions[table.id] || {x: 0, y: 0};
          return (
            <DraggableTable key={table.id} table={table} initialPosition={pos}>
              <div className={cn(
                  "w-[40px] h-[25px] rounded-md shadow-md cursor-grab active:cursor-grabbing p-1 flex flex-col justify-between transition-colors text-[8px]",
                  table.status === 'available' && 'bg-green-100 border-green-400',
                  table.status === 'occupied' && 'bg-red-100 border-red-400',
                  table.status === 'reserved' && 'bg-blue-100 border-blue-400',
                  table.status === 'pending' && 'bg-orange-100 border-orange-400',
                  (table.status === 'cleaning' || table.status === 'unavailable') && 'bg-gray-200 border-gray-400',
              )}>
                <div className="flex justify-between items-center font-bold">
                  <span className="flex items-center gap-0.5 truncate"><SquareStack className="h-2 w-2 shrink-0"/> <span className="truncate">{table.name}</span></span>
                  <span className="flex items-center gap-0.5"><Users className="h-2 w-2 shrink-0"/> {table.capacity}</span>
                </div>
                <div className="text-center -mt-0.5">
                  <TableStatusBadge status={table.status} className="px-1 py-0 text-[6px]" />
                </div>
              </div>
            </DraggableTable>
          );
        })}
         <div 
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        />
      </div>
    </DndContext>
  );
}
