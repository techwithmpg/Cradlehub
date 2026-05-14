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
  public: {
    Tables: {
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
            referencedRelation: "staff"
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
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_logs: {
        Row: {
          id: string
          booking_id: string
          changed_by: string | null
          old_payment_method: string | null
          old_payment_status: string | null
          old_amount_paid: number | null
          old_payment_reference: string | null
          new_payment_method: string | null
          new_payment_status: string | null
          new_amount_paid: number | null
          new_payment_reference: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          changed_by?: string | null
          old_payment_method?: string | null
          old_payment_status?: string | null
          old_amount_paid?: number | null
          old_payment_reference?: string | null
          new_payment_method?: string | null
          new_payment_status?: string | null
          new_amount_paid?: number | null
          new_payment_reference?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          changed_by?: string | null
          old_payment_method?: string | null
          old_payment_status?: string | null
          old_amount_paid?: number | null
          old_payment_reference?: string | null
          new_payment_method?: string | null
          new_payment_status?: string | null
          new_amount_paid?: number | null
          new_payment_reference?: string | null
          reason?: string | null
          created_at?: string
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
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_paid: number
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
          home_service_tracking_status: string
          id: string
          metadata: Json
          no_show_at: string | null
          arrived_at: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          resource_id: string | null
          service_id: string
          session_completed_at: string | null
          session_started_at: string | null
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
          home_service_tracking_status?: string
          id?: string
          metadata?: Json
          no_show_at?: string | null
          arrived_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          resource_id?: string | null
          service_id: string
          session_completed_at?: string | null
          session_started_at?: string | null
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
          home_service_tracking_status?: string
          id?: string
          metadata?: Json
          no_show_at?: string | null
          arrived_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          resource_id?: string | null
          service_id?: string
          session_completed_at?: string | null
          session_started_at?: string | null
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
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cash_reconciliations: {
        Row: {
          id: string
          branch_id: string
          reconciliation_date: string
          recorded_by: string | null
          expected_cash: number
          expected_gcash: number
          expected_maya: number
          expected_card: number
          expected_other: number
          actual_cash: number
          actual_gcash: number
          actual_maya: number
          actual_card: number
          actual_other: number
          notes: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          reconciliation_date: string
          recorded_by?: string | null
          expected_cash?: number
          expected_gcash?: number
          expected_maya?: number
          expected_card?: number
          expected_other?: number
          actual_cash?: number
          actual_gcash?: number
          actual_maya?: number
          actual_card?: number
          actual_other?: number
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          reconciliation_date?: string
          recorded_by?: string | null
          expected_cash?: number
          expected_gcash?: number
          expected_maya?: number
          expected_card?: number
          expected_other?: number
          actual_cash?: number
          actual_gcash?: number
          actual_maya?: number
          actual_card?: number
          actual_other?: number
          notes?: string | null
          status?: string
          created_at?: string
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
          custom_price: number | null
          id: string
          is_active: boolean
          service_id: string
        }
        Insert: {
          available_home_service?: boolean
          available_in_spa?: boolean
          booking_visibility?: string
          branch_id: string
          created_at?: string
          custom_price?: number | null
          id?: string
          is_active?: boolean
          service_id: string
        }
        Update: {
          available_home_service?: boolean
          available_in_spa?: boolean
          booking_visibility?: string
          branch_id?: string
          created_at?: string
          custom_price?: number | null
          id?: string
          is_active?: boolean
          service_id?: string
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
          created_at: string
          email: string | null
          fb_page: string | null
          id: string
          is_active: boolean
          maps_embed_url: string | null
          messenger_link: string | null
          name: string
          opening_hours: string | null
          phone: string | null
          secondary_phone: string | null
          slot_interval_minutes: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          email?: string | null
          fb_page?: string | null
          id?: string
          is_active?: boolean
          maps_embed_url?: string | null
          messenger_link?: string | null
          name: string
          opening_hours?: string | null
          phone?: string | null
          secondary_phone?: string | null
          slot_interval_minutes?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          email?: string | null
          fb_page?: string | null
          id?: string
          is_active?: boolean
          maps_embed_url?: string | null
          messenger_link?: string | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          secondary_phone?: string | null
          slot_interval_minutes?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          first_booking_date: string | null
          full_name: string
          id: string
          last_booking_date: string | null
          notes: string | null
          phone: string
          preferred_staff_id: string | null
          preferred_service_id: string | null
          preferred_visit_type: string | null
          pressure_preference: string | null
          health_notes: string | null
          birthday: string | null
          loyalty_tier: string
          total_bookings: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_booking_date?: string | null
          full_name: string
          id?: string
          last_booking_date?: string | null
          notes?: string | null
          phone: string
          preferred_staff_id?: string | null
          preferred_service_id?: string | null
          preferred_visit_type?: string | null
          pressure_preference?: string | null
          health_notes?: string | null
          birthday?: string | null
          loyalty_tier?: string
          total_bookings?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_booking_date?: string | null
          full_name?: string
          id?: string
          last_booking_date?: string | null
          notes?: string | null
          phone?: string
          preferred_staff_id?: string | null
          preferred_service_id?: string | null
          preferred_visit_type?: string | null
          pressure_preference?: string | null
          health_notes?: string | null
          birthday?: string | null
          loyalty_tier?: string
          total_bookings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_preferred_staff_id_fkey"
            columns: ["preferred_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      public_site_sections: {
        Row: {
          id: string
          section_key: string
          title: string | null
          subtitle: string | null
          body: string | null
          cta_label: string | null
          cta_href: string | null
          image_url: string | null
          secondary_image_url: string | null
          sort_order: number
          is_enabled: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_key: string
          title?: string | null
          subtitle?: string | null
          body?: string | null
          cta_label?: string | null
          cta_href?: string | null
          image_url?: string | null
          secondary_image_url?: string | null
          sort_order?: number
          is_enabled?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_key?: string
          title?: string | null
          subtitle?: string | null
          body?: string | null
          cta_label?: string | null
          cta_href?: string | null
          image_url?: string | null
          secondary_image_url?: string | null
          sort_order?: number
          is_enabled?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_site_assets: {
        Row: {
          id: string
          section_key: string | null
          title: string | null
          alt_text: string | null
          image_url: string
          link_href: string | null
          sort_order: number
          is_enabled: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_key?: string | null
          title?: string | null
          alt_text?: string | null
          image_url: string
          link_href?: string | null
          sort_order?: number
          is_enabled?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_key?: string | null
          title?: string | null
          alt_text?: string | null
          image_url?: string
          link_href?: string | null
          sort_order?: number
          is_enabled?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_notifications: {
        Row: {
          id: string
          branch_id: string | null
          dedupe_key: string | null
          target_workspace: string
          target_role: string | null
          recipient_staff_id: string | null
          actor_staff_id: string | null
          type: string
          title: string
          body: string | null
          entity_type: string | null
          entity_id: string | null
          action_href: string | null
          priority: string
          status: string
          requires_action: boolean
          metadata: Record<string, unknown>
          created_at: string
          read_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          branch_id?: string | null
          dedupe_key?: string | null
          target_workspace: string
          target_role?: string | null
          recipient_staff_id?: string | null
          actor_staff_id?: string | null
          type: string
          title: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          action_href?: string | null
          priority?: string
          status?: string
          requires_action?: boolean
          metadata?: Record<string, unknown>
          created_at?: string
          read_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          branch_id?: string | null
          dedupe_key?: string | null
          target_workspace?: string
          target_role?: string | null
          recipient_staff_id?: string | null
          actor_staff_id?: string | null
          type?: string
          title?: string
          body?: string | null
          entity_type?: string | null
          entity_id?: string | null
          action_href?: string | null
          priority?: string
          status?: string
          requires_action?: boolean
          metadata?: Record<string, unknown>
          created_at?: string
          read_at?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "workspace_notifications_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "workspace_notifications_recipient_staff_id_fkey"; columns: ["recipient_staff_id"]; referencedRelation: "staff"; referencedColumns: ["id"] },
          { foreignKeyName: "workspace_notifications_actor_staff_id_fkey"; columns: ["actor_staff_id"]; referencedRelation: "staff"; referencedColumns: ["id"] }
        ]
      }
      workflow_tasks: {
        Row: {
          id: string
          branch_id: string | null
          workspace_scope: string
          assigned_to_staff_id: string | null
          assigned_to_role: string | null
          task_type: string
          title: string
          body: string | null
          entity_type: string
          entity_id: string
          action_href: string | null
          priority: string
          status: string
          due_at: string | null
          completed_at: string | null
          completed_by_staff_id: string | null
          dedupe_key: string
          metadata: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id?: string | null
          workspace_scope: string
          assigned_to_staff_id?: string | null
          assigned_to_role?: string | null
          task_type: string
          title: string
          body?: string | null
          entity_type: string
          entity_id: string
          action_href?: string | null
          priority?: string
          status?: string
          due_at?: string | null
          completed_at?: string | null
          completed_by_staff_id?: string | null
          dedupe_key: string
          metadata?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string | null
          workspace_scope?: string
          assigned_to_staff_id?: string | null
          assigned_to_role?: string | null
          task_type?: string
          title?: string
          body?: string | null
          entity_type?: string
          entity_id?: string
          action_href?: string | null
          priority?: string
          status?: string
          due_at?: string | null
          completed_at?: string | null
          completed_by_staff_id?: string | null
          dedupe_key?: string
          metadata?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "workflow_tasks_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "workflow_tasks_assigned_to_staff_id_fkey"; columns: ["assigned_to_staff_id"]; referencedRelation: "staff"; referencedColumns: ["id"] },
          { foreignKeyName: "workflow_tasks_completed_by_staff_id_fkey"; columns: ["completed_by_staff_id"]; referencedRelation: "staff"; referencedColumns: ["id"] }
        ]
      }
      waitlist_requests: {
        Row: {
          id: string
          branch_id: string
          customer_name: string
          customer_phone: string
          customer_email: string | null
          preferred_date: string | null
          preferred_time: string | null
          service_id: string | null
          visit_type: string | null
          notes: string | null
          status: string
          contacted_by: string | null
          contacted_at: string | null
          converted_to_booking_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          customer_name: string
          customer_phone: string
          customer_email?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          visit_type?: string | null
          notes?: string | null
          status?: string
          contacted_by?: string | null
          contacted_at?: string | null
          converted_to_booking_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          customer_name?: string
          customer_phone?: string
          customer_email?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          service_id?: string | null
          visit_type?: string | null
          notes?: string | null
          status?: string
          contacted_by?: string | null
          contacted_at?: string | null
          converted_to_booking_id?: string | null
          created_at?: string
          updated_at?: string
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
            foreignKeyName: "waitlist_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          is_day_off: boolean
          override_date: string
          reason: string | null
          staff_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          override_date: string
          reason?: string | null
          staff_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          override_date?: string
          reason?: string | null
          staff_id?: string
          start_time?: string | null
        }
        Relationships: [
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
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_health_checks: {
        Row: {
          id: string
          branch_id: string
          check_date: string
          status: string
          scheduled_staff_count: number
          available_staff_count: number
          checked_in_staff_count: number | null
          scheduled_therapists_count: number
          available_therapists_count: number
          scheduled_drivers_count: number
          available_drivers_count: number
          missing_staff_count: number
          affected_bookings_count: number
          issues: Json
          recommendations: Json
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          check_date: string
          status?: string
          scheduled_staff_count?: number
          available_staff_count?: number
          checked_in_staff_count?: number | null
          scheduled_therapists_count?: number
          available_therapists_count?: number
          scheduled_drivers_count?: number
          available_drivers_count?: number
          missing_staff_count?: number
          affected_bookings_count?: number
          issues?: Json
          recommendations?: Json
          created_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          check_date?: string
          status?: string
          scheduled_staff_count?: number
          available_staff_count?: number
          checked_in_staff_count?: number | null
          scheduled_therapists_count?: number
          available_therapists_count?: number
          scheduled_drivers_count?: number
          available_drivers_count?: number
          missing_staff_count?: number
          affected_bookings_count?: number
          issues?: Json
          recommendations?: Json
          created_at?: string
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
      schedule_suggestions: {
        Row: {
          id: string
          branch_id: string
          staff_id: string | null
          suggestion_type: string
          target_date: string
          start_time: string | null
          end_time: string | null
          current_value: Json | null
          suggested_value: Json
          reason: string
          impact_summary: string | null
          priority: string
          status: string
          created_by: string
          approved_by: string | null
          approved_at: string | null
          rejected_by: string | null
          rejected_at: string | null
          applied_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          staff_id?: string | null
          suggestion_type: string
          target_date: string
          start_time?: string | null
          end_time?: string | null
          current_value?: Json | null
          suggested_value: Json
          reason: string
          impact_summary?: string | null
          priority?: string
          status?: string
          created_by?: string
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          applied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          staff_id?: string | null
          suggestion_type?: string
          target_date?: string
          start_time?: string | null
          end_time?: string | null
          current_value?: Json | null
          suggested_value?: Json
          reason?: string
          impact_summary?: string | null
          priority?: string
          status?: string
          created_by?: string
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          applied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_suggestions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_suggestions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
            foreignKeyName: "schedule_suggestions_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_rules: {
        Row: {
          id: string
          branch_id: string
          min_daily_staff: number
          min_daily_therapists: number
          min_daily_csr: number
          min_daily_drivers: number
          min_daily_utility: number
          default_days_off_per_week: number
          max_same_role_off_per_day: number
          max_therapists_off_per_day: number
          protect_weekends: boolean
          default_break_minutes: number
          auto_breaks_enabled: boolean
          max_working_hours_per_day: number
          max_services_per_staff_per_day: number | null
          auto_generate_breaks: boolean
          auto_generate_travel_buffers: boolean
          auto_generate_room_reset_buffers: boolean
          room_reset_buffer_minutes: number
          home_service_travel_buffer_minutes: number
          suggestions_require_manager_approval: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          min_daily_staff?: number
          min_daily_therapists?: number
          min_daily_csr?: number
          min_daily_drivers?: number
          min_daily_utility?: number
          default_days_off_per_week?: number
          max_same_role_off_per_day?: number
          max_therapists_off_per_day?: number
          protect_weekends?: boolean
          default_break_minutes?: number
          auto_breaks_enabled?: boolean
          max_working_hours_per_day?: number
          max_services_per_staff_per_day?: number | null
          auto_generate_breaks?: boolean
          auto_generate_travel_buffers?: boolean
          auto_generate_room_reset_buffers?: boolean
          room_reset_buffer_minutes?: number
          home_service_travel_buffer_minutes?: number
          suggestions_require_manager_approval?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          min_daily_staff?: number
          min_daily_therapists?: number
          min_daily_csr?: number
          min_daily_drivers?: number
          min_daily_utility?: number
          default_days_off_per_week?: number
          max_same_role_off_per_day?: number
          max_therapists_off_per_day?: number
          protect_weekends?: boolean
          default_break_minutes?: number
          auto_breaks_enabled?: boolean
          max_working_hours_per_day?: number
          max_services_per_staff_per_day?: number | null
          auto_generate_breaks?: boolean
          auto_generate_travel_buffers?: boolean
          auto_generate_room_reset_buffers?: boolean
          room_reset_buffer_minutes?: number
          home_service_travel_buffer_minutes?: number
          suggestions_require_manager_approval?: boolean
          created_at?: string
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
          auth_user_id: string | null
          branch_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          is_head: boolean
          phone: string | null
          staff_type: string
          system_role: string
          tier: string
          updated_at: string
          avatar_url: string | null
          avatar_path: string | null
        }
        Insert: {
          auth_user_id?: string | null
          branch_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          is_head?: boolean
          phone?: string | null
          staff_type?: string
          system_role?: string
          tier?: string
          updated_at?: string
          avatar_url?: string | null
          avatar_path?: string | null
        }
        Update: {
          auth_user_id?: string | null
          branch_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_head?: boolean
          phone?: string | null
          staff_type?: string
          system_role?: string
          tier?: string
          updated_at?: string
          avatar_url?: string | null
          avatar_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_onboarding_requests: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          address: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          experience_notes: string | null
          preferred_role: string | null
          requested_branch_id: string | null
          auth_user_id: string | null
          staff_id: string | null
          status: string
          reviewed_by_staff_id: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email: string
          phone?: string | null
          address?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_notes?: string | null
          preferred_role?: string | null
          requested_branch_id?: string | null
          auth_user_id?: string | null
          staff_id?: string | null
          status?: string
          reviewed_by_staff_id?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          address?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_notes?: string | null
          preferred_role?: string | null
          requested_branch_id?: string | null
          auth_user_id?: string | null
          staff_id?: string | null
          status?: string
          reviewed_by_staff_id?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          metadata?: Json
          created_at?: string
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
            foreignKeyName: "staff_onboarding_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_onboarding_requests_reviewed_by_staff_id_fkey"
            columns: ["reviewed_by_staff_id"]
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
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          staff_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          staff_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_scheduling_preferences: {
        Row: {
          id: string
          staff_id: string
          branch_id: string | null
          preferred_day_off: number | null
          secondary_preferred_day_off: number | null
          default_break_start: string | null
          default_break_end: string | null
          can_do_home_service: boolean
          can_drive: boolean
          max_services_per_day: number | null
          max_trips_per_day: number | null
          max_working_hours_per_day: number | null
          requires_manager_approval_for_changes: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          branch_id?: string | null
          preferred_day_off?: number | null
          secondary_preferred_day_off?: number | null
          default_break_start?: string | null
          default_break_end?: string | null
          can_do_home_service?: boolean
          can_drive?: boolean
          max_services_per_day?: number | null
          max_trips_per_day?: number | null
          max_working_hours_per_day?: number | null
          requires_manager_approval_for_changes?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          branch_id?: string | null
          preferred_day_off?: number | null
          secondary_preferred_day_off?: number | null
          default_break_start?: string | null
          default_break_end?: string | null
          can_do_home_service?: boolean
          can_drive?: boolean
          max_services_per_day?: number | null
          max_trips_per_day?: number | null
          max_working_hours_per_day?: number | null
          requires_manager_approval_for_changes?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_scheduling_preferences_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_scheduling_preferences_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tracking_links: {
        Row: {
          id: string
          booking_id: string
          branch_id: string | null
          customer_id: string | null
          token: string
          expires_at: string
          is_active: boolean
          access_count: number
          last_accessed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          branch_id?: string | null
          customer_id?: string | null
          token: string
          expires_at: string
          is_active?: boolean
          access_count?: number
          last_accessed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          branch_id?: string | null
          customer_id?: string | null
          token?: string
          expires_at?: string
          is_active?: boolean
          access_count?: number
          last_accessed_at?: string | null
          created_by?: string | null
          created_at?: string
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
            foreignKeyName: "customer_tracking_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tracking_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_location_snapshots: {
        Row: {
          id: string
          staff_id: string
          booking_id: string | null
          branch_id: string | null
          lat: number
          lng: number
          accuracy_meters: number | null
          recorded_at: string
          source: string
          metadata: Json
        }
        Insert: {
          id?: string
          staff_id: string
          booking_id?: string | null
          branch_id?: string | null
          lat: number
          lng: number
          accuracy_meters?: number | null
          recorded_at?: string
          source?: string
          metadata?: Json
        }
        Update: {
          id?: string
          staff_id?: string
          booking_id?: string | null
          branch_id?: string | null
          lat?: number
          lng?: number
          accuracy_meters?: number | null
          recorded_at?: string
          source?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_snapshots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
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
        ]
      }
      staff_pay_profiles: {
        Row: {
          id: string
          staff_id: string
          branch_id: string | null
          base_pay_amount: number
          base_pay_type: string
          commission_percent: number
          per_service_bonus: number
          home_service_allowance: number
          transport_allowance: number
          is_active: boolean
          effective_from: string
          effective_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          branch_id?: string | null
          base_pay_amount?: number
          base_pay_type?: string
          commission_percent?: number
          per_service_bonus?: number
          home_service_allowance?: number
          transport_allowance?: number
          is_active?: boolean
          effective_from?: string
          effective_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          branch_id?: string | null
          base_pay_amount?: number
          base_pay_type?: string
          commission_percent?: number
          per_service_bonus?: number
          home_service_allowance?: number
          transport_allowance?: number
          is_active?: boolean
          effective_from?: string
          effective_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          id: string
          branch_id: string | null
          period_start: string
          period_end: string
          status: string
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          paid_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id?: string | null
          period_start: string
          period_end: string
          status?: string
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          paid_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string | null
          period_start?: string
          period_end?: string
          status?: string
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          paid_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          id: string
          payroll_period_id: string
          staff_id: string
          branch_id: string | null
          completed_bookings_count: number
          home_service_bookings_count: number
          gross_revenue: number
          base_pay: number
          commission_pay: number
          bonus_pay: number
          reimbursement_pay: number
          home_service_allowance_pay: number
          deduction_amount: number
          salary_advance_amount: number
          net_pay: number
          status: string
          metadata: import("./supabase").Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payroll_period_id: string
          staff_id: string
          branch_id?: string | null
          completed_bookings_count?: number
          home_service_bookings_count?: number
          gross_revenue?: number
          base_pay?: number
          commission_pay?: number
          bonus_pay?: number
          reimbursement_pay?: number
          home_service_allowance_pay?: number
          deduction_amount?: number
          salary_advance_amount?: number
          net_pay?: number
          status?: string
          metadata?: import("./supabase").Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payroll_period_id?: string
          staff_id?: string
          branch_id?: string | null
          completed_bookings_count?: number
          home_service_bookings_count?: number
          gross_revenue?: number
          base_pay?: number
          commission_pay?: number
          bonus_pay?: number
          reimbursement_pay?: number
          home_service_allowance_pay?: number
          deduction_amount?: number
          salary_advance_amount?: number
          net_pay?: number
          status?: string
          metadata?: import("./supabase").Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          id: string
          payroll_item_id: string
          adjustment_type: string
          amount: number
          reason: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          payroll_item_id: string
          adjustment_type: string
          amount: number
          reason: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          payroll_item_id?: string
          adjustment_type?: string
          amount?: number
          reason?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_booking_end_time: {
        Args: { p_service_id: string; p_start_time: string }
        Returns: string
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
          staff_id: string
          staff_name: string
          staff_tier: string
          work_start: string
          work_end: string
          bookings: Json
          blocks: Json
        }[]
      }
      get_effective_price: {
        Args: { p_branch_id: string; p_service_id: string }
        Returns: number
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
  public: {
    Enums: {},
  },
} as const
