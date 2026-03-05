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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      emergency_alerts: {
        Row: {
          acknowledged: boolean | null
          alert_reasons: string[] | null
          alert_type: string
          created_at: string
          drowsiness_level: string
          drowsiness_score: number | null
          ear: number | null
          id: string
          perclos: number | null
          session_id: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          alert_reasons?: string[] | null
          alert_type?: string
          created_at?: string
          drowsiness_level?: string
          drowsiness_score?: number | null
          ear?: number | null
          id?: string
          perclos?: number | null
          session_id?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          alert_reasons?: string[] | null
          alert_type?: string
          created_at?: string
          drowsiness_level?: string
          drowsiness_score?: number | null
          ear?: number | null
          id?: string
          perclos?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          session_id: string | null
          severity: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          session_id?: string | null
          severity?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          session_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_summary: {
        Row: {
          avg_ear: number | null
          avg_mar: number | null
          avg_perclos: number | null
          created_at: string
          id: string
          max_drowsiness_score: number | null
          session_id: string | null
          total_blinks: number | null
          total_microsleeps: number | null
          total_nods: number | null
          total_yawns: number | null
          updated_at: string
        }
        Insert: {
          avg_ear?: number | null
          avg_mar?: number | null
          avg_perclos?: number | null
          created_at?: string
          id?: string
          max_drowsiness_score?: number | null
          session_id?: string | null
          total_blinks?: number | null
          total_microsleeps?: number | null
          total_nods?: number | null
          total_yawns?: number | null
          updated_at?: string
        }
        Update: {
          avg_ear?: number | null
          avg_mar?: number | null
          avg_perclos?: number | null
          created_at?: string
          id?: string
          max_drowsiness_score?: number | null
          session_id?: string | null
          total_blinks?: number | null
          total_microsleeps?: number | null
          total_nods?: number | null
          total_yawns?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_summary_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          driver_id: string
          ended_at: string | null
          id: string
          started_at: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      telemetry_raw: {
        Row: {
          id: string
          raw_payload: Json
          received_at: string
          session_id: string | null
          topic: string
        }
        Insert: {
          id?: string
          raw_payload?: Json
          received_at?: string
          session_id?: string | null
          topic?: string
        }
        Update: {
          id?: string
          raw_payload?: Json
          received_at?: string
          session_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_raw_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
