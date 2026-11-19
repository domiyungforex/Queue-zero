// Generated from migrations by npm run db:types. Do not edit manually.
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "booking_settings": {
                Row: {
                    "id": string;
                    "organization_id": string;
                    "queue_id": string | null;
                    "enabled": boolean;
                    "booking_type": string;
                    "operating_days": number[];
                    "opening_time": string;
                    "closing_time": string;
                    "slot_interval_minutes": number;
                    "max_capacity_per_slot": number;
                    "min_advance_minutes": number;
                    "max_advance_days": number;
                    "arrival_grace_minutes": number;
                    "allocation_mode": string;
                    "walkin_reserved_capacity": number;
                    "booking_priority_policy": string;
                    "cancellation_allowed": boolean;
                    "rescheduling_allowed": boolean;
                    "created_at": string;
                    "updated_at": string;
                };
                Insert: {
                    "id"?: string;
                    "organization_id": string;
                    "queue_id"?: string | null;
                    "enabled"?: boolean;
                    "booking_type"?: string;
                    "operating_days"?: number[];
                    "opening_time"?: string;
                    "closing_time"?: string;
                    "slot_interval_minutes"?: number;
                    "max_capacity_per_slot"?: number;
                    "min_advance_minutes"?: number;
                    "max_advance_days"?: number;
                    "arrival_grace_minutes"?: number;
                    "allocation_mode"?: string;
                    "walkin_reserved_capacity"?: number;
                    "booking_priority_policy"?: string;
                    "cancellation_allowed"?: boolean;
                    "rescheduling_allowed"?: boolean;
                    "created_at"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "id"?: string;
                    "organization_id"?: string;
                    "queue_id"?: string | null;
                    "enabled"?: boolean;
                    "booking_type"?: string;
                    "operating_days"?: number[];
                    "opening_time"?: string;
                    "closing_time"?: string;
                    "slot_interval_minutes"?: number;
                    "max_capacity_per_slot"?: number;
                    "min_advance_minutes"?: number;
                    "max_advance_days"?: number;
                    "arrival_grace_minutes"?: number;
                    "allocation_mode"?: string;
                    "walkin_reserved_capacity"?: number;
                    "booking_priority_policy"?: string;
                    "cancellation_allowed"?: boolean;
                    "rescheduling_allowed"?: boolean;
                    "created_at"?: string;
                    "updated_at"?: string;
                };
                Relationships: [];
            };
            "bookings": {
                Row: {
                    "id": string;
                    "organization_id": string;
                    "location_id": string;
                    "queue_id": string;
                    "service_id": string | null;
                    "customer_name": string;
                    "customer_phone": string;
                    "customer_email": string | null;
                    "booking_reference": string;
                    "management_token": string;
                    "booking_type": string;
                    "booking_date": string;
                    "start_time": string;
                    "end_time": string;
                    "starts_at": string;
                    "ends_at": string;
                    "timezone": string;
                    "status": string;
                    "checked_in_at": string | null;
                    "queue_ticket_id": string | null;
                    "cancellation_reason": string | null;
                    "cancelled_at": string | null;
                    "no_show_at": string | null;
                    "notes": string | null;
                    "created_at": string;
                    "updated_at": string;
                };
                Insert: {
                    "id"?: string;
                    "organization_id": string;
                    "location_id": string;
                    "queue_id": string;
                    "service_id"?: string | null;
                    "customer_name": string;
                    "customer_phone": string;
                    "customer_email"?: string | null;
                    "booking_reference": string;
                    "management_token"?: string;
                    "booking_type"?: string;
                    "booking_date": string;
                    "start_time": string;
                    "end_time": string;
                    "starts_at": string;
                    "ends_at": string;
                    "timezone"?: string;
                    "status"?: string;
                    "checked_in_at"?: string | null;
                    "queue_ticket_id"?: string | null;
                    "cancellation_reason"?: string | null;
                    "cancelled_at"?: string | null;
                    "no_show_at"?: string | null;
                    "notes"?: string | null;
                    "created_at"?: string;
                    "updated_at"?: string;
                };
                Update: {
                    "id"?: string;
                    "organization_id"?: string;
                    "location_id"?: string;
                    "queue_id"?: string;
                    "service_id"?: string | null;
                    "customer_name"?: string;
                    "customer_phone"?: string;
                    "customer_email"?: string | null;
                    "booking_reference"?: string;
                    "management_token"?: string;
                    "booking_type"?: string;
                    "booking_date"?: string;
                    "start_time"?: string;
                    "end_time"?: string;
                    "starts_at"?: string;
                    "ends_at"?: string;
                    "timezone"?: string;
                    "status"?: string;
                    "checked_in_at"?: string | null;
                    "queue_ticket_id"?: string | null;
                    "cancellation_reason"?: string | null;
                    "cancelled_at"?: string | null;
                    "no_show_at"?: string | null;
                    "notes"?: string | null;
                    "created_at"?: string;
                    "updated_at"?: string;
                };
                Relationships: [];
            };
            "booking_events": {
                Row: {
                    "id": string;
                    "organization_id": string;
                    "booking_id": string;
                    "event_type": string;
                    "actor_type": string;
                    "actor_id": string | null;
                    "payload": Json;
                    "created_at": string;
                };
                Insert: {
                    "id"?: string;
                    "organization_id": string;
                    "booking_id": string;
                    "event_type": string;
                    "actor_type": string;
                    "actor_id"?: string | null;
                    "payload"?: Json;
                    "created_at"?: string;
                };
                Update: {
                    "id"?: string;
                    "organization_id"?: string;
                    "booking_id"?: string;
                    "event_type"?: string;
                    "actor_type"?: string;
                    "actor_id"?: string | null;
                    "payload"?: Json;
                    "created_at"?: string;
                };
                Relationships: [];
            };
            "appointments": {
                Row: {
                    "created_at": string;
                    "guest_name": string | null;
                    "id": string;
                    "organization_id": string;
                    "scheduled_at": string;
                    "service_id": string;
                    "staff_id": string | null;
                    "status": string;
                    "unit_id": string;
                    "user_id": string | null;
                };
                Insert: {
                    "created_at"?: string;
                    "guest_name"?: string | null;
                    "id"?: string;
                    "organization_id": string;
                    "scheduled_at": string;
                    "service_id": string;
                    "staff_id"?: string | null;
                    "status"?: string;
                    "unit_id": string;
                    "user_id"?: string | null;
                };
                Update: {
                    "created_at"?: string;
                    "guest_name"?: string | null;
                    "id"?: string;
                    "organization_id"?: string;
                    "scheduled_at"?: string;
                    "service_id"?: string;
                    "staff_id"?: string | null;
                    "status"?: string;
                    "unit_id"?: string;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "appointments_service_id_organization_id_unit_id_fkey";
                        columns: [
                            "service_id",
                            "organization_id",
                            "unit_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "institution_services";
                        referencedColumns: [
                            "id",
                            "organization_id",
                            "unit_id"
                        ];
                    },
                    {
                        foreignKeyName: "appointments_staff_id_organization_id_fkey";
                        columns: [
                            "staff_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "business_members";
                        referencedColumns: [
                            "id",
                            "business_id"
                        ];
                    }
                ];
            };
            "attendance_device_uses": {
                Row: {
                    "class_session_id": string;
                    "created_at": string;
                    "device_hash": string;
                    "organization_id": string;
                    "student_id": string;
                };
                Insert: {
                    "class_session_id": string;
                    "created_at"?: string;
                    "device_hash": string;
                    "organization_id": string;
                    "student_id": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "created_at"?: string;
                    "device_hash"?: string;
                    "organization_id"?: string;
                    "student_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_device_uses_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_device_uses_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "attendance_flags": {
                Row: {
                    "class_session_id": string;
                    "created_at": string;
                    "id": string;
                    "organization_id": string;
                    "reason": string;
                    "resolution": string | null;
                    "resolved_at": string | null;
                    "resolved_by": string | null;
                    "student_id": string;
                };
                Insert: {
                    "class_session_id": string;
                    "created_at"?: string;
                    "id"?: string;
                    "organization_id": string;
                    "reason": string;
                    "resolution"?: string | null;
                    "resolved_at"?: string | null;
                    "resolved_by"?: string | null;
                    "student_id": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "organization_id"?: string;
                    "reason"?: string;
                    "resolution"?: string | null;
                    "resolved_at"?: string | null;
                    "resolved_by"?: string | null;
                    "student_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_flags_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_flags_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "attendance_qr_nonces": {
                Row: {
                    "class_session_id": string;
                    "created_at": string;
                    "expires_at": string;
                    "nonce": string;
                    "organization_id": string;
                };
                Insert: {
                    "class_session_id": string;
                    "created_at"?: string;
                    "expires_at": string;
                    "nonce": string;
                    "organization_id": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "nonce"?: string;
                    "organization_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_qr_nonces_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "attendance_records": {
                Row: {
                    "check_in_at": string | null;
                    "check_out_at": string | null;
                    "class_session_id": string;
                    "created_at": string;
                    "flag_reason": string | null;
                    "id": string;
                    "organization_id": string;
                    "risk_flags": (string)[];
                    "status": Database["public"]['Enums']["attendance_status"];
                    "student_id": string;
                    "submitted_matric_number": string | null;
                    "submitted_name": string | null;
                    "photo_url": string | null;
                    "location_lat": number | null;
                    "location_lng": number | null;
                    "location_accuracy_meters": number | null;
                    "location_verified": boolean;
                    "verification_mode": string;
                    "updated_at": string;
                    "verification_score": number | null;
                };
                Insert: {
                    "check_in_at"?: string | null;
                    "check_out_at"?: string | null;
                    "class_session_id": string;
                    "created_at"?: string;
                    "flag_reason"?: string | null;
                    "id"?: string;
                    "organization_id": string;
                    "risk_flags"?: (string)[];
                    "status": Database["public"]['Enums']["attendance_status"];
                    "student_id": string;
                    "submitted_matric_number"?: string | null;
                    "submitted_name"?: string | null;
                    "photo_url"?: string | null;
                    "location_lat"?: number | null;
                    "location_lng"?: number | null;
                    "location_accuracy_meters"?: number | null;
                    "location_verified"?: boolean;
                    "verification_mode"?: string;
                    "updated_at"?: string;
                    "verification_score"?: number | null;
                };
                Update: {
                    "check_in_at"?: string | null;
                    "check_out_at"?: string | null;
                    "class_session_id"?: string;
                    "created_at"?: string;
                    "flag_reason"?: string | null;
                    "id"?: string;
                    "organization_id"?: string;
                    "risk_flags"?: (string)[];
                    "status"?: Database["public"]['Enums']["attendance_status"];
                    "student_id"?: string;
                    "submitted_matric_number"?: string | null;
                    "submitted_name"?: string | null;
                    "photo_url"?: string | null;
                    "location_lat"?: number | null;
                    "location_lng"?: number | null;
                    "location_accuracy_meters"?: number | null;
                    "location_verified"?: boolean;
                    "verification_mode"?: string;
                    "updated_at"?: string;
                    "verification_score"?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_records_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_records_class_session_id_student_id_fkey";
                        columns: [
                            "class_session_id",
                            "student_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "class_roster";
                        referencedColumns: [
                            "class_session_id",
                            "student_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_records_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "attendance_scan_requests": {
                Row: {
                    "class_session_id": string;
                    "created_at": string;
                    "nonce": string;
                    "organization_id": string;
                    "request_id": string;
                    "result": NonNullable<Json>;
                    "student_id": string;
                };
                Insert: {
                    "class_session_id": string;
                    "created_at"?: string;
                    "nonce": string;
                    "organization_id": string;
                    "request_id": string;
                    "result": NonNullable<Json>;
                    "student_id": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "created_at"?: string;
                    "nonce"?: string;
                    "organization_id"?: string;
                    "request_id"?: string;
                    "result"?: NonNullable<Json>;
                    "student_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_scan_requests_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_scan_requests_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "attendance_submission_limits": {
                Row: {
                    "class_session_id": string;
                    "created_at": string;
                    "device_hash": string;
                    "id": number;
                    "matric_hash": string;
                    "network_hash": string;
                    "organization_id": string;
                    "outcome": string;
                };
                Insert: {
                    "class_session_id": string;
                    "created_at"?: string;
                    "device_hash": string;
                    "id"?: never;
                    "matric_hash": string;
                    "network_hash": string;
                    "organization_id": string;
                    "outcome": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "created_at"?: string;
                    "device_hash"?: string;
                    "id"?: never;
                    "matric_hash"?: string;
                    "network_hash"?: string;
                    "organization_id"?: string;
                    "outcome"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_submission_limits_class_session_id_organization_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_submission_limits_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "billing_checkouts": {
                Row: {
                    "amount": number;
                    "business_id": string;
                    "created_at": string;
                    "currency": string;
                    "plan": Database["public"]['Enums']["subscription_plan"];
                    "provider_plan_code": string;
                    "reference": string;
                    "status": string;
                    "verified_at": string | null;
                };
                Insert: {
                    "amount": number;
                    "business_id": string;
                    "created_at"?: string;
                    "currency": string;
                    "plan": Database["public"]['Enums']["subscription_plan"];
                    "provider_plan_code": string;
                    "reference": string;
                    "status"?: string;
                    "verified_at"?: string | null;
                };
                Update: {
                    "amount"?: number;
                    "business_id"?: string;
                    "created_at"?: string;
                    "currency"?: string;
                    "plan"?: Database["public"]['Enums']["subscription_plan"];
                    "provider_plan_code"?: string;
                    "reference"?: string;
                    "status"?: string;
                    "verified_at"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "billing_checkouts_business_id_fkey";
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
                    "attendance_security_mode": string;
                    "country_code": string;
                    "created_at": string;
                    "id": string;
                    "industry": string;
                    "institution_type": string | null;
                    "logo_url": string | null;
                    "name": string;
                    "onboarding_completed_at": string | null;
                    "onboarding_request_id": string | null;
                    "organization_mode": Database["public"]['Enums']["organization_mode"];
                    "organization_type": Database["public"]['Enums']["organization_type"] | null;
                    "owner_user_id": string;
                    "professional_category": Database["public"]['Enums']["professional_category"] | null;
                    "slug": string;
                    "subscription_tier": Database["public"]['Enums']["subscription_plan"];
                    "timezone": string;
                    "updated_at": string;
                    "workspace_ownership": Database["public"]['Enums']["workspace_ownership"];
                };
                Insert: {
                    "attendance_security_mode"?: string;
                    "country_code": string;
                    "created_at"?: string;
                    "id"?: string;
                    "industry": string;
                    "institution_type"?: string | null;
                    "logo_url"?: string | null;
                    "name": string;
                    "onboarding_completed_at"?: string | null;
                    "onboarding_request_id"?: string | null;
                    "organization_mode"?: Database["public"]['Enums']["organization_mode"];
                    "organization_type"?: Database["public"]['Enums']["organization_type"] | null;
                    "owner_user_id": string;
                    "professional_category"?: Database["public"]['Enums']["professional_category"] | null;
                    "slug": string;
                    "subscription_tier"?: Database["public"]['Enums']["subscription_plan"];
                    "timezone"?: string;
                    "updated_at"?: string;
                    "workspace_ownership"?: Database["public"]['Enums']["workspace_ownership"];
                };
                Update: {
                    "attendance_security_mode"?: string;
                    "country_code"?: string;
                    "created_at"?: string;
                    "id"?: string;
                    "industry"?: string;
                    "institution_type"?: string | null;
                    "logo_url"?: string | null;
                    "name"?: string;
                    "onboarding_completed_at"?: string | null;
                    "onboarding_request_id"?: string | null;
                    "organization_mode"?: Database["public"]['Enums']["organization_mode"];
                    "organization_type"?: Database["public"]['Enums']["organization_type"] | null;
                    "owner_user_id"?: string;
                    "professional_category"?: Database["public"]['Enums']["professional_category"] | null;
                    "slug"?: string;
                    "subscription_tier"?: Database["public"]['Enums']["subscription_plan"];
                    "timezone"?: string;
                    "updated_at"?: string;
                    "workspace_ownership"?: Database["public"]['Enums']["workspace_ownership"];
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
            "class_lecturers": {
                Row: {
                    "class_session_id": string;
                    "clerk_user_id": string;
                    "display_name": string;
                    "organization_id": string;
                };
                Insert: {
                    "class_session_id": string;
                    "clerk_user_id": string;
                    "display_name": string;
                    "organization_id": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "clerk_user_id"?: string;
                    "display_name"?: string;
                    "organization_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "class_lecturers_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "class_roster": {
                Row: {
                    "class_session_id": string;
                    "organization_id": string;
                    "student_id": string;
                };
                Insert: {
                    "class_session_id": string;
                    "organization_id": string;
                    "student_id": string;
                };
                Update: {
                    "class_session_id"?: string;
                    "organization_id"?: string;
                    "student_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "class_roster_class_session_id_organization_id_fkey";
                        columns: [
                            "class_session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "class_sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "class_roster_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "class_sessions": {
                Row: {
                    "arrival_open": boolean;
                    "attendance_closes_at": string | null;
                    "checkout_enabled": boolean;
                    "verification_mode": string;
                    "course_id": string;
                    "created_at": string;
                    "departure_required": boolean;
                    "id": string;
                    "late_after_minutes": number;
                    "opened_at": string | null;
                    "organization_id": string;
                    "planned_ends_at": string | null;
                    "qr_revoked_at": string | null;
                    "title": string | null;
                    "location_lat": number | null;
                    "location_lng": number | null;
                    "geofence_radius_meters": number | null;
                };
                Insert: {
                    "arrival_open"?: boolean;
                    "attendance_closes_at"?: string | null;
                    "checkout_enabled"?: boolean;
                    "verification_mode"?: string;
                    "course_id": string;
                    "created_at"?: string;
                    "departure_required"?: boolean;
                    "id": string;
                    "late_after_minutes"?: number;
                    "opened_at"?: string | null;
                    "organization_id": string;
                    "planned_ends_at"?: string | null;
                    "qr_revoked_at"?: string | null;
                    "title"?: string | null;
                    "location_lat"?: number | null;
                    "location_lng"?: number | null;
                    "geofence_radius_meters"?: number | null;
                };
                Update: {
                    "arrival_open"?: boolean;
                    "attendance_closes_at"?: string | null;
                    "checkout_enabled"?: boolean;
                    "verification_mode"?: string;
                    "course_id"?: string;
                    "created_at"?: string;
                    "departure_required"?: boolean;
                    "id"?: string;
                    "late_after_minutes"?: number;
                    "opened_at"?: string | null;
                    "organization_id"?: string;
                    "planned_ends_at"?: string | null;
                    "qr_revoked_at"?: string | null;
                    "title"?: string | null;
                    "location_lat"?: number | null;
                    "location_lng"?: number | null;
                    "geofence_radius_meters"?: number | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "class_sessions_course_id_organization_id_fkey";
                        columns: [
                            "course_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "courses";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "class_sessions_id_organization_id_fkey";
                        columns: [
                            "id",
                            "organization_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "course_lecturers": {
                Row: {
                    "clerk_user_id": string;
                    "course_id": string;
                    "display_name": string;
                    "organization_id": string;
                };
                Insert: {
                    "clerk_user_id": string;
                    "course_id": string;
                    "display_name": string;
                    "organization_id": string;
                };
                Update: {
                    "clerk_user_id"?: string;
                    "course_id"?: string;
                    "display_name"?: string;
                    "organization_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "course_lecturers_course_id_organization_id_fkey";
                        columns: [
                            "course_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "courses";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "course_lecturers_organization_id_clerk_user_id_fkey";
                        columns: [
                            "organization_id",
                            "clerk_user_id"
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
            "course_students": {
                Row: {
                    "course_id": string;
                    "created_at": string;
                    "organization_id": string;
                    "student_id": string;
                };
                Insert: {
                    "course_id": string;
                    "created_at"?: string;
                    "organization_id": string;
                    "student_id": string;
                };
                Update: {
                    "course_id"?: string;
                    "created_at"?: string;
                    "organization_id"?: string;
                    "student_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "course_students_course_id_organization_id_fkey";
                        columns: [
                            "course_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "courses";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "course_students_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "courses": {
                Row: {
                    "code": string;
                    "department_id": string;
                    "id": string;
                    "organization_id": string;
                    "title": string;
                    "unit_id": string | null;
                };
                Insert: {
                    "code": string;
                    "department_id": string;
                    "id"?: string;
                    "organization_id": string;
                    "title": string;
                    "unit_id"?: string | null;
                };
                Update: {
                    "code"?: string;
                    "department_id"?: string;
                    "id"?: string;
                    "organization_id"?: string;
                    "title"?: string;
                    "unit_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "courses_department_id_organization_id_fkey";
                        columns: [
                            "department_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "departments";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "courses_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "courses_unit_id_organization_id_fkey";
                        columns: [
                            "unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "departments": {
                Row: {
                    "faculty_id": string;
                    "id": string;
                    "name": string;
                    "organization_id": string;
                    "unit_id": string | null;
                };
                Insert: {
                    "faculty_id": string;
                    "id"?: string;
                    "name": string;
                    "organization_id": string;
                    "unit_id"?: string | null;
                };
                Update: {
                    "faculty_id"?: string;
                    "id"?: string;
                    "name"?: string;
                    "organization_id"?: string;
                    "unit_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "departments_faculty_id_organization_id_fkey";
                        columns: [
                            "faculty_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "faculties";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "departments_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "departments_unit_id_organization_id_fkey";
                        columns: [
                            "unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "faculties": {
                Row: {
                    "id": string;
                    "name": string;
                    "organization_id": string;
                    "unit_id": string | null;
                };
                Insert: {
                    "id"?: string;
                    "name": string;
                    "organization_id": string;
                    "unit_id"?: string | null;
                };
                Update: {
                    "id"?: string;
                    "name"?: string;
                    "organization_id"?: string;
                    "unit_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "faculties_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "faculties_unit_id_organization_id_fkey";
                        columns: [
                            "unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "institution_invitations": {
                Row: {
                    "accepted_at": string | null;
                    "accepted_by": string | null;
                    "created_at": string;
                    "delivered_at": string | null;
                    "delivery_attempts": number;
                    "delivery_lease_until": string | null;
                    "email": string;
                    "expires_at": string;
                    "id": string;
                    "invited_by": string;
                    "organization_id": string;
                    "permissions": (string)[];
                    "provider_id": string | null;
                    "revoked_at": string | null;
                    "role": string;
                    "staff_title": string | null;
                    "token_hash": string;
                    "unit_id": string;
                };
                Insert: {
                    "accepted_at"?: string | null;
                    "accepted_by"?: string | null;
                    "created_at"?: string;
                    "delivered_at"?: string | null;
                    "delivery_attempts"?: number;
                    "delivery_lease_until"?: string | null;
                    "email": string;
                    "expires_at"?: string;
                    "id"?: string;
                    "invited_by": string;
                    "organization_id": string;
                    "permissions": (string)[];
                    "provider_id"?: string | null;
                    "revoked_at"?: string | null;
                    "role": string;
                    "staff_title"?: string | null;
                    "token_hash": string;
                    "unit_id": string;
                };
                Update: {
                    "accepted_at"?: string | null;
                    "accepted_by"?: string | null;
                    "created_at"?: string;
                    "delivered_at"?: string | null;
                    "delivery_attempts"?: number;
                    "delivery_lease_until"?: string | null;
                    "email"?: string;
                    "expires_at"?: string;
                    "id"?: string;
                    "invited_by"?: string;
                    "organization_id"?: string;
                    "permissions"?: (string)[];
                    "provider_id"?: string | null;
                    "revoked_at"?: string | null;
                    "role"?: string;
                    "staff_title"?: string | null;
                    "token_hash"?: string;
                    "unit_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "institution_invitations_unit_id_organization_id_fkey";
                        columns: [
                            "unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "institution_services": {
                Row: {
                    "created_at": string;
                    "id": string;
                    "kind": string;
                    "name": string;
                    "organization_id": string;
                    "queue_id": string | null;
                    "unit_id": string;
                };
                Insert: {
                    "created_at"?: string;
                    "id"?: string;
                    "kind": string;
                    "name": string;
                    "organization_id": string;
                    "queue_id"?: string | null;
                    "unit_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "name"?: string;
                    "organization_id"?: string;
                    "queue_id"?: string | null;
                    "unit_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "institution_services_queue_id_fkey";
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
                        foreignKeyName: "institution_services_unit_id_organization_id_fkey";
                        columns: [
                            "unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
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
                    "attempts": number;
                    "channel": Database["public"]['Enums']["notification_channel"];
                    "created_at": string;
                    "deduplication_key": string;
                    "error_message": string | null;
                    "id": string;
                    "lease_token": string | null;
                    "lease_until": string | null;
                    "next_attempt_at": string;
                    "provider_reference": string | null;
                    "sent_at": string | null;
                    "status": Database["public"]['Enums']["notification_status"];
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["notification_type"];
                };
                Insert: {
                    "attempts"?: number;
                    "channel": Database["public"]['Enums']["notification_channel"];
                    "created_at"?: string;
                    "deduplication_key": string;
                    "error_message"?: string | null;
                    "id"?: string;
                    "lease_token"?: string | null;
                    "lease_until"?: string | null;
                    "next_attempt_at"?: string;
                    "provider_reference"?: string | null;
                    "sent_at"?: string | null;
                    "status"?: Database["public"]['Enums']["notification_status"];
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["notification_type"];
                };
                Update: {
                    "attempts"?: number;
                    "channel"?: Database["public"]['Enums']["notification_channel"];
                    "created_at"?: string;
                    "deduplication_key"?: string;
                    "error_message"?: string | null;
                    "id"?: string;
                    "lease_token"?: string | null;
                    "lease_until"?: string | null;
                    "next_attempt_at"?: string;
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
            "organization_units": {
                Row: {
                    "created_at": string;
                    "id": string;
                    "name": string;
                    "organization_id": string;
                    "parent_unit_id": string | null;
                    "slug": string;
                    "status": string;
                    "type": string;
                    "updated_at": string;
                };
                Insert: {
                    "created_at"?: string;
                    "id"?: string;
                    "name": string;
                    "organization_id": string;
                    "parent_unit_id"?: string | null;
                    "slug": string;
                    "status"?: string;
                    "type": string;
                    "updated_at"?: string;
                };
                Update: {
                    "created_at"?: string;
                    "id"?: string;
                    "name"?: string;
                    "organization_id"?: string;
                    "parent_unit_id"?: string | null;
                    "slug"?: string;
                    "status"?: string;
                    "type"?: string;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "organization_units_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "organization_units_parent_unit_id_organization_id_fkey";
                        columns: [
                            "parent_unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "organization_workspace_profiles": {
                Row: {
                    "authorized_representative_name": string | null;
                    "business_id": string;
                    "created_at": string;
                    "legal_name": string;
                    "organization_subtype": string;
                    "organization_type": Database["public"]['Enums']["organization_type"];
                    "service_templates": (string)[];
                    "setup_completed_at": string;
                    "updated_at": string;
                    "verification_status": Database["public"]['Enums']["organization_verification_status"];
                };
                Insert: {
                    "authorized_representative_name"?: string | null;
                    "business_id": string;
                    "created_at"?: string;
                    "legal_name": string;
                    "organization_subtype": string;
                    "organization_type": Database["public"]['Enums']["organization_type"];
                    "service_templates"?: (string)[];
                    "setup_completed_at"?: string;
                    "updated_at"?: string;
                    "verification_status"?: Database["public"]['Enums']["organization_verification_status"];
                };
                Update: {
                    "authorized_representative_name"?: string | null;
                    "business_id"?: string;
                    "created_at"?: string;
                    "legal_name"?: string;
                    "organization_subtype"?: string;
                    "organization_type"?: Database["public"]['Enums']["organization_type"];
                    "service_templates"?: (string)[];
                    "setup_completed_at"?: string;
                    "updated_at"?: string;
                    "verification_status"?: Database["public"]['Enums']["organization_verification_status"];
                };
                Relationships: [
                    {
                        foreignKeyName: "organization_workspace_profil_business_id_organization_typ_fkey";
                        columns: [
                            "business_id",
                            "organization_type"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id",
                            "organization_type"
                        ];
                    }
                ];
            };
            "people": {
                Row: {
                    "clerk_user_id": string | null;
                    "created_at": string;
                    "email": string | null;
                    "full_name": string;
                    "id": string;
                    "organization_id": string;
                    "type": Database["public"]['Enums']["person_type"];
                    "updated_at": string;
                };
                Insert: {
                    "clerk_user_id"?: string | null;
                    "created_at"?: string;
                    "email"?: string | null;
                    "full_name": string;
                    "id"?: string;
                    "organization_id": string;
                    "type": Database["public"]['Enums']["person_type"];
                    "updated_at"?: string;
                };
                Update: {
                    "clerk_user_id"?: string | null;
                    "created_at"?: string;
                    "email"?: string | null;
                    "full_name"?: string;
                    "id"?: string;
                    "organization_id"?: string;
                    "type"?: Database["public"]['Enums']["person_type"];
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "people_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "presence_events": {
                Row: {
                    "actor_id": string | null;
                    "actor_type": string;
                    "created_at": string;
                    "event_type": string;
                    "id": string;
                    "metadata": NonNullable<Json>;
                    "occurred_at": string;
                    "organization_id": string;
                    "session_id": string;
                    "subject_id": string | null;
                };
                Insert: {
                    "actor_id"?: string | null;
                    "actor_type": string;
                    "created_at"?: string;
                    "event_type": string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "occurred_at"?: string;
                    "organization_id": string;
                    "session_id": string;
                    "subject_id"?: string | null;
                };
                Update: {
                    "actor_id"?: string | null;
                    "actor_type"?: string;
                    "created_at"?: string;
                    "event_type"?: string;
                    "id"?: string;
                    "metadata"?: NonNullable<Json>;
                    "occurred_at"?: string;
                    "organization_id"?: string;
                    "session_id"?: string;
                    "subject_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "presence_events_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "presence_events_session_id_organization_id_fkey";
                        columns: [
                            "session_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "sessions";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "professional_workspace_profiles": {
                Row: {
                    "business_id": string;
                    "created_at": string;
                    "institution_name": string | null;
                    "practice_location_id": string | null;
                    "professional_category": Database["public"]['Enums']["professional_category"];
                    "service_name": string | null;
                    "teaching_level": string | null;
                    "updated_at": string;
                };
                Insert: {
                    "business_id": string;
                    "created_at"?: string;
                    "institution_name"?: string | null;
                    "practice_location_id"?: string | null;
                    "professional_category": Database["public"]['Enums']["professional_category"];
                    "service_name"?: string | null;
                    "teaching_level"?: string | null;
                    "updated_at"?: string;
                };
                Update: {
                    "business_id"?: string;
                    "created_at"?: string;
                    "institution_name"?: string | null;
                    "practice_location_id"?: string | null;
                    "professional_category"?: Database["public"]['Enums']["professional_category"];
                    "service_name"?: string | null;
                    "teaching_level"?: string | null;
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "professional_workspace_profil_business_id_professional_cat_fkey";
                        columns: [
                            "business_id",
                            "professional_category"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id",
                            "professional_category"
                        ];
                    },
                    {
                        foreignKeyName: "professional_workspace_profil_practice_location_id_busines_fkey";
                        columns: [
                            "practice_location_id",
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
            "queue_operation_requests": {
                Row: {
                    "actor_user_id": string;
                    "created_at": string;
                    "operation": string;
                    "queue_id": string;
                    "request_id": string;
                    "result": NonNullable<Json>;
                    "ticket_id": string | null;
                };
                Insert: {
                    "actor_user_id": string;
                    "created_at"?: string;
                    "operation": string;
                    "queue_id": string;
                    "request_id": string;
                    "result": NonNullable<Json>;
                    "ticket_id"?: string | null;
                };
                Update: {
                    "actor_user_id"?: string;
                    "created_at"?: string;
                    "operation"?: string;
                    "queue_id"?: string;
                    "request_id"?: string;
                    "result"?: NonNullable<Json>;
                    "ticket_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "queue_operation_requests_queue_id_fkey";
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
                        foreignKeyName: "queue_operation_requests_ticket_id_queue_id_fkey";
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
                    "capacity": number | null;
                    "closes_at": string | null;
                    "created_at": string;
                    "description": string | null;
                    "id": string;
                    "location_id": string;
                    "name": string;
                    "opens_at": string | null;
                    "require_phone": boolean;
                    "revision": number;
                    "service_name": string;
                    "session_id": string | null;
                    "slug": string;
                    "status": Database["public"]['Enums']["queue_status"];
                    "unit_id": string | null;
                    "updated_at": string;
                    "warning_threshold": number;
                };
                Insert: {
                    "allow_phone"?: boolean;
                    "average_service_seconds"?: number;
                    "business_id": string;
                    "capacity"?: number | null;
                    "closes_at"?: string | null;
                    "created_at"?: string;
                    "description"?: string | null;
                    "id"?: string;
                    "location_id": string;
                    "name": string;
                    "opens_at"?: string | null;
                    "require_phone"?: boolean;
                    "revision"?: number;
                    "service_name": string;
                    "session_id"?: string | null;
                    "slug": string;
                    "status"?: Database["public"]['Enums']["queue_status"];
                    "unit_id"?: string | null;
                    "updated_at"?: string;
                    "warning_threshold"?: number;
                };
                Update: {
                    "allow_phone"?: boolean;
                    "average_service_seconds"?: number;
                    "business_id"?: string;
                    "capacity"?: number | null;
                    "closes_at"?: string | null;
                    "created_at"?: string;
                    "description"?: string | null;
                    "id"?: string;
                    "location_id"?: string;
                    "name"?: string;
                    "opens_at"?: string | null;
                    "require_phone"?: boolean;
                    "revision"?: number;
                    "service_name"?: string;
                    "session_id"?: string | null;
                    "slug"?: string;
                    "status"?: Database["public"]['Enums']["queue_status"];
                    "unit_id"?: string | null;
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
                    },
                    {
                        foreignKeyName: "queues_session_id_fkey";
                        columns: [
                            "session_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "sessions";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "queues_unit_id_business_id_fkey";
                        columns: [
                            "unit_id",
                            "business_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "registered_devices": {
                Row: {
                    "device_hash": string;
                    "first_seen_at": string;
                    "id": string;
                    "last_seen_at": string;
                    "organization_id": string;
                    "student_id": string;
                };
                Insert: {
                    "device_hash": string;
                    "first_seen_at"?: string;
                    "id"?: string;
                    "last_seen_at"?: string;
                    "organization_id": string;
                    "student_id": string;
                };
                Update: {
                    "device_hash"?: string;
                    "first_seen_at"?: string;
                    "id"?: string;
                    "last_seen_at"?: string;
                    "organization_id"?: string;
                    "student_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "registered_devices_student_id_organization_id_fkey";
                        columns: [
                            "student_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "school_profiles";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    }
                ];
            };
            "school_profiles": {
                Row: {
                    "created_at": string;
                    "department_id": string;
                    "id": string;
                    "level": string;
                    "matric_number": string;
                    "organization_id": string;
                    "programme": string | null;
                };
                Insert: {
                    "created_at"?: string;
                    "department_id": string;
                    "id": string;
                    "level": string;
                    "matric_number": string;
                    "organization_id": string;
                    "programme"?: string | null;
                };
                Update: {
                    "created_at"?: string;
                    "department_id"?: string;
                    "id"?: string;
                    "level"?: string;
                    "matric_number"?: string;
                    "organization_id"?: string;
                    "programme"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "school_profiles_department_id_organization_id_fkey";
                        columns: [
                            "department_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "departments";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "school_profiles_id_organization_id_fkey";
                        columns: [
                            "id",
                            "organization_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "people";
                        referencedColumns: [
                            "id",
                            "organization_id"
                        ];
                    },
                    {
                        foreignKeyName: "school_profiles_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "sessions": {
                Row: {
                    "created_at": string;
                    "created_by": string | null;
                    "ends_at": string | null;
                    "id": string;
                    "location_id": string | null;
                    "organization_id": string;
                    "starts_at": string | null;
                    "status": Database["public"]['Enums']["session_status"];
                    "type": Database["public"]['Enums']["session_type"];
                    "updated_at": string;
                };
                Insert: {
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "ends_at"?: string | null;
                    "id"?: string;
                    "location_id"?: string | null;
                    "organization_id": string;
                    "starts_at"?: string | null;
                    "status"?: Database["public"]['Enums']["session_status"];
                    "type": Database["public"]['Enums']["session_type"];
                    "updated_at"?: string;
                };
                Update: {
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "ends_at"?: string | null;
                    "id"?: string;
                    "location_id"?: string | null;
                    "organization_id"?: string;
                    "starts_at"?: string | null;
                    "status"?: Database["public"]['Enums']["session_status"];
                    "type"?: Database["public"]['Enums']["session_type"];
                    "updated_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "sessions_location_id_organization_id_fkey";
                        columns: [
                            "location_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "locations";
                        referencedColumns: [
                            "id",
                            "business_id"
                        ];
                    },
                    {
                        foreignKeyName: "sessions_organization_id_fkey";
                        columns: [
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "businesses";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "site_inquiries": {
                Row: {
                    "created_at": string;
                    "email": string;
                    "id": string;
                    "message": string;
                    "name": string;
                    "request_id": string;
                    "source_hash": string;
                };
                Insert: {
                    "created_at"?: string;
                    "email": string;
                    "id"?: string;
                    "message": string;
                    "name": string;
                    "request_id": string;
                    "source_hash": string;
                };
                Update: {
                    "created_at"?: string;
                    "email"?: string;
                    "id"?: string;
                    "message"?: string;
                    "name"?: string;
                    "request_id"?: string;
                    "source_hash"?: string;
                };
                Relationships: [
                ];
            };
            "subscriptions": {
                Row: {
                    "business_id": string;
                    "created_at": string;
                    "current_period_end": string | null;
                    "id": string;
                    "last_event_at": string | null;
                    "plan": Database["public"]['Enums']["subscription_plan"];
                    "provider": string;
                    "provider_customer_code": string | null;
                    "provider_plan_code": string | null;
                    "provider_subscription_code": string | null;
                    "status": Database["public"]['Enums']["subscription_status"];
                    "updated_at": string;
                };
                Insert: {
                    "business_id": string;
                    "created_at"?: string;
                    "current_period_end"?: string | null;
                    "id"?: string;
                    "last_event_at"?: string | null;
                    "plan"?: Database["public"]['Enums']["subscription_plan"];
                    "provider"?: string;
                    "provider_customer_code"?: string | null;
                    "provider_plan_code"?: string | null;
                    "provider_subscription_code"?: string | null;
                    "status"?: Database["public"]['Enums']["subscription_status"];
                    "updated_at"?: string;
                };
                Update: {
                    "business_id"?: string;
                    "created_at"?: string;
                    "current_period_end"?: string | null;
                    "id"?: string;
                    "last_event_at"?: string | null;
                    "plan"?: Database["public"]['Enums']["subscription_plan"];
                    "provider"?: string;
                    "provider_customer_code"?: string | null;
                    "provider_plan_code"?: string | null;
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
            "unit_memberships": {
                Row: {
                    "created_at": string;
                    "member_id": string;
                    "organization_id": string;
                    "permissions": (string)[];
                    "role": string;
                    "staff_title": string | null;
                    "unit_id": string;
                };
                Insert: {
                    "created_at"?: string;
                    "member_id": string;
                    "organization_id": string;
                    "permissions"?: (string)[];
                    "role": string;
                    "staff_title"?: string | null;
                    "unit_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "member_id"?: string;
                    "organization_id"?: string;
                    "permissions"?: (string)[];
                    "role"?: string;
                    "staff_title"?: string | null;
                    "unit_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "unit_memberships_member_id_organization_id_fkey";
                        columns: [
                            "member_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "business_members";
                        referencedColumns: [
                            "id",
                            "business_id"
                        ];
                    },
                    {
                        foreignKeyName: "unit_memberships_unit_id_organization_id_fkey";
                        columns: [
                            "unit_id",
                            "organization_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "organization_units";
                        referencedColumns: [
                            "id",
                            "organization_id"
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
            "workspace_notification_reads": {
                Row: {
                    "clerk_user_id": string;
                    "notification_id": string;
                    "read_at": string;
                };
                Insert: {
                    "clerk_user_id": string;
                    "notification_id": string;
                    "read_at"?: string;
                };
                Update: {
                    "clerk_user_id"?: string;
                    "notification_id"?: string;
                    "read_at"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "workspace_notification_reads_notification_id_fkey";
                        columns: [
                            "notification_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "workspace_notifications";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "workspace_notifications": {
                Row: {
                    "business_id": string;
                    "created_at": string;
                    "href": string | null;
                    "id": string;
                    "message": string;
                    "source_event_id": string;
                    "title": string;
                    "type": string;
                };
                Insert: {
                    "business_id": string;
                    "created_at"?: string;
                    "href"?: string | null;
                    "id"?: string;
                    "message": string;
                    "source_event_id": string;
                    "title": string;
                    "type": string;
                };
                Update: {
                    "business_id"?: string;
                    "created_at"?: string;
                    "href"?: string | null;
                    "id"?: string;
                    "message"?: string;
                    "source_event_id"?: string;
                    "title"?: string;
                    "type"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "workspace_notifications_business_id_fkey";
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
                        foreignKeyName: "workspace_notifications_source_event_id_fkey";
                        columns: [
                            "source_event_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "business_events";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            "get_public_booking_info": {
                Args: {
                    "p_slug": string;
                };
                Returns: Json;
            };
            "get_booking_availability": {
                Args: {
                    "p_slug": string;
                    "p_date": string;
                };
                Returns: Json;
            };
            "book_time_atomic": {
                Args: {
                    "p_slug": string;
                    "p_date": string;
                    "p_start_time": string;
                    "p_customer_name": string;
                    "p_phone": string;
                    "p_email"?: string | null;
                    "p_request_id"?: string;
                };
                Returns: Json;
            };
            "get_public_booking": {
                Args: {
                    "p_token": string;
                };
                Returns: Json;
            };
            "check_in_booking_atomic": {
                Args: {
                    "p_token": string;
                    "p_actor_type"?: string;
                    "p_actor_id"?: string | null;
                };
                Returns: Json;
            };
            "cancel_booking_atomic": {
                Args: {
                    "p_token": string;
                    "p_reason"?: string | null;
                    "p_actor_type"?: string;
                    "p_actor_id"?: string | null;
                };
                Returns: Json;
            };
            "reschedule_booking_atomic": {
                Args: {
                    "p_token": string;
                    "p_new_date": string;
                    "p_new_start_time": string;
                    "p_actor_type"?: string;
                    "p_actor_id"?: string | null;
                };
                Returns: Json;
            };
            "get_staff_bookings": {
                Args: {
                    "p_business_id": string;
                    "p_date"?: string | null;
                    "p_queue_id"?: string | null;
                    "p_status"?: string | null;
                    "p_search"?: string | null;
                    "p_limit"?: number;
                    "p_offset"?: number;
                };
                Returns: Json;
            };
            "get_booking_metrics": {
                Args: {
                    "p_business_id": string;
                    "p_date"?: string | null;
                };
                Returns: Json;
            };
            "business_metrics": {
                Args: {
                    "p_business_id": string;
                    "p_days"?: number;
                };
                Returns: Json;
            };
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
            "claim_notifications": {
                Args: {
                    "p_limit"?: number;
                };
                Returns: {
                    "attempts": number;
                    "channel": Database["public"]['Enums']["notification_channel"];
                    "created_at": string;
                    "deduplication_key": string;
                    "error_message": string | null;
                    "id": string;
                    "lease_token": string | null;
                    "lease_until": string | null;
                    "next_attempt_at": string;
                    "provider_reference": string | null;
                    "sent_at": string | null;
                    "status": Database["public"]['Enums']["notification_status"];
                    "ticket_id": string;
                    "type": Database["public"]['Enums']["notification_type"];
                }[];
                SetofOptions: {
                    from: "*";
                    to: "notifications";
                    isOneToOne: false;
                    isSetofReturn: true;
                };
            };
            "confirm_checkout": {
                Args: {
                    "p_customer_code": string;
                    "p_event_id": string;
                    "p_paid_at": string;
                    "p_period_end": string;
                    "p_reference": string;
                    "p_subscription_code": string;
                };
                Returns: undefined;
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
            "create_queue_v2": {
                Args: {
                    "p_allow_phone": boolean;
                    "p_average_service_seconds": number;
                    "p_business_id": string;
                    "p_capacity": number | null;
                    "p_closes_at": string | null;
                    "p_description": string;
                    "p_location_id": string;
                    "p_name": string;
                    "p_opens_at": string | null;
                    "p_queue_id": string;
                    "p_require_phone": boolean;
                    "p_service_name": string;
                    "p_status": Database["public"]['Enums']["queue_status"];
                    "p_warning_threshold": number;
                };
                Returns: string;
            };
            "create_unit_queue": {
                Args: {
                    "p_allow_phone": boolean;
                    "p_average_service_seconds": number;
                    "p_business_id": string;
                    "p_description": string;
                    "p_location_id": string;
                    "p_name": string;
                    "p_queue_id": string;
                    "p_require_phone": boolean;
                    "p_unit_id": string;
                    "p_warning_threshold": number;
                };
                Returns: string;
            };
            "create_unit_queue_v2": {
                Args: {
                    "p_allow_phone": boolean;
                    "p_average_service_seconds": number;
                    "p_business_id": string;
                    "p_capacity": number | null;
                    "p_closes_at": string | null;
                    "p_description": string;
                    "p_location_id": string;
                    "p_name": string;
                    "p_opens_at": string | null;
                    "p_queue_id": string;
                    "p_require_phone": boolean;
                    "p_service_name": string;
                    "p_status": Database["public"]['Enums']["queue_status"];
                    "p_unit_id": string;
                    "p_warning_threshold": number;
                };
                Returns: string;
            };
            "get_public_display": {
                Args: {
                    "p_slug": string;
                };
                Returns: Json;
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
            "get_public_join_options_v2": {
                Args: {
                    "p_slug": string;
                };
                Returns: {
                    "allow_phone": boolean;
                    "business_name": string;
                    "is_full": boolean;
                    "queue_name": string;
                    "require_phone": boolean;
                    "service_name": string;
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
                    "description": string | null;
                    "estimated_wait_seconds": number | null;
                    "has_serving_customer": boolean;
                    "location_name": string;
                    "queue_name": string;
                    "slug": string;
                    "status": Database["public"]['Enums']["queue_status"];
                    "waiting_count": number;
                }[];
            };
            "get_public_queue_v2": {
                Args: {
                    "p_slug": string;
                };
                Returns: {
                    "business_logo_url": string;
                    "business_name": string;
                    "description": string;
                    "estimated_wait_seconds": number;
                    "has_serving_customer": boolean;
                    "is_full": boolean;
                    "location_name": string;
                    "queue_name": string;
                    "service_name": string;
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
                    "warning_threshold": number;
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
            "get_queue_console": {
                Args: {
                    "p_queue_id": string;
                };
                Returns: Json;
            };
            "institution_accept_invitation": {
                Args: {
                    "p_token_hash": string;
                    "p_user_id": string;
                    "p_verified_email": string;
                };
                Returns: string;
            };
            "institution_claim_invitation_delivery": {
                Args: {
                    "p_limit"?: number;
                };
                Returns: {
                    "email": string;
                    "id": string;
                }[];
            };
            "institution_finish_invitation_delivery": {
                Args: {
                    "p_invitation_id": string;
                    "p_provider_id"?: string;
                    "p_success": boolean;
                };
                Returns: undefined;
            };
            "institution_has_permission": {
                Args: {
                    "p_organization_id": string;
                    "p_permission": string;
                    "p_unit_id": string;
                };
                Returns: boolean;
            };
            "institution_invite": {
                Args: {
                    "p_email": string;
                    "p_organization_id": string;
                    "p_permissions": (string)[];
                    "p_request_id": string;
                    "p_role": string;
                    "p_staff_title": string;
                    "p_token_hash": string;
                    "p_unit_id": string;
                };
                Returns: string;
            };
            "institution_invite_batch": {
                Args: {
                    "p_invitations": Json;
                    "p_organization_id": string;
                };
                Returns: Json;
            };
            "institution_manage": {
                Args: {
                    "p_action": string;
                    "p_payload": Json;
                };
                Returns: Json;
            };
            "institution_revoke_invitation": {
                Args: {
                    "p_invitation_id": string;
                };
                Returns: undefined;
            };
            "institution_setup": {
                Args: {
                    "p_organization_id": string;
                    "p_type": string;
                };
                Returns: undefined;
            };
            "institution_snapshot": {
                Args: {
                    "p_organization_id": string;
                    "p_unit_id"?: string;
                };
                Returns: Json;
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
            "join_public_queue_v2": {
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
            "mark_workspace_notifications_read": {
                Args: {
                    "p_business_id": string;
                    "p_notification_id"?: string;
                };
                Returns: number;
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
            "onboard_institution": {
                Args: {
                    "p_business_name": string;
                    "p_country_code": string;
                    "p_industry": string;
                    "p_institution_type": string;
                    "p_location_address": string;
                    "p_location_name": string;
                    "p_mode": Database["public"]['Enums']["organization_mode"];
                    "p_timezone": string;
                };
                Returns: string;
            };
            "onboard_organization": {
                Args: {
                    "p_business_name": string;
                    "p_country_code": string;
                    "p_industry": string;
                    "p_location_address": string;
                    "p_location_name": string;
                    "p_mode": Database["public"]['Enums']["organization_mode"];
                    "p_timezone": string;
                };
                Returns: string;
            };
            "onboard_organization_workspace": {
                Args: {
                    "p_country_code": string;
                    "p_location_address": string;
                    "p_location_name": string;
                    "p_organization_type": Database["public"]['Enums']["organization_type"];
                    "p_request_id": string;
                    "p_timezone": string;
                    "p_workspace_name": string;
                };
                Returns: string;
            };
            "onboard_organization_workspace_v2": {
                Args: {
                    "p_authorized_representative_name": string;
                    "p_country_code": string;
                    "p_legal_name": string;
                    "p_location_address": string;
                    "p_location_name": string;
                    "p_organization_subtype": string;
                    "p_organization_type": Database["public"]['Enums']["organization_type"];
                    "p_request_id": string;
                    "p_service_templates": (string)[];
                    "p_timezone": string;
                    "p_workspace_name": string;
                };
                Returns: string;
            };
            "onboard_professional_workspace": {
                Args: {
                    "p_country_code": string;
                    "p_professional_category": Database["public"]['Enums']["professional_category"];
                    "p_timezone": string;
                    "p_workspace_name": string;
                };
                Returns: string;
            };
            "onboard_professional_workspace_v2": {
                Args: {
                    "p_country_code": string;
                    "p_institution_name"?: string;
                    "p_location_address"?: string;
                    "p_location_name"?: string;
                    "p_professional_category": Database["public"]['Enums']["professional_category"];
                    "p_service_name"?: string;
                    "p_teaching_level"?: string;
                    "p_timezone": string;
                    "p_workspace_name": string;
                };
                Returns: string;
            };
            "operate_queue": {
                Args: {
                    "p_queue_id": string;
                    "p_request_id": string;
                    "p_status": Database["public"]['Enums']["queue_status"];
                };
                Returns: Json;
            };
            "operate_ticket": {
                Args: {
                    "p_operation": string;
                    "p_queue_id": string;
                    "p_request_id": string;
                    "p_ticket_id": string;
                };
                Returns: Json;
            };
            "queuezero_receive_queue_topic": {
                Args: {
                    "p_topic": string;
                };
                Returns: boolean;
            };
            "queuezero_receive_topic": {
                Args: {
                    "p_topic": string;
                };
                Returns: boolean;
            };
            "register_ticket_push": {
                Args: {
                    "p_auth": string;
                    "p_endpoint": string;
                    "p_p256dh": string;
                    "p_token": string;
                };
                Returns: undefined;
            };
            "save_business": {
                Args: {
                    "p_business_id": string;
                    "p_industry": string;
                    "p_name": string;
                    "p_timezone": string;
                };
                Returns: string;
            };
            "save_location": {
                Args: {
                    "p_active": boolean;
                    "p_address": string;
                    "p_business_id": string;
                    "p_location_id": string;
                    "p_name": string;
                    "p_timezone": string;
                };
                Returns: string;
            };
            "save_staff": {
                Args: {
                    "p_business_id": string;
                    "p_queue_ids": (string)[];
                    "p_remove"?: boolean;
                    "p_role": Database["public"]['Enums']["business_role"];
                    "p_user_id": string;
                };
                Returns: string;
            };
            "school_attend_accountless": {
                Args: {
                    "p_class_id": string;
                    "p_device_hash": string;
                    "p_full_name": string;
                    "p_matric_number": string;
                    "p_network_hash": string;
                    "p_nonce": string;
                    "p_organization_id": string;
                    "p_request_id": string;
                    "p_photo_url"?: string | null;
                    "p_location_lat"?: number | null;
                    "p_location_lng"?: number | null;
                    "p_location_accuracy_meters"?: number | null;
                    "p_location_captured_at"?: string | null;
                };
                Returns: Json;
            };
            "school_claim_student": {
                Args: {
                    "p_organization_id": string;
                    "p_user_id": string;
                    "p_verified_email": string;
                };
                Returns: Json;
            };
            "school_create_accountless_class": {
                Args: {
                    "p_attendance_closes_at": string;
                    "p_course_id": string;
                    "p_late_after_minutes": number;
                    "p_organization_id": string;
                    "p_planned_ends_at": string;
                    "p_starts_at": string;
                    "p_verification_mode"?: string;
                    "p_title"?: string | null;
                    "p_location_lat"?: number | null;
                    "p_location_lng"?: number | null;
                    "p_geofence_radius_meters"?: number | null;
                };
                Returns: Json;
            };
            "school_student_lookup": {
                Args: {
                    "p_class_id": string;
                    "p_matric_number": string;
                    "p_organization_id": string;
                };
                Returns: Json;
            };
            "school_import_roster": {
                Args: {
                    "p_course_id": string;
                    "p_organization_id": string;
                    "p_students": Json;
                };
                Returns: Json;
            };
            "school_issue_qr": {
                Args: {
                    "p_class_id": string;
                    "p_expires_at": string;
                    "p_nonce": string;
                };
                Returns: Json;
            };
            "school_manage": {
                Args: {
                    "p_action": string;
                    "p_payload": Json;
                };
                Returns: Json;
            };
            "school_public_class": {
                Args: {
                    "p_class_id": string;
                    "p_nonce": string;
                    "p_organization_id": string;
                };
                Returns: Json;
            };
            "school_replay": {
                Args: {
                    "p_class_id": string;
                    "p_nonce": string;
                    "p_organization_id": string;
                    "p_request_id": string;
                    "p_user_id": string;
                };
                Returns: Json;
            };
            "school_revoke_qr": {
                Args: {
                    "p_class_id": string;
                    "p_organization_id": string;
                };
                Returns: undefined;
            };
            "school_roster_existing": {
                Args: {
                    "p_course_id": string;
                    "p_matric_numbers": (string)[];
                    "p_organization_id": string;
                };
                Returns: Json;
            };
            "school_scan": {
                Args: {
                    "p_class_id": string;
                    "p_device_hash": string;
                    "p_nonce": string;
                    "p_organization_id": string;
                    "p_request_id": string;
                    "p_user_id": string;
                };
                Returns: Json;
            };
            "school_scan_open": {
                Args: {
                    "p_class_id": string;
                    "p_device_hash": string;
                    "p_full_name": string;
                    "p_matric_number": string;
                    "p_nonce": string;
                    "p_organization_id": string;
                    "p_request_id": string;
                };
                Returns: Json;
            };
            "school_snapshot": {
                Args: {
                    "p_class_id"?: string;
                    "p_course_id"?: string;
                    "p_organization_id": string;
                };
                Returns: Json;
            };
            "set_organization_mode": {
                Args: {
                    "p_mode": Database["public"]['Enums']["organization_mode"];
                    "p_organization_id": string;
                };
                Returns: undefined;
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
            "submit_site_inquiry": {
                Args: {
                    "p_email": string;
                    "p_message": string;
                    "p_name": string;
                    "p_request_id": string;
                    "p_source_hash": string;
                };
                Returns: string;
            };
            "sync_subscription_event": {
                Args: {
                    "p_customer_code": string;
                    "p_event_at": string;
                    "p_event_id": string;
                    "p_event_type": string;
                    "p_period_end": string;
                    "p_plan_code": string;
                    "p_status": Database["public"]['Enums']["subscription_status"];
                    "p_subscription_code": string;
                };
                Returns: undefined;
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
            "update_queue_v2": {
                Args: {
                    "p_allow_phone": boolean;
                    "p_average_service_seconds": number;
                    "p_business_id": string;
                    "p_capacity": number | null;
                    "p_closes_at": string | null;
                    "p_description": string;
                    "p_expected_revision": number;
                    "p_location_id": string;
                    "p_name": string;
                    "p_opens_at": string | null;
                    "p_queue_id": string;
                    "p_require_phone": boolean;
                    "p_service_name": string;
                    "p_status": Database["public"]['Enums']["queue_status"];
                    "p_warning_threshold": number;
                };
                Returns: string;
            };
            "workspace_notification_snapshot": {
                Args: {
                    "p_business_id": string;
                    "p_limit"?: number;
                };
                Returns: Json;
            };
        };
        Enums: {
            "attendance_status": "PRESENT" | "LATE" | "ABSENT" | "EARLY_LEAVE" | "INCOMPLETE" | "EXCUSED" | "FLAGGED";
            "business_role": "owner" | "admin" | "staff" | "lecturer" | "student";
            "notification_channel": "web_push" | "sms" | "whatsapp";
            "notification_status": "pending" | "sent" | "failed" | "skipped";
            "notification_type": "almost_your_turn" | "your_turn" | "queue_paused";
            "organization_mode": "BUSINESS" | "SCHOOL" | "HYBRID";
            "organization_type": "UNIVERSITY_SCHOOL" | "HOSPITAL_CLINIC" | "BANK_FINANCIAL" | "SALON_BARBERSHOP" | "GOVERNMENT_OFFICE" | "COMPANY_OTHER";
            "organization_verification_status": "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
            "person_type": "CUSTOMER" | "STUDENT" | "EMPLOYEE" | "VISITOR" | "GUEST";
            "professional_category": "LECTURER_TEACHER" | "DOCTOR" | "NURSE" | "BANKER" | "BARBER_STYLIST" | "CONSULTANT" | "OTHER_PROFESSIONAL";
            "queue_status": "open" | "paused" | "closed";
            "session_status": "DRAFT" | "SCHEDULED" | "OPEN" | "PAUSED" | "CLOSED" | "COMPLETED";
            "session_type": "QUEUE" | "CLASS" | "VISIT" | "APPOINTMENT" | "EVENT" | "SHIFT";
            "subscription_plan": "FREE" | "STARTER" | "BUSINESS";
            "subscription_status": "pending" | "active" | "past_due" | "cancelled" | "expired";
            "ticket_actor_type": "customer" | "staff" | "system";
            "ticket_event_type": "joined" | "called" | "recalled" | "completed" | "no_show" | "cancelled";
            "ticket_status": "waiting" | "serving" | "completed" | "no_show" | "cancelled";
            "workspace_ownership": "ORGANIZATION" | "INDIVIDUAL";
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
            "attendance_status": ["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "INCOMPLETE", "EXCUSED", "FLAGGED"], "business_role": ["owner", "admin", "staff", "lecturer", "student"], "notification_channel": ["web_push", "sms", "whatsapp"], "notification_status": ["pending", "sent", "failed", "skipped"], "notification_type": ["almost_your_turn", "your_turn", "queue_paused"], "organization_mode": ["BUSINESS", "SCHOOL", "HYBRID"], "organization_type": ["UNIVERSITY_SCHOOL", "HOSPITAL_CLINIC", "BANK_FINANCIAL", "SALON_BARBERSHOP", "GOVERNMENT_OFFICE", "COMPANY_OTHER"], "organization_verification_status": ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"], "person_type": ["CUSTOMER", "STUDENT", "EMPLOYEE", "VISITOR", "GUEST"], "professional_category": ["LECTURER_TEACHER", "DOCTOR", "NURSE", "BANKER", "BARBER_STYLIST", "CONSULTANT", "OTHER_PROFESSIONAL"], "queue_status": ["open", "paused", "closed"], "session_status": ["DRAFT", "SCHEDULED", "OPEN", "PAUSED", "CLOSED", "COMPLETED"], "session_type": ["QUEUE", "CLASS", "VISIT", "APPOINTMENT", "EVENT", "SHIFT"], "subscription_plan": ["FREE", "STARTER", "BUSINESS"], "subscription_status": ["pending", "active", "past_due", "cancelled", "expired"], "ticket_actor_type": ["customer", "staff", "system"], "ticket_event_type": ["joined", "called", "recalled", "completed", "no_show", "cancelled"], "ticket_status": ["waiting", "serving", "completed", "no_show", "cancelled"], "workspace_ownership": ["ORGANIZATION", "INDIVIDUAL"]
        }
    }
} as const;
