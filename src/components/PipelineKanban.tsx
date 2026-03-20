"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { PipelineStatus } from "@/types/pm";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface KanbanClient {
  id: string;
  slug: string;
  name: string;
  pipeline_status: PipelineStatus;
  contact_name: string | null;
  contact_email: string | null;
  city: string | null;
  state: string | null;
}

const COLUMNS: { value: PipelineStatus; label: string; headerColor: string; dotColor: string }[] = [
  { value: "lead", label: "Lead", headerColor: "text-slate-300", dotColor: "bg-slate-400" },
  { value: "qualified", label: "Qualified", headerColor: "text-blue-400", dotColor: "bg-blue-400" },
  { value: "discovery_complete", label: "Discovery", headerColor: "text-cyan-400", dotColor: "bg-cyan-400" },
  { value: "proposal_sent", label: "Proposal Sent", headerColor: "text-purple-400", dotColor: "bg-purple-400" },
  { value: "negotiation", label: "Negotiation", headerColor: "text-amber-400", dotColor: "bg-amber-400" },
  { value: "closed_won", label: "Closed Won", headerColor: "text-emerald-400", dotColor: "bg-emerald-400" },
  { value: "closed_lost", label: "Closed Lost", headerColor: "text-red-400", dotColor: "bg-red-400" },
];

function ClientCard({ client, isDragging }: { client: KanbanClient; isDragging?: boolean }) {
  return (
    <div className={`bg-pm-bg border border-pm-border rounded-lg p-3 ${isDragging ? "opacity-70 shadow-lg ring-2 ring-pm-accent" : "hover:border-pm-accent/40"} transition-colors`}>
      <div className="font-medium text-pm-text text-sm">{client.name}</div>
      {client.contact_name && (
        <div className="text-xs text-pm-muted mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          {client.contact_name}
        </div>
      )}
      {(client.city || client.state) && (
        <div className="text-xs text-pm-muted mt-0.5">
          {[client.city, client.state].filter(Boolean).join(", ")}
        </div>
      )}
      <div className="mt-2">
        <Link
          href={`/clients/${client.slug}`}
          className="text-xs text-pm-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open Dashboard
        </Link>
      </div>
    </div>
  );
}

function SortableCard({ client }: { client: KanbanClient }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: client.id,
    data: { type: "client", status: client.pipeline_status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <ClientCard client={client} isDragging={isDragging} />
    </div>
  );
}

function KanbanColumn({ status, label, headerColor, dotColor, clients }: {
  status: PipelineStatus;
  label: string;
  headerColor: string;
  dotColor: string;
  clients: KanbanClient[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[220px] w-[220px] bg-pm-card rounded-xl border ${isOver ? "border-pm-accent bg-pm-accent/5" : "border-pm-border"} transition-colors`}
    >
      <div className="px-3 py-2.5 border-b border-pm-border flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className={`text-sm font-semibold ${headerColor}`}>{label}</span>
        <span className="text-xs text-pm-muted ml-auto">{clients.length}</span>
      </div>
      <div className="p-2 flex-1 space-y-2 min-h-[80px] overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={clients.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {clients.map((client) => (
            <SortableCard key={client.id} client={client} />
          ))}
        </SortableContext>
        {clients.length === 0 && (
          <div className="text-xs text-pm-muted text-center py-4">Drop here</div>
        )}
      </div>
    </div>
  );
}

export function PipelineKanban({ clients: initialClients, onStatusChange }: {
  clients: KanbanClient[];
  onStatusChange: (clientId: string, newStatus: PipelineStatus) => void;
}) {
  const [clients, setClients] = useState(initialClients);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync with parent if initialClients changes
  const clientsKey = initialClients.map((c) => `${c.id}:${c.pipeline_status}`).join(",");
  const [prevKey, setPrevKey] = useState(clientsKey);
  if (clientsKey !== prevKey) {
    setClients(initialClients);
    setPrevKey(clientsKey);
  }

  const grouped = useMemo(() => {
    const map: Record<PipelineStatus, KanbanClient[]> = {
      lead: [], qualified: [], discovery_complete: [], proposal_sent: [], negotiation: [], closed_won: [], closed_lost: [],
    };
    for (const c of clients) {
      (map[c.pipeline_status] ?? map.lead).push(c);
    }
    return map;
  }, [clients]);

  const activeClient = activeId ? clients.find((c) => c.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const clientId = active.id as string;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    // Determine target column — "over" could be a column ID or another card
    let targetStatus: PipelineStatus;
    const overIsColumn = COLUMNS.some((col) => col.value === over.id);
    if (overIsColumn) {
      targetStatus = over.id as PipelineStatus;
    } else {
      // Dropped on a card — find which column that card is in
      const overClient = clients.find((c) => c.id === over.id);
      if (!overClient) return;
      targetStatus = overClient.pipeline_status;
    }

    if (client.pipeline_status === targetStatus) return;

    // Optimistic update
    setClients((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, pipeline_status: targetStatus } : c)
    );
    onStatusChange(clientId, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.value}
            status={col.value}
            label={col.label}
            headerColor={col.headerColor}
            dotColor={col.dotColor}
            clients={grouped[col.value]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeClient ? <ClientCard client={activeClient} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
