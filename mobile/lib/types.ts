export type QueueSummary = {
  id: string; name: string; description: string | null; status: "open" | "paused" | "closed";
  average_service_seconds: number; locations: { name: string } | null;
};
export type Ticket = {
  id: string; display_number: string; customer_name: string; status: "waiting" | "serving";
  joined_at?: string; called_at?: string | null; estimated_wait_seconds?: number;
};
export type QueueConsole = {
  queue_id: string; name: string; slug: string; status: "open" | "paused" | "closed";
  average_service_seconds: number; warning_threshold: number; waiting: Ticket[];
  serving: Ticket | null; served_today: number; no_shows_today: number;
};