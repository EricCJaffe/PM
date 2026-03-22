"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old: Record<string, any>;
}

interface UseRealtimeTableOptions {
  /** The Postgres table to subscribe to */
  table: string;
  /** Which events to listen for (default: "*") */
  event?: Event;
  /** Optional filter string, e.g. "project_id=eq.abc-123" */
  filter?: string;
  /** Called when a matching change arrives */
  onPayload: (
    payload: RealtimePayload,
    eventType: "INSERT" | "UPDATE" | "DELETE"
  ) => void;
  /** Set to false to disable the subscription (e.g. while loading) */
  enabled?: boolean;
}

/**
 * Hook that subscribes to Supabase Realtime Postgres Changes for a table.
 * RLS policies filter which rows the authenticated user receives.
 *
 * Usage:
 *   useRealtimeTable({
 *     table: "pm_tasks",
 *     filter: `project_id=eq.${projectId}`,
 *     onPayload: (payload, eventType) => { ... update state ... },
 *   });
 */
export function useRealtimeTable({
  table,
  event = "*",
  filter,
  onPayload,
  enabled = true,
}: UseRealtimeTableOptions) {
  // Use a ref for the callback so we don't re-subscribe on every render
  const callbackRef = useRef(onPayload);
  callbackRef.current = onPayload;

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channelName = `realtime:${table}${filter ? `:${filter}` : ""}`;

    // Build the subscription config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listenConfig: any = {
      event,
      schema: "public",
      table,
    };
    if (filter) {
      listenConfig.filter = filter;
    }

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        listenConfig,
        (payload: RealtimePayload) => {
          callbackRef.current(payload, payload.eventType);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, enabled]);
}
