export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_audit_logs: {
        Row: {
          action: Json | null
          created_at: string
          id: string
          message: Json | null
          metadata: Json
          page: string
          role: string
          session_id: string
          type: string
          user_id: string
          workspace: string
        }
        Insert: {
          action?: Json | null
          created_at?: string
          id?: string
          message?: Json | null
          metadata?: Json
          page: string
          role: string
          session_id: string
          type: string
          user_id: string
          workspace: string
        }
        Update: {
          action?: Json | null
          created_at?: string
          id?: string
          message?: Json | null
          metadata?: Json
          page?: string
          role?: string
          session_id?: string
          type?: string
          user_id?: string
          workspace?: string
        }
        Relationships: []
      }
      attendance_corrections: {
        Row: {
          action_type: string | null
          applied_at: string | null
          approved_by: string | null
          attendance_date: string | null
          branch_id: string
          checkin_id: string | null
          corrected_at: string | null
          corrected_by: string | null
          correction_type: string
          created_at: string
          exception_id: string | null
          id: string
          is_test: boolean
          new_values: Json
          previous_values: Json
          reason: string
          requested_by: string | null
          scan_event_ids: Json
          staff_id: string | null
          status: string
        }
        Insert: {
          action_type?: string | null
          applied_at?: string | null
          approved_by?: string | null
          attendance_date?: string | null
          branch_id: string
          checkin_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_type: string
          created_at?: string
          exception_id?: string | null
          id?: string
          is_test?: boolean
          new_values?: Json
          previous_values?: Json
          reason: string
          requested_by?: string | null
          scan_event_ids?: Json
          staff_id?: string | null
          status?: string
        }
        Update: {
          action_type?: string | null
          applied_at?: string | null
          approved_by?: string | null
          attendance_date?: string | null
          branch_id?: string
          checkin_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_type?: string
          created_at?: string
          exception_id?: string | null
          id?: string
          is_test?: boolean
          new_values?: Json
          previous_values?: Json
          reason?: string
          requested_by?: string | null
          scan_event_ids?: Json
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "staff_shift_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "attendance_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_closing_interventions: {
        Row: {
          applied_at: string | null
          attendance_business_date: string
          branch_id: string
          checkin_id: string
          created_at: string
          dedupe_key: string
          delivery_attempts: number
          due_at: string
          id: string
          last_delivery_error: string | null
          notification_sent_at: string | null
          policy_snapshot: Json
          staff_id: string
          stage: string
          updated_at: string
          workflow_task_sent_at: string | null
        }
        Insert: {
          applied_at?: string | null
          attendance_business_date: string
          branch_id: string
          checkin_id: string
          created_at?: string
          dedupe_key: string
          delivery_attempts?: number
          due_at: string
          id?: string
          last_delivery_error?: string | null
          notification_sent_at?: string | null
          policy_snapshot?: Json
          staff_id: string
          stage: string
          updated_at?: string
          workflow_task_sent_at?: string | null
        }
        Update: {
          applied_at?: string | null
          attendance_business_date?: string
          branch_id?: string
          checkin_id?: string
          created_at?: string
          dedupe_key?: string
          delivery_attempts?: number
          due_at?: string
          id?: string
          last_delivery_error?: string | null
          notification_sent_at?: string | null
          policy_snapshot?: Json
          staff_id?: string
          stage?: string
          updated_at?: string
          workflow_task_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_closing_interventions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_interventions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "staff_shift_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_closing_interventions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_rule_versions: {
        Row: {
          branch_id: string
          changed_by: string | null
          created_at: string
          effective_from: string
          id: string
          previous_values: Json
          reason: string
          rule_values: Json
        }
        Insert: {
          branch_id: string
          changed_by?: string | null
          created_at?: string
          effective_from: string
          id?: string
          previous_values?: Json
          reason: string
          rule_values?: Json
        }
        Update: {
          branch_id?: string
          changed_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          previous_values?: Json
          reason?: string
          rule_values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "attendance_rule_versions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_rule_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_staff_category_rules: {
        Row: {
          active_service_blocks_clock_out: boolean | null
          branch_id: string
          changed_by: string | null
          created_at: string
          crm_closing_policy_enabled: boolean | null
          early_leave_threshold_minutes: number | null
          effective_from: string
          effective_until: string | null
          id: string
          late_grace_minutes: number | null
          overtime_threshold_minutes: number | null
          previous_values: Json
          reason: string
          staff_category: string
        }
        Insert: {
          active_service_blocks_clock_out?: boolean | null
          branch_id: string
          changed_by?: string | null
          created_at?: string
          crm_closing_policy_enabled?: boolean | null
          early_leave_threshold_minutes?: number | null
          effective_from: string
          effective_until?: string | null
          id?: string
          late_grace_minutes?: number | null
          overtime_threshold_minutes?: number | null
          previous_values?: Json
          reason: string
          staff_category: string
        }
        Update: {
          active_service_blocks_clock_out?: boolean | null
          branch_id?: string
          changed_by?: string | null
          created_at?: string
          crm_closing_policy_enabled?: boolean | null
          early_leave_threshold_minutes?: number | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          late_grace_minutes?: number | null
          overtime_threshold_minutes?: number | null
          previous_values?: Json
          reason?: string
          staff_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_category_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_staff_category_rules_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exceptions: {
        Row: {
          branch_id: string
          category: string | null
          checkin_id: string | null
          created_at: string
          dedupe_key: string | null
          detected_at: string
          exception_type: string
          first_detected_at: string | null
          id: string
          is_test: boolean
          last_detected_at: string | null
          latest_scan_event_id: string | null
          message: string
          metadata: Json
          occurrence_count: number
          priority: string
          resolution_action: string | null
          resolution_owner: string | null
          resolution_status: string
          recommended_action: string | null
          related_checkin_ids: string[]
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          safe_error_code: string | null
          scan_event_id: string | null
          severity: string
          staff_id: string | null
          status: string
          staff_response_required: boolean
          technical_context: Json
          updated_at: string
        }
        Insert: {
          branch_id: string
          category?: string | null
          checkin_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          detected_at?: string
          exception_type: string
          first_detected_at?: string | null
          id?: string
          is_test?: boolean
          last_detected_at?: string | null
          latest_scan_event_id?: string | null
          message: string
          metadata?: Json
          occurrence_count?: number
          priority?: string
          resolution_action?: string | null
          resolution_owner?: string | null
          resolution_status?: string
          recommended_action?: string | null
          related_checkin_ids?: string[]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safe_error_code?: string | null
          scan_event_id?: string | null
          severity?: string
          staff_id?: string | null
          status?: string
          staff_response_required?: boolean
          technical_context?: Json
          updated_at?: string
        }
        Update: {
          branch_id?: string
          category?: string | null
          checkin_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          detected_at?: string
          exception_type?: string
          first_detected_at?: string | null
          id?: string
          is_test?: boolean
          last_detected_at?: string | null
          latest_scan_event_id?: string | null
          message?: string
          metadata?: Json
          occurrence_count?: number
          priority?: string
          resolution_action?: string | null
          resolution_owner?: string | null
          resolution_status?: string
          recommended_action?: string | null
          related_checkin_ids?: string[]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safe_error_code?: string | null
          scan_event_id?: string | null
          severity?: string
          staff_id?: string | null
          status?: string
          staff_response_required?: boolean
          technical_context?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exceptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "staff_shift_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_latest_scan_event_id_fkey"
            columns: ["latest_scan_event_id"]
            isOneToOne: false
            referencedRelation: "qr_scan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_scan_event_id_fkey"
            columns: ["scan_event_id"]
            isOneToOne: false
            referencedRelation: "qr_scan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exceptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          active_service_blocks_clock_out: boolean
          ambiguous_scan_behavior: string
          attendance_day_boundary: string
          branch_operating_close_time: string
          branch_id: string
          clock_in_early_grace_minutes: number
          clock_in_late_grace_minutes: number
          clock_in_window_after_shift_start_minutes: number
          clock_in_window_before_shift_minutes: number
          clock_out_early_grace_minutes: number
          clock_out_late_grace_minutes: number
          clock_out_window_after_shift_end_minutes: number
          clock_out_window_before_shift_end_minutes: number
          closing_intervention_last_error: string | null
          closing_intervention_last_run_at: string | null
          crm_closing_buffer_minutes: number
          crm_closing_policy_enabled: boolean
          crm_hard_cutoff_delay_minutes: number
          crm_manager_escalation_delay_minutes: number
          created_at: string
          duplicate_scan_debounce_minutes: number
          duplicate_scan_window_seconds: number
          early_clock_in_allowed_minutes: number
          early_leave_threshold_minutes: number
          first_scan_closing_behavior: string
          late_grace_minutes: number
          launch_recovery_closing_end_time: string
          launch_recovery_closing_start_time: string
          launch_recovery_enabled: boolean
          launch_recovery_end_date: string | null
          launch_recovery_reason: string | null
          launch_recovery_start_date: string | null
          missing_schedule_behavior: string
          off_day_scan_behavior: string
          overnight_shift_cutoff_time: string
          overtime_threshold_minutes: number
          require_registered_device_for_attendance: boolean
          test_mode_disabled_at: string | null
          test_mode_disabled_by: string | null
          test_mode_enabled: boolean
          test_mode_enabled_at: string | null
          test_mode_enabled_by: string | null
          test_mode_reason: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_service_blocks_clock_out?: boolean
          ambiguous_scan_behavior?: string
          attendance_day_boundary?: string
          branch_operating_close_time?: string
          branch_id: string
          clock_in_early_grace_minutes?: number
          clock_in_late_grace_minutes?: number
          clock_in_window_after_shift_start_minutes?: number
          clock_in_window_before_shift_minutes?: number
          clock_out_early_grace_minutes?: number
          clock_out_late_grace_minutes?: number
          clock_out_window_after_shift_end_minutes?: number
          clock_out_window_before_shift_end_minutes?: number
          closing_intervention_last_error?: string | null
          closing_intervention_last_run_at?: string | null
          crm_closing_buffer_minutes?: number
          crm_closing_policy_enabled?: boolean
          crm_hard_cutoff_delay_minutes?: number
          crm_manager_escalation_delay_minutes?: number
          created_at?: string
          duplicate_scan_debounce_minutes?: number
          duplicate_scan_window_seconds?: number
          early_clock_in_allowed_minutes?: number
          early_leave_threshold_minutes?: number
          first_scan_closing_behavior?: string
          late_grace_minutes?: number
          launch_recovery_closing_end_time?: string
          launch_recovery_closing_start_time?: string
          launch_recovery_enabled?: boolean
          launch_recovery_end_date?: string | null
          launch_recovery_reason?: string | null
          launch_recovery_start_date?: string | null
          missing_schedule_behavior?: string
          off_day_scan_behavior?: string
          overnight_shift_cutoff_time?: string
          overtime_threshold_minutes?: number
          require_registered_device_for_attendance?: boolean
          test_mode_disabled_at?: string | null
          test_mode_disabled_by?: string | null
          test_mode_enabled?: boolean
          test_mode_enabled_at?: string | null
          test_mode_enabled_by?: string | null
          test_mode_reason?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_service_blocks_clock_out?: boolean
          ambiguous_scan_behavior?: string
          attendance_day_boundary?: string
          branch_operating_close_time?: string
          branch_id?: string
          clock_in_early_grace_minutes?: number
          clock_in_late_grace_minutes?: number
          clock_in_window_after_shift_start_minutes?: number
          clock_in_window_before_shift_minutes?: number
          clock_out_early_grace_minutes?: number
          clock_out_late_grace_minutes?: number
          clock_out_window_after_shift_end_minutes?: number
          clock_out_window_before_shift_end_minutes?: number
          closing_intervention_last_error?: string | null
          closing_intervention_last_run_at?: string | null
          crm_closing_buffer_minutes?: number
          crm_closing_policy_enabled?: boolean
          crm_hard_cutoff_delay_minutes?: number
          crm_manager_escalation_delay_minutes?: number
          created_at?: string
          duplicate_scan_debounce_minutes?: number
          duplicate_scan_window_seconds?: number
          early_clock_in_allowed_minutes?: number
          early_leave_threshold_minutes?: number
          first_scan_closing_behavior?: string
          late_grace_minutes?: number
          launch_recovery_closing_end_time?: string
          launch_recovery_closing_start_time?: string
          launch_recovery_enabled?: boolean
          launch_recovery_end_date?: string | null
          launch_recovery_reason?: string | null
          launch_recovery_start_date?: string | null
          missing_schedule_behavior?: string
          off_day_scan_behavior?: string
          overnight_shift_cutoff_time?: string
          overtime_threshold_minutes?: number
          require_registered_device_for_attendance?: boolean
          test_mode_disabled_at?: string | null
          test_mode_disabled_by?: string | null
          test_mode_enabled?: boolean
          test_mode_enabled_at?: string | null
          test_mode_enabled_by?: string | null
          test_mode_reason?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_test_mode_disabled_by_fkey"
            columns: ["test_mode_disabled_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_test_mode_disabled_by_fkey"
            columns: ["test_mode_disabled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_test_mode_enabled_by_fkey"
            columns: ["test_mode_enabled_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_test_mode_enabled_by_fkey"
            columns: ["test_mode_enabled_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_times: {
        Row: {
          block_date: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          reason: string
          staff_id: string
          start_time: string
        }
        Insert: {
          block_date: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          reason: string
          staff_id: string
          start_time: string
        }
        Update: {
          block_date?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          reason?: string
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_times_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_logs: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          id: string
          new_amount_paid: number | null
          new_payment_method: string | null
          new_payment_reference: string | null
          new_payment_status: string | null
          old_amount_paid: number | null
          old_payment_method: string | null
          old_payment_reference: string | null
          old_payment_status: string | null
          reason: string | null
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_amount_paid?: number | null
          new_payment_method?: string | null
          new_payment_reference?: string | null
          new_payment_status?: string | null
          old_amount_paid?: number | null
          old_payment_method?: string | null
          old_payment_reference?: string | null
          old_payment_status?: string | null
          reason?: string | null
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_amount_paid?: number | null
          new_payment_method?: string | null
          new_payment_reference?: string | null
          new_payment_status?: string | null
          old_amount_paid?: number | null
          old_payment_method?: string | null
          old_payment_reference?: string | null
          old_payment_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_payment_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payment_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payment_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_paid: number
          arrived_at: string | null
          booking_date: string
          booking_progress_status: string
          branch_id: string
          checked_in_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          delivery_type: string
          driver_id: string | null
          end_time: string
          hold_expires_at: string | null
          home_service_tracking_status: string
          id: string
          metadata: Json
          no_show_at: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          resource_id: string | null
          service_id: string
          session_auto_completed_at: string | null
          session_completed_at: string | null
          session_completion_source: string | null
          session_due_at: string | null
          session_duration_minutes_snapshot: number | null
          session_extended_at: string | null
          session_extended_by: string | null
          session_extension_reason: string | null
          session_start_scan_event_id: string | null
          session_started_at: string | null
          session_started_from_resource_id: string | null
          staff_id: string
          start_time: string
          status: string
          travel_buffer_mins: number | null
          travel_started_at: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          arrived_at?: string | null
          booking_date: string
          booking_progress_status?: string
          branch_id: string
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          delivery_type?: string
          driver_id?: string | null
          end_time: string
          hold_expires_at?: string | null
          home_service_tracking_status?: string
          id?: string
          metadata?: Json
          no_show_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          resource_id?: string | null
          service_id: string
          session_auto_completed_at?: string | null
          session_completed_at?: string | null
          session_completion_source?: string | null
          session_due_at?: string | null
          session_duration_minutes_snapshot?: number | null
          session_extended_at?: string | null
          session_extended_by?: string | null
          session_extension_reason?: string | null
          session_start_scan_event_id?: string | null
          session_started_at?: string | null
          session_started_from_resource_id?: string | null
          staff_id: string
          start_time: string
          status?: string
          travel_buffer_mins?: number | null
          travel_started_at?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          arrived_at?: string | null
          booking_date?: string
          booking_progress_status?: string
          branch_id?: string
          checked_in_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_type?: string
          driver_id?: string | null
          end_time?: string
          hold_expires_at?: string | null
          home_service_tracking_status?: string
          id?: string
          metadata?: Json
          no_show_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          resource_id?: string | null
          service_id?: string
          session_auto_completed_at?: string | null
          session_completed_at?: string | null
          session_completion_source?: string | null
          session_due_at?: string | null
          session_duration_minutes_snapshot?: number | null
          session_extended_at?: string | null
          session_extended_by?: string | null
          session_extension_reason?: string | null
          session_start_scan_event_id?: string | null
          session_started_at?: string | null
          session_started_from_resource_id?: string | null
          staff_id?: string
          start_time?: string
          status?: string
          travel_buffer_mins?: number | null
          travel_started_at?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "branch_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_extended_by_fkey"
            columns: ["session_extended_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_extended_by_fkey"
            columns: ["session_extended_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_start_scan_event_id_fkey"
            columns: ["session_start_scan_event_id"]
            isOneToOne: false
            referencedRelation: "qr_scan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_started_from_resource_id_fkey"
            columns: ["session_started_from_resource_id"]
            isOneToOne: false
            referencedRelation: "branch_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_booking_rules: {
        Row: {
          branch_id: string
          created_at: string
          home_service_driver_capacity: number
          home_service_enabled: boolean
          home_service_end_time: string
          home_service_start_time: string
          id: string
          in_spa_end_time: string
          in_spa_start_time: string
          max_advance_booking_days: number
          travel_buffer_mins: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          home_service_driver_capacity?: number
          home_service_enabled?: boolean
          home_service_end_time?: string
          home_service_start_time?: string
          id?: string
          in_spa_end_time?: string
          in_spa_start_time?: string
          max_advance_booking_days?: number
          travel_buffer_mins?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          home_service_driver_capacity?: number
          home_service_enabled?: boolean
          home_service_end_time?: string
          home_service_start_time?: string
          id?: string
          in_spa_end_time?: string
          in_spa_start_time?: string
          max_advance_booking_days?: number
          travel_buffer_mins?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_booking_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_resources: {
        Row: {
          branch_id: string
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_resources_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_services: {
        Row: {
          available_home_service: boolean
          available_in_spa: boolean
          booking_visibility: string
          branch_id: string
          created_at: string
          custom_duration_minutes: number | null
          custom_image_url: string | null
          custom_price: number | null
          customer_tier_required: string
          id: string
          is_active: boolean
          is_featured: boolean
          public_description: string | null
          public_title: string | null
          requires_senior_staff: boolean
          requires_special_setup: boolean
          service_id: string
          setup_notes: string | null
          sort_order: number
          visibility: string
        }
        Insert: {
          available_home_service?: boolean
          available_in_spa?: boolean
          booking_visibility?: string
          branch_id: string
          created_at?: string
          custom_duration_minutes?: number | null
          custom_image_url?: string | null
          custom_price?: number | null
          customer_tier_required?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          public_description?: string | null
          public_title?: string | null
          requires_senior_staff?: boolean
          requires_special_setup?: boolean
          service_id: string
          setup_notes?: string | null
          sort_order?: number
          visibility?: string
        }
        Update: {
          available_home_service?: boolean
          available_in_spa?: boolean
          booking_visibility?: string
          branch_id?: string
          created_at?: string
          custom_duration_minutes?: number | null
          custom_image_url?: string | null
          custom_price?: number | null
          customer_tier_required?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          public_description?: string | null
          public_title?: string | null
          requires_senior_staff?: boolean
          requires_special_setup?: boolean
          service_id?: string
          setup_notes?: string | null
          sort_order?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_services_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          barangay: string | null
          city: string | null
          created_at: string
          email: string | null
          fb_page: string | null
          home_service_extra_km_fee: number
          home_service_free_km: number
          id: string
          is_active: boolean
          latitude: number | null
          location_metadata: Json
          longitude: number | null
          maps_embed_url: string | null
          messenger_link: string | null
          name: string
          opening_hours: string | null
          phone: string | null
          place_id: string | null
          secondary_phone: string | null
          slot_interval_minutes: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          address: string
          barangay?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fb_page?: string | null
          home_service_extra_km_fee?: number
          home_service_free_km?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_metadata?: Json
          longitude?: number | null
          maps_embed_url?: string | null
          messenger_link?: string | null
          name: string
          opening_hours?: string | null
          phone?: string | null
          place_id?: string | null
          secondary_phone?: string | null
          slot_interval_minutes?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string
          barangay?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fb_page?: string | null
          home_service_extra_km_fee?: number
          home_service_free_km?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          location_metadata?: Json
          longitude?: number | null
          maps_embed_url?: string | null
          messenger_link?: string | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          place_id?: string | null
          secondary_phone?: string | null
          slot_interval_minutes?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coverage_requirements: {
        Row: {
          branch_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          minimum_required: number
          staff_type: string
          start_time: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          minimum_required: number
          staff_type: string
          start_time: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          minimum_required?: number
          staff_type?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_requirements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tracking_links: {
        Row: {
          access_count: number
          booking_id: string
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          expires_at: string
          id: string
          is_active: boolean
          last_accessed_at: string | null
          metadata: Json
          token: string
          updated_at: string
        }
        Insert: {
          access_count?: number
          booking_id: string
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          metadata?: Json
          token: string
          updated_at?: string
        }
        Update: {
          access_count?: number
          booking_id?: string
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          metadata?: Json
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tracking_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tracking_links_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tracking_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tracking_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tracking_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birthday: string | null
          created_at: string
          email: string | null
          first_booking_date: string | null
          full_name: string
          health_notes: string | null
          id: string
          last_booking_date: string | null
          loyalty_tier: string
          notes: string | null
          phone: string
          preferred_service_id: string | null
          preferred_staff_id: string | null
          preferred_visit_type: string | null
          pressure_preference: string | null
          total_bookings: number
          updated_at: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          email?: string | null
          first_booking_date?: string | null
          full_name: string
          health_notes?: string | null
          id?: string
          last_booking_date?: string | null
          loyalty_tier?: string
          notes?: string | null
          phone: string
          preferred_service_id?: string | null
          preferred_staff_id?: string | null
          preferred_visit_type?: string | null
          pressure_preference?: string | null
          total_bookings?: number
          updated_at?: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          email?: string | null
          first_booking_date?: string | null
          full_name?: string
          health_notes?: string | null
          id?: string
          last_booking_date?: string | null
          loyalty_tier?: string
          notes?: string | null
          phone?: string
          preferred_service_id?: string | null
          preferred_staff_id?: string | null
          preferred_visit_type?: string | null
          pressure_preference?: string | null
          total_bookings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_preferred_service_id_fkey"
            columns: ["preferred_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cash_reconciliations: {
        Row: {
          actual_card: number
          actual_cash: number
          actual_gcash: number
          actual_maya: number
          actual_other: number
          branch_id: string
          created_at: string
          expected_card: number
          expected_cash: number
          expected_gcash: number
          expected_maya: number
          expected_other: number
          id: string
          notes: string | null
          reconciliation_date: string
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_card?: number
          actual_cash?: number
          actual_gcash?: number
          actual_maya?: number
          actual_other?: number
          branch_id: string
          created_at?: string
          expected_card?: number
          expected_cash?: number
          expected_gcash?: number
          expected_maya?: number
          expected_other?: number
          id?: string
          notes?: string | null
          reconciliation_date: string
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_card?: number
          actual_cash?: number
          actual_gcash?: number
          actual_maya?: number
          actual_other?: number
          branch_id?: string
          created_at?: string
          expected_card?: number
          expected_cash?: number
          expected_gcash?: number
          expected_maya?: number
          expected_other?: number
          id?: string
          notes?: string | null
          reconciliation_date?: string
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_cash_reconciliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_cash_reconciliations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_cash_reconciliations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          color: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      device_activation_tokens: {
        Row: {
          branch_id: string
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          purpose: string
          reason: string | null
          requested_by: string | null
          revoke_previous_device_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          staff_id: string
          token_hash: string
          updated_at: string
          used_at: string | null
          used_by_device_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          expires_at: string
          id?: string
          metadata?: Json
          purpose?: string
          reason?: string | null
          requested_by?: string | null
          revoke_previous_device_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          staff_id: string
          token_hash: string
          updated_at?: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          purpose?: string
          reason?: string | null
          requested_by?: string | null
          revoke_previous_device_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          staff_id?: string
          token_hash?: string
          updated_at?: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_activation_tokens_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_revoke_previous_device_id_fkey"
            columns: ["revoke_previous_device_id"]
            isOneToOne: false
            referencedRelation: "staff_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_activation_tokens_used_by_device_id_fkey"
            columns: ["used_by_device_id"]
            isOneToOne: false
            referencedRelation: "staff_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          created_at: string
          created_by: string | null
          id: string
          payroll_item_id: string
          reason: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          payroll_item_id: string
          reason: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          payroll_item_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          base_pay: number
          bonus_pay: number
          branch_id: string | null
          commission_pay: number
          completed_bookings_count: number
          created_at: string
          deduction_amount: number
          gross_revenue: number
          home_service_allowance_pay: number
          home_service_bookings_count: number
          id: string
          metadata: Json
          net_pay: number
          notes: string | null
          payroll_period_id: string
          reimbursement_pay: number
          salary_advance_amount: number
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_pay?: number
          bonus_pay?: number
          branch_id?: string | null
          commission_pay?: number
          completed_bookings_count?: number
          created_at?: string
          deduction_amount?: number
          gross_revenue?: number
          home_service_allowance_pay?: number
          home_service_bookings_count?: number
          id?: string
          metadata?: Json
          net_pay?: number
          notes?: string | null
          payroll_period_id: string
          reimbursement_pay?: number
          salary_advance_amount?: number
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_pay?: number
          bonus_pay?: number
          branch_id?: string | null
          commission_pay?: number
          completed_bookings_count?: number
          created_at?: string
          deduction_amount?: number
          gross_revenue?: number
          home_service_allowance_pay?: number
          home_service_bookings_count?: number
          id?: string
          metadata?: Json
          net_pay?: number
          notes?: string | null
          payroll_period_id?: string
          reimbursement_pay?: number
          salary_advance_amount?: number
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          allow_status_editing: boolean
          continue_reminders_while_unpaid: boolean
          created_at: string
          custom_reminder_days: number
          default_payment_status: string
          enabled_payment_methods: string[]
          fixed_day: number
          id: string
          include_inactive_employees: boolean
          notify_payroll_due: boolean
          notify_payroll_fully_paid: boolean
          payday_rule: string
          reminder_preset: string
          show_owner_dashboard_reminder: boolean
          show_payroll_page_reminder: boolean
          show_total_payroll: boolean
          tracking_start_month: number
          tracking_start_year: number
          updated_at: string
          updated_by: string | null
          weekend_adjustment: string
        }
        Insert: {
          allow_status_editing?: boolean
          continue_reminders_while_unpaid?: boolean
          created_at?: string
          custom_reminder_days?: number
          default_payment_status?: string
          enabled_payment_methods?: string[]
          fixed_day?: number
          id?: string
          include_inactive_employees?: boolean
          notify_payroll_due?: boolean
          notify_payroll_fully_paid?: boolean
          payday_rule?: string
          reminder_preset?: string
          show_owner_dashboard_reminder?: boolean
          show_payroll_page_reminder?: boolean
          show_total_payroll?: boolean
          tracking_start_month?: number
          tracking_start_year?: number
          updated_at?: string
          updated_by?: string | null
          weekend_adjustment?: string
        }
        Update: {
          allow_status_editing?: boolean
          continue_reminders_while_unpaid?: boolean
          created_at?: string
          custom_reminder_days?: number
          default_payment_status?: string
          enabled_payment_methods?: string[]
          fixed_day?: number
          id?: string
          include_inactive_employees?: boolean
          notify_payroll_due?: boolean
          notify_payroll_fully_paid?: boolean
          payday_rule?: string
          reminder_preset?: string
          show_owner_dashboard_reminder?: boolean
          show_payroll_page_reminder?: boolean
          show_total_payroll?: boolean
          tracking_start_month?: number
          tracking_start_year?: number
          updated_at?: string
          updated_by?: string | null
          weekend_adjustment?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      public_site_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          is_enabled: boolean
          link_href: string | null
          metadata: Json
          section_key: string | null
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_enabled?: boolean
          link_href?: string | null
          metadata?: Json
          section_key?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_enabled?: boolean
          link_href?: string | null
          metadata?: Json
          section_key?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_site_sections: {
        Row: {
          body: string | null
          created_at: string
          cta_href: string | null
          cta_label: string | null
          id: string
          image_url: string | null
          is_enabled: boolean
          metadata: Json
          secondary_image_url: string | null
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean
          metadata?: Json
          secondary_image_url?: string | null
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          cta_href?: string | null
          cta_label?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean
          metadata?: Json
          secondary_image_url?: string | null
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_points: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          metadata: Json
          point_type: string
          public_code: string
          requires_registered_device: boolean
          resource_id: string | null
          scan_behavior: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          metadata?: Json
          point_type: string
          public_code: string
          requires_registered_device?: boolean
          resource_id?: string | null
          scan_behavior?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          metadata?: Json
          point_type?: string
          public_code?: string
          requires_registered_device?: boolean
          resource_id?: string | null
          scan_behavior?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_points_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_points_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "branch_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_events: {
        Row: {
          action: string
          booking_id: string | null
          branch_id: string | null
          checkin_id: string | null
          created_at: string
          device_id: string | null
          id: string
          ip_address: unknown
          is_test: boolean
          message: string | null
          metadata: Json
          operation_id: string | null
          operation_result: Json | null
          operation_result_recorded_at: string | null
          outcome: string
          qr_point_id: string | null
          reason_code: string | null
          request_id: string | null
          resource_id: string | null
          scan_type: string
          staff_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          booking_id?: string | null
          branch_id?: string | null
          checkin_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: unknown
          is_test?: boolean
          message?: string | null
          metadata?: Json
          operation_id?: string | null
          operation_result?: Json | null
          operation_result_recorded_at?: string | null
          outcome: string
          qr_point_id?: string | null
          reason_code?: string | null
          request_id?: string | null
          resource_id?: string | null
          scan_type: string
          staff_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          booking_id?: string | null
          branch_id?: string | null
          checkin_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: unknown
          is_test?: boolean
          message?: string | null
          metadata?: Json
          operation_id?: string | null
          operation_result?: Json | null
          operation_result_recorded_at?: string | null
          outcome?: string
          qr_point_id?: string | null
          reason_code?: string | null
          request_id?: string | null
          resource_id?: string | null
          scan_type?: string
          staff_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scan_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "staff_shift_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "staff_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_qr_point_id_fkey"
            columns: ["qr_point_id"]
            isOneToOne: false
            referencedRelation: "qr_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "branch_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scan_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_health_checks: {
        Row: {
          affected_bookings_count: number
          available_drivers_count: number
          available_staff_count: number
          available_therapists_count: number
          branch_id: string
          check_date: string
          checked_in_staff_count: number | null
          created_at: string
          id: string
          issues: Json
          missing_staff_count: number
          recommendations: Json
          scheduled_drivers_count: number
          scheduled_staff_count: number
          scheduled_therapists_count: number
          status: string
        }
        Insert: {
          affected_bookings_count?: number
          available_drivers_count?: number
          available_staff_count?: number
          available_therapists_count?: number
          branch_id: string
          check_date: string
          checked_in_staff_count?: number | null
          created_at?: string
          id?: string
          issues?: Json
          missing_staff_count?: number
          recommendations?: Json
          scheduled_drivers_count?: number
          scheduled_staff_count?: number
          scheduled_therapists_count?: number
          status?: string
        }
        Update: {
          affected_bookings_count?: number
          available_drivers_count?: number
          available_staff_count?: number
          available_therapists_count?: number
          branch_id?: string
          check_date?: string
          checked_in_staff_count?: number | null
          created_at?: string
          id?: string
          issues?: Json
          missing_staff_count?: number
          recommendations?: Json
          scheduled_drivers_count?: number
          scheduled_staff_count?: number
          scheduled_therapists_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_health_checks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          ends_next_day: boolean
          id: string
          is_day_off: boolean
          override_date: string
          reason: string | null
          shift_type: string | null
          staff_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          ends_next_day?: boolean
          id?: string
          is_day_off?: boolean
          override_date: string
          reason?: string | null
          shift_type?: string | null
          staff_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          ends_next_day?: boolean
          id?: string
          is_day_off?: boolean
          override_date?: string
          reason?: string | null
          shift_type?: string | null
          staff_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_repair_backups: {
        Row: {
          batch_id: string
          created_at: string
          id: number
          original_row: Json
          reason: string
          source_pk: string
          source_table: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: number
          original_row: Json
          reason: string
          source_pk: string
          source_table: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: number
          original_row?: Json
          reason?: string
          source_pk?: string
          source_table?: string
        }
        Relationships: []
      }
      schedule_suggestions: {
        Row: {
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string
          created_by: string
          current_value: Json | null
          end_time: string | null
          id: string
          impact_summary: string | null
          priority: string
          reason: string
          rejected_at: string | null
          rejected_by: string | null
          staff_id: string | null
          start_time: string | null
          status: string
          suggested_value: Json
          suggestion_type: string
          target_date: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string
          created_by?: string
          current_value?: Json | null
          end_time?: string | null
          id?: string
          impact_summary?: string | null
          priority?: string
          reason: string
          rejected_at?: string | null
          rejected_by?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string
          suggested_value: Json
          suggestion_type: string
          target_date: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string
          current_value?: Json | null
          end_time?: string | null
          id?: string
          impact_summary?: string | null
          priority?: string
          reason?: string
          rejected_at?: string | null
          rejected_by?: string | null
          staff_id?: string | null
          start_time?: string | null
          status?: string
          suggested_value?: Json
          suggestion_type?: string
          target_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_rules: {
        Row: {
          auto_breaks_enabled: boolean
          auto_generate_breaks: boolean
          auto_generate_room_reset_buffers: boolean
          auto_generate_travel_buffers: boolean
          branch_id: string
          created_at: string
          default_break_minutes: number
          default_days_off_per_week: number
          home_service_travel_buffer_minutes: number
          id: string
          max_same_role_off_per_day: number
          max_services_per_staff_per_day: number | null
          max_therapists_off_per_day: number
          max_working_hours_per_day: number
          min_daily_csr: number
          min_daily_drivers: number
          min_daily_staff: number
          min_daily_therapists: number
          min_daily_utility: number
          protect_weekends: boolean
          room_reset_buffer_minutes: number
          suggestions_require_manager_approval: boolean
          updated_at: string
        }
        Insert: {
          auto_breaks_enabled?: boolean
          auto_generate_breaks?: boolean
          auto_generate_room_reset_buffers?: boolean
          auto_generate_travel_buffers?: boolean
          branch_id: string
          created_at?: string
          default_break_minutes?: number
          default_days_off_per_week?: number
          home_service_travel_buffer_minutes?: number
          id?: string
          max_same_role_off_per_day?: number
          max_services_per_staff_per_day?: number | null
          max_therapists_off_per_day?: number
          max_working_hours_per_day?: number
          min_daily_csr?: number
          min_daily_drivers?: number
          min_daily_staff?: number
          min_daily_therapists?: number
          min_daily_utility?: number
          protect_weekends?: boolean
          room_reset_buffer_minutes?: number
          suggestions_require_manager_approval?: boolean
          updated_at?: string
        }
        Update: {
          auto_breaks_enabled?: boolean
          auto_generate_breaks?: boolean
          auto_generate_room_reset_buffers?: boolean
          auto_generate_travel_buffers?: boolean
          branch_id?: string
          created_at?: string
          default_break_minutes?: number
          default_days_off_per_week?: number
          home_service_travel_buffer_minutes?: number
          id?: string
          max_same_role_off_per_day?: number
          max_services_per_staff_per_day?: number | null
          max_therapists_off_per_day?: number
          max_working_hours_per_day?: number
          min_daily_csr?: number
          min_daily_drivers?: number
          min_daily_staff?: number
          min_daily_therapists?: number
          min_daily_utility?: number
          protect_weekends?: boolean
          room_reset_buffer_minutes?: number
          suggestions_require_manager_approval?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          buffer_after: number
          buffer_before: number
          category_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_alt: string | null
          image_url: string | null
          is_active: boolean
          metadata: Json
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          buffer_after?: number
          buffer_before?: number
          category_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          buffer_after?: number
          buffer_before?: number
          category_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          access_notes: string | null
          archive_reason: string | null
          archived_at: string | null
          auth_user_id: string | null
          avatar_path: string | null
          avatar_url: string | null
          branch_id: string
          created_at: string
          full_name: string
          id: string
          identity_verified_at: string | null
          is_active: boolean
          is_cross_branch: boolean
          is_head: boolean
          merged_into_staff_id: string | null
          metadata: Json
          nickname: string | null
          phone: string | null
          staff_type: string
          system_role: string
          temporary_access_expires_at: string | null
          tier: string
          updated_at: string
          workspace_access: string[]
        }
        Insert: {
          access_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          branch_id: string
          created_at?: string
          full_name: string
          id?: string
          identity_verified_at?: string | null
          is_active?: boolean
          is_cross_branch?: boolean
          is_head?: boolean
          merged_into_staff_id?: string | null
          metadata?: Json
          nickname?: string | null
          phone?: string | null
          staff_type?: string
          system_role?: string
          temporary_access_expires_at?: string | null
          tier?: string
          updated_at?: string
          workspace_access?: string[]
        }
        Update: {
          access_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          branch_id?: string
          created_at?: string
          full_name?: string
          id?: string
          identity_verified_at?: string | null
          is_active?: boolean
          is_cross_branch?: boolean
          is_head?: boolean
          merged_into_staff_id?: string | null
          metadata?: Json
          nickname?: string | null
          phone?: string | null
          staff_type?: string
          system_role?: string
          temporary_access_expires_at?: string | null
          tier?: string
          updated_at?: string
          workspace_access?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merged_into_staff_id_fkey"
            columns: ["merged_into_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merged_into_staff_id_fkey"
            columns: ["merged_into_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_account_access_events: {
        Row: {
          actor_staff_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json
          outcome: string
          target_auth_user_id: string | null
          target_email: string | null
          target_staff_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_staff_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          outcome: string
          target_auth_user_id?: string | null
          target_email?: string | null
          target_staff_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_staff_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          outcome?: string
          target_auth_user_id?: string | null
          target_email?: string | null
          target_staff_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_account_access_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_account_access_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_account_access_events_target_staff_id_fkey"
            columns: ["target_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_account_access_events_target_staff_id_fkey"
            columns: ["target_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branch_audit_logs: {
        Row: {
          change_request_id: string | null
          changed_by_auth_user_id: string | null
          changed_by_staff_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_branch_id: string
          old_branch_id: string | null
          reason: string | null
          source: string
          staff_id: string
        }
        Insert: {
          change_request_id?: string | null
          changed_by_auth_user_id?: string | null
          changed_by_staff_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_branch_id: string
          old_branch_id?: string | null
          reason?: string | null
          source?: string
          staff_id: string
        }
        Update: {
          change_request_id?: string | null
          changed_by_auth_user_id?: string | null
          changed_by_staff_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_branch_id?: string
          old_branch_id?: string | null
          reason?: string | null
          source?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_audit_logs_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "staff_branch_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_audit_logs_changed_by_staff_id_fkey"
            columns: ["changed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_audit_logs_changed_by_staff_id_fkey"
            columns: ["changed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_audit_logs_new_branch_id_fkey"
            columns: ["new_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_audit_logs_old_branch_id_fkey"
            columns: ["old_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branch_change_requests: {
        Row: {
          created_at: string
          current_branch_id: string | null
          id: string
          metadata: Json
          qr_point_id: string | null
          reason: string | null
          request_source: string
          requested_branch_id: string
          requested_by_auth_user_id: string | null
          requested_by_staff_id: string | null
          reviewed_at: string | null
          reviewed_by_auth_user_id: string | null
          reviewed_by_staff_id: string | null
          reviewer_note: string | null
          scan_event_id: string | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_branch_id?: string | null
          id?: string
          metadata?: Json
          qr_point_id?: string | null
          reason?: string | null
          request_source?: string
          requested_branch_id: string
          requested_by_auth_user_id?: string | null
          requested_by_staff_id?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          reviewed_by_staff_id?: string | null
          reviewer_note?: string | null
          scan_event_id?: string | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_branch_id?: string | null
          id?: string
          metadata?: Json
          qr_point_id?: string | null
          reason?: string | null
          request_source?: string
          requested_branch_id?: string
          requested_by_auth_user_id?: string | null
          requested_by_staff_id?: string | null
          reviewed_at?: string | null
          reviewed_by_auth_user_id?: string | null
          reviewed_by_staff_id?: string | null
          reviewer_note?: string | null
          scan_event_id?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_change_requests_current_branch_id_fkey"
            columns: ["current_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_qr_point_id_fkey"
            columns: ["qr_point_id"]
            isOneToOne: false
            referencedRelation: "qr_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_requested_branch_id_fkey"
            columns: ["requested_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_requested_by_staff_id_fkey"
            columns: ["requested_by_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_requested_by_staff_id_fkey"
            columns: ["requested_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_scan_event_id_fkey"
            columns: ["scan_event_id"]
            isOneToOne: false
            referencedRelation: "qr_scan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branch_change_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_deletion_backups: {
        Row: {
          auth_email: string | null
          auth_user_id: string | null
          deleted_at: string
          deleted_reason: string
          full_name: string
          id: string
          staff_id: string
          staff_row: Json
        }
        Insert: {
          auth_email?: string | null
          auth_user_id?: string | null
          deleted_at?: string
          deleted_reason: string
          full_name: string
          id?: string
          staff_id: string
          staff_row: Json
        }
        Update: {
          auth_email?: string | null
          auth_user_id?: string | null
          deleted_at?: string
          deleted_reason?: string
          full_name?: string
          id?: string
          staff_id?: string
          staff_row?: Json
        }
        Relationships: []
      }
      staff_device_registration_requests: {
        Row: {
          activation_token_id: string | null
          branch_id: string
          browser_name: string | null
          cancelled_at: string | null
          completed_at: string | null
          completed_device_id: string | null
          created_at: string
          device_fingerprint_hash: string
          device_label: string | null
          existing_device_id: string | null
          expires_at: string | null
          id: string
          metadata: Json
          platform_name: string | null
          registration_method: string
          rejection_reason: string | null
          replacement_device_id: string | null
          request_type: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by_staff_id: string | null
          reviewer_note: string | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activation_token_id?: string | null
          branch_id: string
          browser_name?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          completed_device_id?: string | null
          created_at?: string
          device_fingerprint_hash: string
          device_label?: string | null
          existing_device_id?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          platform_name?: string | null
          registration_method?: string
          rejection_reason?: string | null
          replacement_device_id?: string | null
          request_type?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          reviewer_note?: string | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activation_token_id?: string | null
          branch_id?: string
          browser_name?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          completed_device_id?: string | null
          created_at?: string
          device_fingerprint_hash?: string
          device_label?: string | null
          existing_device_id?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          platform_name?: string | null
          registration_method?: string
          rejection_reason?: string | null
          replacement_device_id?: string | null
          request_type?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          reviewer_note?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_device_registration_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_device_registration_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_devices: {
        Row: {
          branch_id: string
          browser_name: string | null
          browser_version: string | null
          created_at: string
          device_fingerprint_hash: string
          device_label: string | null
          device_role: string
          id: string
          last_attendance_scan_at: string | null
          last_seen_at: string | null
          last_service_scan_at: string | null
          metadata: Json
          platform_name: string | null
          registration_source: string
          replacement_confirmed_at: string | null
          replacement_confirmed_by: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          security_state: string
          staff_id: string
          status: string
          superseded_by_device_id: string | null
          trusted_after: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          browser_name?: string | null
          browser_version?: string | null
          created_at?: string
          device_fingerprint_hash: string
          device_label?: string | null
          device_role?: string
          id?: string
          last_attendance_scan_at?: string | null
          last_seen_at?: string | null
          last_service_scan_at?: string | null
          metadata?: Json
          platform_name?: string | null
          registration_source?: string
          replacement_confirmed_at?: string | null
          replacement_confirmed_by?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          security_state?: string
          staff_id: string
          status?: string
          superseded_by_device_id?: string | null
          trusted_after?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          browser_name?: string | null
          browser_version?: string | null
          created_at?: string
          device_fingerprint_hash?: string
          device_label?: string | null
          device_role?: string
          id?: string
          last_attendance_scan_at?: string | null
          last_seen_at?: string | null
          last_service_scan_at?: string | null
          metadata?: Json
          platform_name?: string | null
          registration_source?: string
          replacement_confirmed_at?: string | null
          replacement_confirmed_by?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          security_state?: string
          staff_id?: string
          status?: string
          superseded_by_device_id?: string | null
          trusted_after?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_replacement_confirmed_by_fkey"
            columns: ["replacement_confirmed_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_replacement_confirmed_by_fkey"
            columns: ["replacement_confirmed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_devices_superseded_by_device_id_fkey"
            columns: ["superseded_by_device_id"]
            isOneToOne: false
            referencedRelation: "staff_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance_branch_assignments: {
        Row: {
          approved_by: string | null
          assignment_date: string
          assignment_type: string
          branch_id: string
          created_at: string
          id: string
          reason: string | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          assignment_date: string
          assignment_type?: string
          branch_id: string
          created_at?: string
          id?: string
          reason?: string | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          assignment_date?: string
          assignment_type?: string
          branch_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_branch_assignments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_branch_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_duty_assignments: {
        Row: {
          branch_id: string
          created_at: string
          day_of_week: number
          duty_type: string
          id: string
          is_active: boolean
          staff_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          day_of_week: number
          duty_type: string
          id?: string
          is_active?: boolean
          staff_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          day_of_week?: number
          duty_type?: string
          id?: string
          is_active?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_duty_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_duty_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_duty_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_group_schedule_rules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string | null
          group_id: string
          id: string
          is_active: boolean
          is_day_off: boolean
          shift_type: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          is_day_off?: boolean
          shift_type?: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          is_day_off?: boolean
          shift_type?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_group_schedule_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "staff_schedule_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_identity_merge_backups: {
        Row: {
          backed_up_at: string
          id: string
          merge_batch: string
          row_data: Json
          source_row_id: string
          source_table: string
        }
        Insert: {
          backed_up_at?: string
          id?: string
          merge_batch: string
          row_data: Json
          source_row_id: string
          source_table: string
        }
        Update: {
          backed_up_at?: string
          id?: string
          merge_batch?: string
          row_data?: Json
          source_row_id?: string
          source_table?: string
        }
        Relationships: []
      }
      staff_location_snapshots: {
        Row: {
          accuracy_meters: number | null
          booking_id: string | null
          branch_id: string | null
          id: string
          lat: number
          lng: number
          metadata: Json
          recorded_at: string
          source: string
          staff_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          booking_id?: string | null
          branch_id?: string | null
          id?: string
          lat: number
          lng: number
          metadata?: Json
          recorded_at?: string
          source?: string
          staff_id: string
        }
        Update: {
          accuracy_meters?: number | null
          booking_id?: string | null
          branch_id?: string | null
          id?: string
          lat?: number
          lng?: number
          metadata?: Json
          recorded_at?: string
          source?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_snapshots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_location_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_location_snapshots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_location_snapshots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_merge_map_work: {
        Row: {
          canonical_staff_id: string
          created_at: string
          identity_name: string
          source_staff_id: string
        }
        Insert: {
          canonical_staff_id: string
          created_at?: string
          identity_name: string
          source_staff_id: string
        }
        Update: {
          canonical_staff_id?: string
          created_at?: string
          identity_name?: string
          source_staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_merge_map_canonical_fkey"
            columns: ["canonical_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merge_map_canonical_fkey"
            columns: ["canonical_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merge_map_source_fkey"
            columns: ["source_staff_id"]
            isOneToOne: true
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merge_map_source_fkey"
            columns: ["source_staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_onboarding_requests: {
        Row: {
          address: string | null
          auth_user_id: string | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          experience_notes: string | null
          full_name: string
          id: string
          metadata: Json
          phone: string | null
          preferred_role: string | null
          rejection_reason: string | null
          requested_branch_id: string | null
          reviewed_at: string | null
          reviewed_by_staff_id: string | null
          staff_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_notes?: string | null
          full_name: string
          id?: string
          metadata?: Json
          phone?: string | null
          preferred_role?: string | null
          rejection_reason?: string | null
          requested_branch_id?: string | null
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_notes?: string | null
          full_name?: string
          id?: string
          metadata?: Json
          phone?: string | null
          preferred_role?: string | null
          rejection_reason?: string | null
          requested_branch_id?: string | null
          reviewed_at?: string | null
          reviewed_by_staff_id?: string | null
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_onboarding_requests_requested_branch_id_fkey"
            columns: ["requested_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_onboarding_requests_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_onboarding_requests_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_onboarding_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_onboarding_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay_profiles: {
        Row: {
          base_pay_amount: number
          base_pay_type: string
          branch_id: string | null
          commission_percent: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          home_service_allowance: number
          id: string
          is_active: boolean
          metadata: Json
          per_service_bonus: number
          staff_id: string
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          base_pay_amount?: number
          base_pay_type?: string
          branch_id?: string | null
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          home_service_allowance?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          per_service_bonus?: number
          staff_id: string
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          base_pay_amount?: number
          base_pay_type?: string
          branch_id?: string | null
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          home_service_allowance?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          per_service_bonus?: number
          staff_id?: string
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedule_groups: {
        Row: {
          branch_id: string
          created_at: string
          description: string | null
          group_key: string
          group_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          description?: string | null
          group_key: string
          group_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          description?: string | null
          group_key?: string
          group_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedule_groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          ends_next_day: boolean
          id: string
          is_active: boolean
          shift_type: string
          staff_id: string
          start_time: string
          window_order: number
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          ends_next_day?: boolean
          id?: string
          is_active?: boolean
          shift_type?: string
          staff_id: string
          start_time: string
          window_order?: number
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          ends_next_day?: boolean
          id?: string
          is_active?: boolean
          shift_type?: string
          staff_id?: string
          start_time?: string
          window_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules_merge_backup_20260712: {
        Row: {
          backed_up_at: string | null
          backup_reason: string | null
          created_at: string | null
          day_of_week: number | null
          end_time: string | null
          id: string | null
          is_active: boolean | null
          shift_type: string | null
          staff_id: string | null
          start_time: string | null
        }
        Insert: {
          backed_up_at?: string | null
          backup_reason?: string | null
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: string | null
          is_active?: boolean | null
          shift_type?: string | null
          staff_id?: string | null
          start_time?: string | null
        }
        Update: {
          backed_up_at?: string | null
          backup_reason?: string | null
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string | null
          id?: string | null
          is_active?: boolean | null
          shift_type?: string | null
          staff_id?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
      staff_scheduling_preferences: {
        Row: {
          branch_id: string | null
          can_do_home_service: boolean
          can_drive: boolean
          created_at: string
          default_break_end: string | null
          default_break_start: string | null
          id: string
          max_services_per_day: number | null
          max_trips_per_day: number | null
          max_working_hours_per_day: number | null
          preferred_day_off: number | null
          requires_manager_approval_for_changes: boolean
          secondary_preferred_day_off: number | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          can_do_home_service?: boolean
          can_drive?: boolean
          created_at?: string
          default_break_end?: string | null
          default_break_start?: string | null
          id?: string
          max_services_per_day?: number | null
          max_trips_per_day?: number | null
          max_working_hours_per_day?: number | null
          preferred_day_off?: number | null
          requires_manager_approval_for_changes?: boolean
          secondary_preferred_day_off?: number | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          can_do_home_service?: boolean
          can_drive?: boolean
          created_at?: string
          default_break_end?: string | null
          default_break_start?: string | null
          id?: string
          max_services_per_day?: number | null
          max_trips_per_day?: number | null
          max_working_hours_per_day?: number | null
          preferred_day_off?: number | null
          requires_manager_approval_for_changes?: boolean
          secondary_preferred_day_off?: number | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_scheduling_preferences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_scheduling_preferences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_scheduling_preferences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_service_categories: {
        Row: {
          created_at: string
          id: string
          service_category_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_category_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_category_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_service_categories_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_service_categories_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_service_categories_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string
          id: string
          service_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shift_checkins: {
        Row: {
          actual_clock_out_reconciled_at: string | null
          attendance_business_date: string | null
          attendance_expected_end_at: string | null
          attendance_policy_snapshot: Json
          attendance_policy_source: string
          attendance_status: string
          branch_id: string
          branch_timezone: string
          checked_in_at: string
          checked_out_at: string | null
          clock_in_method: string | null
          clock_in_scan_event_id: string | null
          clock_out_method: string | null
          clock_out_confirmation_required: boolean
          clock_out_reminder_at: string | null
          clock_out_scan_event_id: string | null
          created_at: string
          early_leave_minutes: number
          earliest_normal_clock_out_at: string | null
          exception_state: string
          id: string
          is_test: boolean
          late_minutes: number
          latest_normal_clock_out_at: string | null
          hard_cutoff_at: string | null
          manager_escalation_at: string | null
          notes: string | null
          overtime_minutes: number
          provisional_auto_closed_at: string | null
          provisional_clock_out_at: string | null
          recorded_by: string | null
          schedule_source: string | null
          schedule_source_id: string | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          shift_date: string
          shift_instance_key: string | null
          shift_type: string
          source_qr_point_id: string | null
          staff_id: string
          status: string
          updated_at: string
          worked_minutes: number
        }
        Insert: {
          actual_clock_out_reconciled_at?: string | null
          attendance_business_date?: string | null
          attendance_expected_end_at?: string | null
          attendance_policy_snapshot?: Json
          attendance_policy_source?: string
          attendance_status?: string
          branch_id: string
          branch_timezone?: string
          checked_in_at?: string
          checked_out_at?: string | null
          clock_in_method?: string | null
          clock_in_scan_event_id?: string | null
          clock_out_method?: string | null
          clock_out_confirmation_required?: boolean
          clock_out_reminder_at?: string | null
          clock_out_scan_event_id?: string | null
          created_at?: string
          early_leave_minutes?: number
          earliest_normal_clock_out_at?: string | null
          exception_state?: string
          id?: string
          is_test?: boolean
          late_minutes?: number
          latest_normal_clock_out_at?: string | null
          hard_cutoff_at?: string | null
          manager_escalation_at?: string | null
          notes?: string | null
          overtime_minutes?: number
          provisional_auto_closed_at?: string | null
          provisional_clock_out_at?: string | null
          recorded_by?: string | null
          schedule_source?: string | null
          schedule_source_id?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          shift_date: string
          shift_instance_key?: string | null
          shift_type?: string
          source_qr_point_id?: string | null
          staff_id: string
          status?: string
          updated_at?: string
          worked_minutes?: number
        }
        Update: {
          actual_clock_out_reconciled_at?: string | null
          attendance_business_date?: string | null
          attendance_expected_end_at?: string | null
          attendance_policy_snapshot?: Json
          attendance_policy_source?: string
          attendance_status?: string
          branch_id?: string
          branch_timezone?: string
          checked_in_at?: string
          checked_out_at?: string | null
          clock_in_method?: string | null
          clock_in_scan_event_id?: string | null
          clock_out_method?: string | null
          clock_out_confirmation_required?: boolean
          clock_out_reminder_at?: string | null
          clock_out_scan_event_id?: string | null
          created_at?: string
          early_leave_minutes?: number
          earliest_normal_clock_out_at?: string | null
          exception_state?: string
          id?: string
          is_test?: boolean
          late_minutes?: number
          latest_normal_clock_out_at?: string | null
          hard_cutoff_at?: string | null
          manager_escalation_at?: string | null
          notes?: string | null
          overtime_minutes?: number
          provisional_auto_closed_at?: string | null
          provisional_clock_out_at?: string | null
          recorded_by?: string | null
          schedule_source?: string | null
          schedule_source_id?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          shift_date?: string
          shift_instance_key?: string | null
          shift_type?: string
          source_qr_point_id?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_checkins_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_clock_in_scan_event_id_fkey"
            columns: ["clock_in_scan_event_id"]
            isOneToOne: false
            referencedRelation: "qr_scan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_clock_out_scan_event_id_fkey"
            columns: ["clock_out_scan_event_id"]
            isOneToOne: false
            referencedRelation: "qr_scan_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_source_qr_point_id_fkey"
            columns: ["source_qr_point_id"]
            isOneToOne: false
            referencedRelation: "qr_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_checkins_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_requests: {
        Row: {
          branch_id: string
          contacted_at: string | null
          contacted_by: string | null
          converted_to_booking_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          preferred_date: string | null
          preferred_time: string | null
          service_id: string | null
          status: string
          updated_at: string
          visit_type: string | null
        }
        Insert: {
          branch_id: string
          contacted_at?: string | null
          contacted_by?: string | null
          converted_to_booking_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
          visit_type?: string | null
        }
        Update: {
          branch_id?: string
          contacted_at?: string | null
          contacted_by?: string | null
          converted_to_booking_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_requests_contacted_by_fkey"
            columns: ["contacted_by"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_requests_contacted_by_fkey"
            columns: ["contacted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_requests_converted_to_booking_id_fkey"
            columns: ["converted_to_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_tasks: {
        Row: {
          action_href: string | null
          assigned_to_role: string | null
          assigned_to_staff_id: string | null
          body: string | null
          branch_id: string | null
          completed_at: string | null
          completed_by_staff_id: string | null
          created_at: string
          dedupe_key: string
          due_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
          workspace_scope: string
        }
        Insert: {
          action_href?: string | null
          assigned_to_role?: string | null
          assigned_to_staff_id?: string | null
          body?: string | null
          branch_id?: string | null
          completed_at?: string | null
          completed_by_staff_id?: string | null
          created_at?: string
          dedupe_key: string
          due_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          task_type: string
          title: string
          updated_at?: string
          workspace_scope: string
        }
        Update: {
          action_href?: string | null
          assigned_to_role?: string | null
          assigned_to_staff_id?: string | null
          body?: string | null
          branch_id?: string | null
          completed_at?: string | null
          completed_by_staff_id?: string | null
          created_at?: string
          dedupe_key?: string
          due_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
          workspace_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tasks_assigned_to_staff_id_fkey"
            columns: ["assigned_to_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tasks_assigned_to_staff_id_fkey"
            columns: ["assigned_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tasks_completed_by_staff_id_fkey"
            columns: ["completed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tasks_completed_by_staff_id_fkey"
            columns: ["completed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_notifications: {
        Row: {
          action_href: string | null
          actor_staff_id: string | null
          body: string | null
          branch_id: string | null
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          priority: string
          read_at: string | null
          recipient_staff_id: string | null
          requires_action: boolean
          resolved_at: string | null
          status: string
          target_role: string | null
          target_workspace: string
          title: string
          type: string
        }
        Insert: {
          action_href?: string | null
          actor_staff_id?: string | null
          body?: string | null
          branch_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          priority?: string
          read_at?: string | null
          recipient_staff_id?: string | null
          requires_action?: boolean
          resolved_at?: string | null
          status?: string
          target_role?: string | null
          target_workspace: string
          title: string
          type: string
        }
        Update: {
          action_href?: string | null
          actor_staff_id?: string | null
          body?: string | null
          branch_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          priority?: string
          read_at?: string | null
          recipient_staff_id?: string | null
          requires_action?: boolean
          resolved_at?: string | null
          status?: string
          target_role?: string | null
          target_workspace?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_notifications_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_notifications_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_notifications_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_notifications_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      operational_staff: {
        Row: {
          access_notes: string | null
          archive_reason: string | null
          archived_at: string | null
          auth_user_id: string | null
          avatar_path: string | null
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          identity_verified_at: string | null
          is_active: boolean | null
          is_head: boolean | null
          merged_into_staff_id: string | null
          metadata: Json | null
          nickname: string | null
          phone: string | null
          staff_type: string | null
          system_role: string | null
          temporary_access_expires_at: string | null
          tier: string | null
          updated_at: string | null
          workspace_access: string[] | null
        }
        Insert: {
          access_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          identity_verified_at?: string | null
          is_active?: boolean | null
          is_head?: boolean | null
          merged_into_staff_id?: string | null
          metadata?: Json | null
          nickname?: string | null
          phone?: string | null
          staff_type?: string | null
          system_role?: string | null
          temporary_access_expires_at?: string | null
          tier?: string | null
          updated_at?: string | null
          workspace_access?: string[] | null
        }
        Update: {
          access_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          identity_verified_at?: string | null
          is_active?: boolean | null
          is_head?: boolean | null
          merged_into_staff_id?: string | null
          metadata?: Json | null
          nickname?: string | null
          phone?: string | null
          staff_type?: string | null
          system_role?: string | null
          temporary_access_expires_at?: string | null
          tier?: string | null
          updated_at?: string | null
          workspace_access?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merged_into_staff_id_fkey"
            columns: ["merged_into_staff_id"]
            isOneToOne: false
            referencedRelation: "operational_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_merged_into_staff_id_fkey"
            columns: ["merged_into_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_attendance_review_correction: {
        Args: {
          p_action: string
          p_actor_staff_id: string
          p_branch_id: string
          p_checkin_id?: string
          p_exception_id?: string
          p_is_test?: boolean
          p_reason: string
          p_values?: Json
        }
        Returns: {
          code: string
          correction_id: string
          message: string
          success: boolean
        }[]
      }
      can_mutate_schedule_for_branch: {
        Args: { p_branch_id: string }
        Returns: boolean
      }
      commit_attendance_scan_transaction: {
        Args: {
          p_action: string
          p_branch_id: string
          p_checkin_id?: string
          p_checkin_insert?: Json
          p_checkin_update?: Json
          p_device_id: string
          p_device_scan_type?: string
          p_exception?: Json
          p_ip_address?: string
          p_is_test?: boolean
          p_message?: string
          p_metadata?: Json
          p_outcome: string
          p_public_result?: Json
          p_qr_point_id: string
          p_reason_code?: string
          p_request_id: string
          p_scan_type: string
          p_staff_id: string
          p_user_agent?: string
        }
        Returns: {
          checkin_id: string
          code: string
          message: string
          operation_result: Json
          recovery_issue_id: string
          scan_event_id: string
          success: boolean
        }[]
      }
      process_crm_closing_attendance_interventions: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          active_service_blocks: number
          auto_closed_records: number
          created_interventions: number
          processed_open_records: number
        }[]
      }
      reconcile_provisional_attendance_clock_out: {
        Args: {
          p_actual_clock_out_at: string
          p_branch_id: string
          p_checkin_id: string
          p_device_id: string
          p_ip_address?: string
          p_is_test?: boolean
          p_metadata?: Json
          p_public_result: Json
          p_qr_point_id: string
          p_request_id: string
          p_staff_id: string
          p_user_agent?: string
        }
        Returns: {
          checkin_id: string
          code: string
          message: string
          operation_result: Json
          scan_event_id: string
          success: boolean
        }[]
      }
      save_attendance_branch_rule_version: {
        Args: {
          p_actor_staff_id: string
          p_branch_id: string
          p_effective_from: string
          p_reason: string
          p_rule_values: Json
        }
        Returns: {
          code: string
          message: string
          rule_version_id: string
          success: boolean
        }[]
      }
      save_attendance_category_rule: {
        Args: {
          p_actor_staff_id: string
          p_branch_id: string
          p_effective_from: string
          p_reason: string
          p_rule_values: Json
          p_staff_category: string
        }
        Returns: {
          category_rule_id: string
          code: string
          message: string
          success: boolean
        }[]
      }
      complete_staff_device_registration_request: {
        Args: {
          p_active_device_limit?: number
          p_browser_name?: string
          p_browser_version?: string
          p_device_fingerprint_hash: string
          p_device_label?: string
          p_platform_name?: string
          p_request_id: string
          p_staff_id: string
          p_user_agent?: string
        }
        Returns: {
          code: string
          device_id: string | null
          request_status: string
          success: boolean
        }[]
      }
      complete_due_service_sessions: {
        Args: { p_limit?: number }
        Returns: {
          booking_id: string
          branch_id: string
          completed_at: string
        }[]
      }
      compute_booking_end_time: {
        Args: { p_service_id: string; p_start_time: string }
        Returns: string
      }
      consume_attendance_device_recovery: {
        Args: {
          p_active_device_limit?: number
          p_browser_name?: string
          p_browser_version?: string
          p_device_fingerprint_hash: string
          p_device_label?: string
          p_platform_name?: string
          p_raw_token: string
          p_user_agent?: string
        }
        Returns: {
          branch_id: string
          branch_name: string
          code: string
          device_id: string
          expires_at: string
          message: string
          staff_id: string
          staff_name: string
          staff_type: string
          success: boolean
        }[]
      }
      create_online_booking: {
        Args: {
          p_branch_id: string
          p_date: string
          p_email?: string
          p_full_name: string
          p_notes?: string
          p_phone: string
          p_service_id: string
          p_staff_id: string
          p_start_time: string
        }
        Returns: string
      }
      get_auth_branch_id: { Args: never; Returns: string }
      get_auth_role: { Args: never; Returns: string }
      get_auth_staff_id: { Args: never; Returns: string }
      resolve_effective_attendance_branch: {
        Args: {
          p_attendance_date: string
          p_qr_branch_id: string
          p_staff_id: string
        }
        Returns: {
          allowed: boolean
          effective_branch_id: string | null
          source: string
        }[]
      }
      get_available_slots: {
        Args: {
          p_branch_id: string
          p_date?: string
          p_service_id: string
          p_staff_id?: string
        }
        Returns: {
          available: boolean
          slot_time: string
          staff_id: string
          staff_name: string
          staff_tier: string
        }[]
      }
      get_daily_schedule: {
        Args: { p_branch_id: string; p_date: string }
        Returns: {
          blocks: Json
          bookings: Json
          staff_id: string
          staff_name: string
          staff_tier: string
          work_end: string
          work_start: string
        }[]
      }
      review_staff_device_registration_request: {
        Args: {
          p_active_device_limit?: number
          p_rejection_reason?: string
          p_replacement_device_id?: string
          p_request_id: string
          p_review_status: string
          p_reviewer_auth_user_id: string
          p_reviewer_note?: string
          p_reviewer_staff_id: string
          p_token_expires_at?: string
          p_token_hash?: string
        }
        Returns: {
          activation_token_id: string | null
          branch_id: string
          expires_at: string | null
          request_id: string
          request_status: string
          staff_id: string
        }[]
      }
      get_effective_price: {
        Args: { p_branch_id: string; p_service_id: string }
        Returns: number
      }
      is_service_admin: { Args: never; Returns: boolean }
      record_booking_payment_change: {
        Args: {
          p_amount_paid: number
          p_booking_id: string
          p_branch_id?: string
          p_changed_by?: string
          p_clear_hold?: boolean
          p_next_status?: string
          p_payment_method: string
          p_payment_reference?: string
          p_payment_status: string
          p_reason?: string
        }
        Returns: {
          branch_id: string
          id: string
        }[]
      }
      replace_staff_service_capabilities: {
        Args: { p_service_ids?: string[]; p_target_staff_id: string }
        Returns: {
          service_id: string
        }[]
      }
      replace_staff_weekly_schedule: {
        Args: { p_branch_id: string; p_rows: Json; p_staff_id: string }
        Returns: {
          created_at: string
          day_of_week: number
          end_time: string
          ends_next_day: boolean
          id: string
          is_active: boolean
          shift_type: string
          staff_id: string
          start_time: string
          window_order: number
        }[]
        SetofOptions: {
          from: "*"
          to: "staff_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reset_attendance_state_transaction: {
        Args: {
          p_actor_staff_id: string
          p_branch_id: string
          p_checkin_id: string
          p_is_test?: boolean
          p_reason: string
          p_reset_mode?: string
        }
        Returns: {
          attendance_date: string
          checkin_id: string
          code: string
          correction_id: string
          message: string
          next_expected_action: string
          resolved_exception_count: number
          staff_id: string
          success: boolean
        }[]
      }
      review_staff_branch_change_request: {
        Args: {
          p_request_id: string
          p_review_status: string
          p_reviewer_auth_user_id: string
          p_reviewer_note?: string
          p_reviewer_staff_id: string
        }
        Returns: {
          previous_branch_id: string
          request_id: string
          request_status: string
          requested_branch_id: string
          reviewed_at: string
          staff_id: string
        }[]
      }
      schedule_explicit_time_end_min: {
        Args: { p_end: string; p_ends_next_day: boolean; p_start: string }
        Returns: number
      }
      schedule_explicit_time_ranges_overlap: {
        Args: {
          p_first_end: string
          p_first_ends_next_day: boolean
          p_first_start: string
          p_second_end: string
          p_second_ends_next_day: boolean
          p_second_start: string
        }
        Returns: boolean
      }
      schedule_group_key_for_staff_type: {
        Args: { p_staff_type: string }
        Returns: string
      }
      schedule_time_end_min: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      schedule_time_ranges_overlap: {
        Args: {
          p_first_end: string
          p_first_start: string
          p_second_end: string
          p_second_start: string
        }
        Returns: boolean
      }
      schedule_time_start_min: { Args: { p_time: string }; Returns: number }
      staff_is_operational: {
        Args: { p_staff: Database["public"]["Tables"]["staff"]["Row"] }
        Returns: boolean
      }
      staff_metadata_flag: {
        Args: { p_default: boolean; p_key: string; p_metadata: Json }
        Returns: boolean
      }
      update_booking_progress: {
        Args: { p_booking_id: string; p_next_status: string }
        Returns: undefined
      }
      upsert_customer: {
        Args: { p_email?: string; p_full_name: string; p_phone: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
