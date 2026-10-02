import { z } from "zod";
export const operationSchema = z.object({ queueId: z.uuid(), requestId: z.uuid(), ticketId: z.uuid().optional(), operation: z.enum(["call_next","complete","no_show","recall","cancel","open","paused","closed"]) }).strict();
const ticket = z.object({ id:z.uuid(),display_number:z.string(),customer_name:z.string(),status:z.enum(["waiting","serving"]),joined_at:z.string().optional(),called_at:z.string().nullable().optional(),estimated_wait_seconds:z.number().optional() }).strict();
export const consoleSchema=z.object({queue_id:z.uuid(),name:z.string(),slug:z.string(),status:z.enum(["open","paused","closed"]),average_service_seconds:z.number(),warning_threshold:z.number(),waiting:z.array(ticket),serving:ticket.nullable(),served_today:z.number(),no_shows_today:z.number()}).strict();
export type QueueConsole = z.infer<typeof consoleSchema>;
export type OperationInput=z.infer<typeof operationSchema>;
export type OperationResult={ok:boolean;message:string;retry?:boolean};
export const metricsSchema=z.object({timezone:z.string(),days:z.number(),waiting:z.number(),serving:z.number(),joins:z.number(),joins_today:z.number(),completed:z.number(),completed_today:z.number(),no_shows:z.number(),cancelled:z.number(),average_wait_seconds:z.number().nullable(),average_service_seconds:z.number().nullable(),daily:z.array(z.object({date:z.string(),joins:z.number(),average_wait_seconds:z.number().nullable()})),hourly:z.array(z.object({hour:z.number(),joins:z.number()}))});
export type BusinessMetrics=z.infer<typeof metricsSchema>;
