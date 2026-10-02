// Generated from migrations by npm run db:types. Do not edit manually.
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "business_events": {
                Row: {
                    "actor_user_id": string;
                    "business_id": string;
                    "created_at": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "type": string;
                };
                Insert: {
                    "actor_user_id": string;
                    "business_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "type": string;
                };
                Update: {
                    "actor_user_id"?: string;
                    "business_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "type"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "business_events_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "business_members": {
                Row: {
                    "business_id": string;
                    "clerk_user_id": string;
                    "created_at": string;
                    "id": string;
                    "role": Database["public"]['Enums']["business_role"];
                };
                Insert: {
                    "business_id": string;
                    "clerk_user_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "role"?: Database["public"]['Enums']["business_role"];
                };
                Update: {
                    "business_id"?: string;
                    "clerk_user_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "role"?: Database["public"]['Enums']["business_role"];
                };
                Relationships: [
                    {
                        foreignKeyName: "business_members_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "businesses": {
                Row: {
                    "country_code": string;
                    "created_at": string;
                    "id": string;
                    "industry": string;
                    "logo_url": string | null;
                    "name": string;
                    "owner_user_id": string;
                    "slug": string;
                    "subscription_tier": Database["public"]['Enums']["subscription_plan"];
                    "timezone": string;
                    "updated_at": string;
                };
                Insert: {
                    "country_code": string;
                    "created_at"?: string;
                    "id"?: string;
                    "industry": string;
                    "logo_url"?: string | null;
                    "name": string;
                    "owner_user_id": string;
                    "slug": string;
                    "subscription_tier"?: Database["public"]['Enums']["subscription_plan"];
                    "timezone"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "country_code"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "industry"?: string;
                    "logo_url"?: string | null;
                    "name"?: string;
                    "owner_user_id"?: string;
                    "slug"?: string;
                    "subscription_tier"?: Database["public"]['Enums']["subscription_plan"];
                    "timezone"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "businesses_owner_membership_fk";
                        columns: [
                            "id",
                            "owner_user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "business_members";
                        referencedColumns: [
                            "business_id",
                            "clerk_user_id"
                        ];
                    }
                ];
            };
            "locations": {
                Row: {
                    "address": string;
                    "business_id": string;
                    "created_at": string;
                    "id": string;
                    "is_active": boolean;
                    "name": string;
                    "timezone": string;
                    "updated_at": string;
                };
                Insert: {
                    "address": string;
                    "business_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                    "name": string;
                    "timezone"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "address"?: string;
                    "business_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                    "name"?: string;
                    "timezone"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "locations_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "notifications": {
                Row: {
                    "channel": Database["public"]['Enums']["notification_channel"];
                    "created_at": string;
                    "deduplication_key": string;
                    "error_message": string | null;
                    "id": string;
                    "provider_reference": string | null;
                    "sent_at": string | null;
                    "status": Database["public"]['Enums']["notification_status"];
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["notification_type"];
                };
                Insert: {
                    "channel": Database["public"]['Enums']["notification_channel"];
                    "created_at"?: string;
                    "deduplication_key": string;
                    "error_message"?: string | null;
                    "id"?: string;
                    "provider_reference"?: string | null;
                    "sent_at"?: string | null;
                    "status"?: Database["public"]['Enums']["notification_status"];
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["notification_type"];
                };
                Update: {
                    "channel"?: Database["public"]['Enums']["notification_channel"];
                    "created_at"?: string;
                    "deduplication_key"?: string;
                    "error_message"?: string | null;
                    "id"?: string;
                    "provider_reference"?: string | null;
                    "sent_at"?: string | null;
                    "status"?: Database["public"]['Enums']["notification_status"];
                    "ticket_id"?: string;
                    "type"?: Database["public"]['Enums']["notification_type"];
                };
                Relationships: [
                    {
                        foreignKeyName: "notifications_ticket_id_fkey";
                        columns: [
                            "ticket_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "tickets";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "push_subscriptions": {
                Row: {
                    "auth": string;
                    "clerk_user_id": string | null;
                    "created_at": string;
                    "endpoint": string;
                    "id": string;
                    "p256dh": string;
                    "ticket_id": string | null;
                };
                Insert: {
                    "auth": string;
                    "clerk_user_id"?: string | null;
                    "created_at"?: string;
                    "endpoint": string;
                    "id"?: string;
                    "p256dh": string;
                    "ticket_id"?: string | null;
                };
                Update: {
                    "auth"?: string;
                    "clerk_user_id"?: string | null;
                    "created_at"?: string;
                    "endpoint"?: string;
                    "id"?: string;
                    "p256dh"?: string;
                    "ticket_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "push_subscriptions_ticket_id_fkey";
                        columns: [
                            "ticket_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "tickets";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "queue_call_requests": {
                Row: {
                    "actor_user_id": string;
                    "created_at": string;
                    "outcome": string;
                    "queue_id": string;
                    "request_id": string;
                    "ticket_id": string | null;
                };
                Insert: {
                    "actor_user_id": string;
                    "created_at"?: string;
                    "outcome": string;
                    "queue_id": string;
                    "request_id": string;
                    "ticket_id"?: string | null;
                };
                Update: {
                    "actor_user_id"?: string;
                    "created_at"?: string;
                    "outcome"?: string;
                    "queue_id"?: string;
                    "request_id"?: string;
                    "ticket_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "queue_call_requests_queue_id_fkey";
                        columns: [
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "queues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "queue_call_requests_ticket_id_queue_id_fkey";
                        columns: [
                            "ticket_id",
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "tickets";
                        referencedColumns: [
                            "id",
                            "queue_id"
                        ];
                    }
                ];
            };
            "queue_daily_counters": {
                Row: {
                    "id": string;
                    "last_number": number;
                    "queue_id": string;
                    "service_date": string;
                };
                Insert: {
                    "id"?: string;
                    "last_number"?: number;
                    "queue_id": string;
                    "service_date": string;
                };
                Update: {
                    "id"?: string;
                    "last_number"?: number;
                    "queue_id"?: string;
                    "service_date"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "queue_daily_counters_queue_id_fkey";
                        columns: [
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "queues";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "queue_join_rate_limits": {
                Row: {
                    "joins": number;
                    "key": string;
                    "window_started_at": string;
                };
                Insert: {
                    "joins": number;
                    "key": string;
                    "window_started_at": string;
                };
                Update: {
                    "joins"?: number;
                    "key"?: string;
                    "window_started_at"?: string;
                };
                Relationships: [
                ];
            };
            "queue_join_requests": {
                Row: {
                    "created_at": string;
                    "customer_key": string;
                    "id": string;
                    "queue_id": string;
                    "ticket_id": string;
                };
                Insert: {
                    "created_at"?: string;
                    "customer_key": string;
                    "id": string;
                    "queue_id": string;
                    "ticket_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "customer_key"?: string;
                    "id"?: string;
                    "queue_id"?: string;
                    "ticket_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "queue_join_requests_queue_id_fkey";
                        columns: [
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "queues";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "queue_join_requests_ticket_id_queue_id_fkey";
                        columns: [
                            "ticket_id",
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "tickets";
                        referencedColumns: [
                            "id",
                            "queue_id"
                        ];
                    }
                ];
            };
            "queue_staff_assignments": {
                Row: {
                    "business_id": string;
                    "business_member_id": string;
                    "created_at": string;
                    "id": string;
                    "queue_id": string;
                };
                Insert: {
                    "business_id": string;
                    "business_member_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "queue_id": string;
                };
                Update: {
                    "business_id"?: string;
                    "business_member_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "queue_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "queue_staff_assignments_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "queue_staff_assignments_business_member_id_business_id_fkey";
                        columns: [
                            "business_member_id",
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "business_members";
                        referencedColumns: [
                            "id",
                            "business_id"
                        ];
                    },
                    {
                        foreignKeyName: "queue_staff_assignments_queue_id_business_id_fkey";
                        columns: [
                            "queue_id",
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "queues";
                        referencedColumns: [
                            "id",
                            "business_id"
                        ];
                    }
                ];
            };
            "queues": {
                Row: {
                    "allow_phone": boolean;
                    "average_service_seconds": number;
                    "business_id": string;
                    "created_at": string;
                    "description": string | null;
                    "id": string;
                    "location_id": string;
                    "name": string;
                    "require_phone": boolean;
                    "revision": number;
                    "slug": string;
                    "status": Database["public"]['Enums']["queue_status"];
                    "updated_at": string;
                    "warning_threshold": number;
                };
                Insert: {
                    "allow_phone"?: boolean;
                    "average_service_seconds"?: number;
                    "business_id": string;
                    "created_at"?: string;
                    "description"?: string | null;
                    "id"?: string;
                    "location_id": string;
                    "name": string;
                    "require_phone"?: boolean;
                    "revision"?: number;
                    "slug": string;
                    "status"?: Database["public"]['Enums']["queue_status"];
                    "updated_at"?: string;
                    "warning_threshold"?: number;
                };
                Update: {
                    "allow_phone"?: boolean;
                    "average_service_seconds"?: number;
                    "business_id"?: string;
                    "created_at"?: string;
                    "description"?: string | null;
                    "id"?: string;
                    "location_id"?: string;
                    "name"?: string;
                    "require_phone"?: boolean;
                    "revision"?: number;
                    "slug"?: string;
                    "status"?: Database["public"]['Enums']["queue_status"];
                    "updated_at"?: string;
                    "warning_threshold"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "queues_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "queues_location_id_business_id_fkey";
                        columns: [
                            "location_id",
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "locations";
                        referencedColumns: [
                            "id",
                            "business_id"
                        ];
                    }
                ];
            };
            "subscriptions": {
                Row: {
                    "business_id": string;
                    "created_at": string;
                    "current_period_end": string | null;
                    "id": string;
                    "plan": Database["public"]['Enums']["subscription_plan"];
                    "provider": string;
                    "provider_customer_code": string | null;
                    "provider_subscription_code": string | null;
                    "status": Database["public"]['Enums']["subscription_status"];
                    "updated_at": string;
                };
                Insert: {
                    "business_id": string;
                    "created_at"?: string;
                    "current_period_end"?: string | null;
                    "id"?: string;
                    "plan"?: Database["public"]['Enums']["subscription_plan"];
                    "provider"?: string;
                    "provider_customer_code"?: string | null;
                    "provider_subscription_code"?: string | null;
                    "status"?: Database["public"]['Enums']["subscription_status"];
                    "updated_at"?: string;
                };
                Update: {
                    "business_id"?: string;
                    "created_at"?: string;
                    "current_period_end"?: string | null;
                    "id"?: string;
                    "plan"?: Database["public"]['Enums']["subscription_plan"];
                    "provider"?: string;
                    "provider_customer_code"?: string | null;
                    "provider_subscription_code"?: string | null;
                    "status"?: Database["public"]['Enums']["subscription_status"];
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "subscriptions_business_id_fkey";
                        columns: [
                            "business_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "ticket_events": {
                Row: {
                    "actor_id": string | null;
                    "actor_type": Database["public"]['Enums']["ticket_actor_type"];
                    "created_at": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "queue_id": string;
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["ticket_event_type"];
                };
                Insert: {
                    "actor_id"?: string | null;
                    "actor_type": Database["public"]['Enums']["ticket_actor_type"];
                    "created_at"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "queue_id": string;
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["ticket_event_type"];
                };
                Update: {
                    "actor_id"?: string | null;
                    "actor_type"?: Database["public"]['Enums']["ticket_actor_type"];
                    "created_at"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "queue_id"?: string;
                    "ticket_id"?: string;
                    "type"?: Database["public"]['Enums']["ticket_event_type"];
                };
                Relationships: [
                    {
                        foreignKeyName: "ticket_events_ticket_id_queue_id_fkey";
                        columns: [
                            "ticket_id",
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "tickets";
                        referencedColumns: [
                            "id",
                            "queue_id"
                        ];
                    }
                ];
            };
            "tickets": {
                Row: {
                    "called_at": string | null;
                    "cancelled_at": string | null;
                    "completed_at": string | null;
                    "created_at": string;
                    "customer_key": string | null;
                    "customer_name": string;
                    "display_number": string;
                    "estimated_wait_seconds": number;
                    "id": string;
                    "joined_at": string;
                    "no_show_at": string | null;
                    "phone": string | null;
                    "public_token": string;
                    "queue_id": string;
                    "sequence_number": number;
                    "service_date": string;
                    "status": Database["public"]['Enums']["ticket_status"];
                    "updated_at": string;
                };
                Insert: {
                    "called_at"?: string | null;
                    "cancelled_at"?: string | null;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "customer_key"?: string | null;
                    "customer_name": string;
                    "display_number": string;
                    "estimated_wait_seconds"?: number;
                    "id"?: string;
                    "joined_at"?: string;
                    "no_show_at"?: string | null;
                    "phone"?: string | null;
                    "public_token"?: string;
                    "queue_id": string;
                    "sequence_number": number;
                    "service_date": string;
                    "status"?: Database["public"]['Enums']["ticket_status"];
                    "updated_at"?: string;
                };
                Update: {
                    "called_at"?: string | null;
                    "cancelled_at"?: string | null;
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "customer_key"?: string | null;
                    "customer_name"?: string;
                    "display_number"?: string;
                    "estimated_wait_seconds"?: number;
                    "id"?: string;
                    "joined_at"?: string;
                    "no_show_at"?: string | null;
                    "phone"?: string | null;
                    "public_token"?: string;
                    "queue_id"?: string;
                    "sequence_number"?: number;
                    "service_date"?: string;
                    "status"?: Database["public"]['Enums']["ticket_status"];
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "tickets_queue_id_fkey";
                        columns: [
                            "queue_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "queues";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "webhook_events": {
                Row: {
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "payload": NonNullable<Json>;
                    "processed_at": string | null;
                    "provider": string;
                    "provider_event_id": string;
                };
                Insert: {
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "payload": NonNullable<Json>;
                    "processed_at"?: string | null;
                    "provider": string;
                    "provider_event_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "payload"?: NonNullable<Json>;
                    "processed_at"?: string | null;
                    "provider"?: string;
                    "provider_event_id"?: string;
                };
                Relationships: [
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            "call_next_ticket": {
                Args: {
                    "p_queue_id": string;
                    "p_request_id": string;
                };
                Returns: {
                    "called_at": string;
                    "customer_name": string;
                    "display_number": string;
                    "outcome": string;
                    "replayed": boolean;
                    "ticket_id": string;
                    "ticket_status": Database["public"]['Enums']["ticket_status"];
                }[];
            };
            "cancel_public_ticket": {
                Args: {
                    "p_token": string;
                };
                Returns: Database["public"]['Enums']["ticket_status"];
            };
            "create_queue": {
                Args: {
                    "p_allow_phone": boolean;
                    "p_average_service_seconds": number;
                    "p_business_id": string;
                    "p_description": string;
                    "p_location_id": string;
                    "p_name": string;
                    "p_queue_id": string;
                    "p_require_phone": boolean;
                    "p_warning_threshold": number;
                };
                Returns: string;
            };
            "get_public_join_options": {
                Args: {
                    "p_slug": string;
                };
                Returns: {
                    "allow_phone": boolean;
                    "business_name": string;
                    "queue_name": string;
                    "require_phone": boolean;
                    "slug": string;
                    "status": Database["public"]['Enums']["queue_status"];
                }[];
            };
            "get_public_queue": {
                Args: {
                    "p_slug": string;
                };
                Returns: {
                    "business_logo_url": string;
                    "business_name": string;
                    "description": string;
                    "estimated_wait_seconds": number;
                    "has_serving_customer": boolean;
                    "location_name": string;
                    "queue_name": string;
                    "slug": string;
                    "status": Database["public"]['Enums']["queue_status"];
                    "waiting_count": number;
                }[];
            };
            "get_public_ticket": {
                Args: {
                    "p_token": string;
                };
                Returns: {
                    "business_name": string;
                    "display_number": string;
                    "estimated_wait_seconds": number;
                    "has_serving_customer": boolean;
                    "joined_at": string;
                    "location_active": boolean;
                    "location_name": string;
                    "location_timezone": string;
                    "people_ahead": number;
                    "queue_name": string;
                    "queue_slug": string;
                    "queue_status": Database["public"]['Enums']["queue_status"];
                    "status": Database["public"]['Enums']["ticket_status"];
                }[];
            };
            "get_public_ticket_receipt": {
                Args: {
                    "p_token": string;
                };
                Returns: {
                    "business_name": string;
                    "display_number": string;
                    "queue_name": string;
                    "status": Database["public"]['Enums']["ticket_status"];
                }[];
            };
            "join_public_queue": {
                Args: {
                    "p_customer_key": string;
                    "p_customer_name": string;
                    "p_phone": string;
                    "p_rate_key": string;
                    "p_request_id": string;
                    "p_slug": string;
                };
                Returns: string;
            };
            "onboard_business": {
                Args: {
                    "p_business_name": string;
                    "p_country_code": string;
                    "p_industry": string;
                    "p_location_address": string;
                    "p_location_name": string;
                    "p_timezone": string;
                };
                Returns: string;
            };
            "set_queue_status": {
                Args: {
                    "p_business_id": string;
                    "p_expected_revision": number;
                    "p_queue_id": string;
                    "p_status": Database["public"]['Enums']["queue_status"];
                };
                Returns: string;
            };
            "update_queue": {
                Args: {
                    "p_allow_phone": boolean;
                    "p_average_service_seconds": number;
                    "p_business_id": string;
                    "p_description": string;
                    "p_expected_revision": number;
                    "p_location_id": string;
                    "p_name": string;
                    "p_queue_id": string;
                    "p_require_phone": boolean;
                    "p_warning_threshold": number;
                };
                Returns: string;
            };
        };
        Enums: {
            "business_role": "owner" | "admin" | "staff";
            "notification_channel": "web_push" | "sms" | "whatsapp";
            "notification_status": "pending" | "sent" | "failed" | "skipped";
            "notification_type": "almost_your_turn" | "your_turn" | "queue_paused";
            "queue_status": "open" | "paused" | "closed";
            "subscription_plan": "FREE" | "STARTER" | "BUSINESS";
            "subscription_status": "pending" | "active" | "past_due" | "cancelled" | "expired";
            "ticket_actor_type": "customer" | "staff" | "system";
            "ticket_event_type": "joined" | "called" | "recalled" | "completed" | "no_show" | "cancelled";
            "ticket_status": "waiting" | "serving" | "completed" | "no_show" | "cancelled";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
    "public": {
        Enums: {
            "business_role": ["owner", "admin", "staff"], "notification_channel": ["web_push", "sms", "whatsapp"], "notification_status": ["pending", "sent", "failed", "skipped"], "notification_type": ["almost_your_turn", "your_turn", "queue_paused"], "queue_status": ["open", "paused", "closed"], "subscription_plan": ["FREE", "STARTER", "BUSINESS"], "subscription_status": ["pending", "active", "past_due", "cancelled", "expired"], "ticket_actor_type": ["customer", "staff", "system"], "ticket_event_type": ["joined", "called", "recalled", "completed", "no_show", "cancelled"], "ticket_status": ["waiting", "serving", "completed", "no_show", "cancelled"]
        }
    }
} as const;
