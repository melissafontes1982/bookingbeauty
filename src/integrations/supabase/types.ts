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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          buffer_min: number
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          end_time: string
          id: string
          manage_token: string
          notes: string | null
          professional_id: string | null
          professional_name: string | null
          service_id: string | null
          service_name: string
          start_time: string
          status: string
        }
        Insert: {
          appointment_date: string
          buffer_min?: number
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          end_time: string
          id?: string
          manage_token?: string
          notes?: string | null
          professional_id?: string | null
          professional_name?: string | null
          service_id?: string | null
          service_name: string
          start_time: string
          status?: string
        }
        Update: {
          appointment_date?: string
          buffer_min?: number
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          end_time?: string
          id?: string
          manage_token?: string
          notes?: string | null
          professional_id?: string | null
          professional_name?: string | null
          service_id?: string | null
          service_name?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_packages: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          notes: string | null
          total_sessions: number
          used_sessions: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          notes?: string | null
          total_sessions?: number
          used_sessions?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          notes?: string | null
          total_sessions?: number
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          nif: string | null
          notes: string | null
          phone: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          nif?: string | null
          notes?: string | null
          phone: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          notes?: string | null
          phone?: string
        }
        Relationships: []
      }
      general_settings: {
        Row: {
          business_segment: string
          company_name: string
          contact_instructions: string
          id: number
          logo_url: string | null
          message_templates: Json
          theme_background: string | null
          theme_button: string | null
          theme_button_text: string | null
          theme_primary: string | null
          theme_text: string | null
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          business_segment?: string
          company_name?: string
          contact_instructions?: string
          id?: number
          logo_url?: string | null
          message_templates?: Json
          theme_background?: string | null
          theme_button?: string | null
          theme_button_text?: string | null
          theme_primary?: string | null
          theme_text?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          business_segment?: string
          company_name?: string
          contact_instructions?: string
          id?: number
          logo_url?: string | null
          message_templates?: Json
          theme_background?: string | null
          theme_button?: string | null
          theme_button_text?: string | null
          theme_primary?: string | null
          theme_text?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      package_sessions: {
        Row: {
          appointment_id: string | null
          id: string
          note: string | null
          package_id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          id?: string
          note?: string | null
          package_id: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          id?: string
          note?: string | null
          package_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_sessions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "client_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          professional_id: string
          service_id: string
        }
        Insert: {
          professional_id: string
          service_id: string
        }
        Update: {
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          id: string
          name: string
          phone: string
          photo_url: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string
          photo_url?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          block_date: string
          created_at: string
          end_time: string
          id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          block_date: string
          created_at?: string
          end_time?: string
          id?: string
          reason?: string | null
          start_time?: string
        }
        Update: {
          block_date?: string
          created_at?: string
          end_time?: string
          id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: []
      }
      schedule_settings: {
        Row: {
          break_end: string | null
          break_start: string | null
          close_time: string
          is_open: boolean
          open_time: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          is_open?: boolean
          open_time?: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          is_open?: boolean
          open_time?: string
          weekday?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          buffer_min: number
          created_at: string
          description: string | null
          description_en: string | null
          duration_min: number
          id: string
          name: string
          name_en: string | null
          price: number
        }
        Insert: {
          active?: boolean
          buffer_min?: number
          created_at?: string
          description?: string | null
          description_en?: string | null
          duration_min?: number
          id?: string
          name: string
          name_en?: string | null
          price?: number
        }
        Update: {
          active?: boolean
          buffer_min?: number
          created_at?: string
          description?: string | null
          description_en?: string | null
          duration_min?: number
          id?: string
          name?: string
          name_en?: string | null
          price?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_authorized_admin: { Args: never; Returns: boolean }
      get_public_professionals: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      public_available_slots: {
        Args: { _date: string; _professional_id?: string; _service_id: string }
        Returns: string[]
      }
      public_create_booking: {
        Args: {
          _birth_date?: string
          _date: string
          _email?: string
          _name: string
          _nif?: string
          _notes?: string
          _phone: string
          _professional_id: string
          _service_id: string
          _time: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
