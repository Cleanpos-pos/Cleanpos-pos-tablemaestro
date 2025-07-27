
"use client";

import React, { useState, useMemo } from 'react';
import type { Table } from '@/lib/types';
import { DndContext, useDraggable, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import TableStatusBadge from './TableStatusBadge';
import { Users, SquareStack } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  tables: Table[];
  onLayoutChange: (id: string, x: number, y: number) => void;
  updatedLayout: Record<string, { x: number, y: number }>;
}

export default function FloorPlan({ tables, onLayoutChange, updatedLayout }: FloorPlanProps) {
  const initialPositions = useMemo(() => {
    const positions: Record<string, { x: number, y: number }> = {};
    tables.forEach((table, index) => {
      positions[table.id] = {
        x: table.x ?? (index % 10) * (50 + GRID_SIZE * 2), // Default positioning if not set
        y: table.y ?? Math.floor(index / 10) * (40 + GRID_SIZE * 2),
      };
    });
    return positions;
  }, [tables]);

  const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>(initialPositions);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    const id = String(active.id);
    
    const newPosition = {
      x: Math.round((positions[id].x + delta.x) / GRID_SIZE) * GRID_SIZE,
      y: Math.round((positions[id].y + delta.y) / GRID_SIZE) * GRID_SIZE,
    };
    
    setPositions(prev => ({
      ...prev,
      [id]: newPosition,
    }));
    
    onLayoutChange(id, newPosition.x, newPosition.y);
  }

  const combinedPositions = useMemo(() => {
    const result = {...positions};
    for (const id in updatedLayout) {
        if(result[id]) { // only if table is in current view
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
        {tables.map(table => {
          const pos = combinedPositions[table.id] || {x: 0, y: 0};
          return (
            <DraggableTable key={table.id} table={table} initialPosition={pos}>
              <div className={cn(
                  "w-[80px] h-[50px] rounded-md shadow-md cursor-grab active:cursor-grabbing p-1.5 flex flex-col justify-between transition-colors text-xs",
                  table.status === 'available' && 'bg-green-100 border-green-400',
                  table.status === 'occupied' && 'bg-red-100 border-red-400',
                  table.status === 'reserved' && 'bg-blue-100 border-blue-400',
                  table.status === 'pending' && 'bg-orange-100 border-orange-400',
                  (table.status === 'cleaning' || table.status === 'unavailable') && 'bg-gray-200 border-gray-400',
              )}>
                <div className="flex justify-between items-center font-bold">
                  <span className="flex items-center gap-1 truncate"><SquareStack className="h-3 w-3 shrink-0"/> <span className="truncate">{table.name}</span></span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3 shrink-0"/> {table.capacity}</span>
                </div>
                <div className="text-center">
                  <TableStatusBadge status={table.status} className="px-1.5 py-0 text-[10px]" />
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
