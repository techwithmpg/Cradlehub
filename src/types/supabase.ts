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
      bookings: {
        Row: {
          booking_date: string
          branch_id: string
          completed_at: string | null
          created_at: string
          customer_id: string
          end_time: string
          home_service_tracking_status: string
          id: string
          metadata: Json
          arrived_at: string | null
          service_id: string
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
          booking_date: string
          branch_id: string
          completed_at?: string | null
          created_at?: string
          customer_id: string
          end_time: string
          home_service_tracking_status?: string
          id?: string
          metadata?: Json
          arrived_at?: string | null
          service_id: string
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
          booking_date?: string
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          end_time?: string
          home_service_tracking_status?: string
          id?: string
          metadata?: Json
          arrived_at?: string | null
          service_id?: string
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
      branch_services: {
        Row: {
          branch_id: string
          created_at: string
          custom_price: number | null
          id: string
          is_active: boolean
          service_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          custom_price?: number | null
          id?: string
          is_active?: boolean
          service_id: string
        }
        Update: {
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
          phone: string | null
          slot_interval_minutes: number
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
          phone?: string | null
          slot_interval_minutes?: number
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
          phone?: string | null
          slot_interval_minutes?: number
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
      update_home_service_tracking: {
        Args: { p_booking_id: string; p_stage: string }
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
