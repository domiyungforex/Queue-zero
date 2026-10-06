// Generated from migrations by npm run db:types. Do not edit manually.
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
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
                    "status": Database["public"]['Enums']["attendance_status"];
                    "student_id": string;
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
                    "status": Database["public"]['Enums']["attendance_status"];
                    "student_id": string;
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
                    "status"?: Database["public"]['Enums']["attendance_status"];
                    "student_id"?: string;
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
                    "country_code": string;
                    "created_at": string;
                    "id": string;
                    "industry": string;
                    "logo_url": string | null;
                    "name": string;
                    "organization_mode": Database["public"]['Enums']["organization_mode"];
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
                    "organization_mode"?: Database["public"]['Enums']["organization_mode"];
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
                    "organization_mode"?: Database["public"]['Enums']["organization_mode"];
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
                    "checkout_enabled": boolean;
                    "course_id": string;
                    "created_at": string;
                    "departure_required": boolean;
                    "id": string;
                    "late_after_minutes": number;
                    "opened_at": string | null;
                    "organization_id": string;
                    "planned_ends_at": string | null;
                };
                Insert: {
                    "arrival_open"?: boolean;
                    "checkout_enabled"?: boolean;
                    "course_id": string;
                    "created_at"?: string;
                    "departure_required"?: boolean;
                    "id": string;
                    "late_after_minutes"?: number;
                    "opened_at"?: string | null;
                    "organization_id": string;
                    "planned_ends_at"?: string | null;
                };
                Update: {
                    "arrival_open"?: boolean;
                    "checkout_enabled"?: boolean;
                    "course_id"?: string;
                    "created_at"?: string;
                    "departure_required"?: boolean;
                    "id"?: string;
                    "late_after_minutes"?: number;
                    "opened_at"?: string | null;
                    "organization_id"?: string;
                    "planned_ends_at"?: string | null;
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
                };
                Insert: {
                    "code": string;
                    "department_id": string;
                    "id"?: string;
                    "organization_id": string;
                    "title": string;
                };
                Update: {
                    "code"?: string;
                    "department_id"?: string;
                    "id"?: string;
                    "organization_id"?: string;
                    "title"?: string;
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
                    }
                ];
            };
            "departments": {
                Row: {
                    "faculty_id": string;
                    "id": string;
                    "name": string;
                    "organization_id": string;
                };
                Insert: {
                    "faculty_id": string;
                    "id"?: string;
                    "name": string;
                    "organization_id": string;
                };
                Update: {
                    "faculty_id"?: string;
                    "id"?: string;
                    "name"?: string;
                    "organization_id"?: string;
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
                    }
                ];
            };
            "faculties": {
                Row: {
                    "id": string;
                    "name": string;
                    "organization_id": string;
                };
                Insert: {
                    "id"?: string;
                    "name": string;
                    "organization_id": string;
                };
                Update: {
                    "id"?: string;
                    "name"?: string;
                    "organization_id"?: string;
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
                    "service_name": string;
                    "revision": number;
                    "session_id": string | null;
                    "slug": string;
                    "status": Database["public"]['Enums']["queue_status"];
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
                    "service_name": string;
                    "revision"?: number;
                    "session_id"?: string | null;
                    "slug": string;
                    "status"?: Database["public"]['Enums']["queue_status"];
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
                    "service_name"?: string;
                    "revision"?: number;
                    "session_id"?: string | null;
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
                };
                Insert: {
                    "created_at"?: string;
                    "department_id": string;
                    "id": string;
                    "level": string;
                    "matric_number": string;
                    "organization_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "department_id"?: string;
                    "id"?: string;
                    "level"?: string;
                    "matric_number"?: string;
                    "organization_id"?: string;
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
            "get_public_queue_v2": {
                Args: {
                    "p_slug": string;
                };
                Returns: {
                    "business_logo_url": string;
                    "business_name": string;
                    "description": string | null;
                    "estimated_wait_seconds": number | null;
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
            "school_claim_student": {
                Args: {
                    "p_organization_id": string;
                    "p_user_id": string;
                    "p_verified_email": string;
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
        };
        Enums: {
            "attendance_status": "PRESENT" | "LATE" | "ABSENT" | "EARLY_LEAVE" | "INCOMPLETE" | "EXCUSED" | "FLAGGED";
            "business_role": "owner" | "admin" | "staff" | "lecturer" | "student";
            "notification_channel": "web_push" | "sms" | "whatsapp";
            "notification_status": "pending" | "sent" | "failed" | "skipped";
            "notification_type": "almost_your_turn" | "your_turn" | "queue_paused";
            "organization_mode": "BUSINESS" | "SCHOOL" | "HYBRID";
            "person_type": "CUSTOMER" | "STUDENT" | "EMPLOYEE" | "VISITOR" | "GUEST";
            "queue_status": "open" | "paused" | "closed";
            "session_status": "DRAFT" | "SCHEDULED" | "OPEN" | "PAUSED" | "CLOSED" | "COMPLETED";
            "session_type": "QUEUE" | "CLASS" | "VISIT" | "APPOINTMENT" | "EVENT" | "SHIFT";
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
            "attendance_status": ["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "INCOMPLETE", "EXCUSED", "FLAGGED"], "business_role": ["owner", "admin", "staff", "lecturer", "student"], "notification_channel": ["web_push", "sms", "whatsapp"], "notification_status": ["pending", "sent", "failed", "skipped"], "notification_type": ["almost_your_turn", "your_turn", "queue_paused"], "organization_mode": ["BUSINESS", "SCHOOL", "HYBRID"], "person_type": ["CUSTOMER", "STUDENT", "EMPLOYEE", "VISITOR", "GUEST"], "queue_status": ["open", "paused", "closed"], "session_status": ["DRAFT", "SCHEDULED", "OPEN", "PAUSED", "CLOSED", "COMPLETED"], "session_type": ["QUEUE", "CLASS", "VISIT", "APPOINTMENT", "EVENT", "SHIFT"], "subscription_plan": ["FREE", "STARTER", "BUSINESS"], "subscription_status": ["pending", "active", "past_due", "cancelled", "expired"], "ticket_actor_type": ["customer", "staff", "system"], "ticket_event_type": ["joined", "called", "recalled", "completed", "no_show", "cancelled"], "ticket_status": ["waiting", "serving", "completed", "no_show", "cancelled"]
        }
    }
} as const;
