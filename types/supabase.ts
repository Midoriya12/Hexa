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
      captures: {
        Row: {
          captured_at: string
          h3_index: string
          id: number
          ip_awarded: number
          prev_owner_id: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string
          h3_index: string
          id?: never
          ip_awarded: number
          prev_owner_id?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string
          h3_index?: string
          id?: never
          ip_awarded?: number
          prev_owner_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_h3_index_fkey"
            columns: ["h3_index"]
            isOneToOne: false
            referencedRelation: "hexes"
            referencedColumns: ["h3_index"]
          },
          {
            foreignKeyName: "captures_prev_owner_id_fkey"
            columns: ["prev_owner_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_prev_owner_id_fkey"
            columns: ["prev_owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hex_ownership: {
        Row: {
          captured_at: string
          h3_index: string
          ip_value: number
          owner_id: string
        }
        Insert: {
          captured_at?: string
          h3_index: string
          ip_value?: number
          owner_id: string
        }
        Update: {
          captured_at?: string
          h3_index?: string
          ip_value?: number
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hex_ownership_h3_index_fkey"
            columns: ["h3_index"]
            isOneToOne: true
            referencedRelation: "hexes"
            referencedColumns: ["h3_index"]
          },
          {
            foreignKeyName: "hex_ownership_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hex_ownership_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hexes: {
        Row: {
          boundary: Json
          capture_lat: number
          capture_lng: number
          center_lat: number
          center_lng: number
          created_at: string | null
          h3_index: string
          is_active: boolean | null
          neighbourhood: string | null
          pincode: string | null
        }
        Insert: {
          boundary: Json
          capture_lat: number
          capture_lng: number
          center_lat: number
          center_lng: number
          created_at?: string | null
          h3_index: string
          is_active?: boolean | null
          neighbourhood?: string | null
          pincode?: string | null
        }
        Update: {
          boundary?: Json
          capture_lat?: number
          capture_lng?: number
          center_lat?: number
          center_lng?: number
          created_at?: string | null
          h3_index?: string
          is_active?: boolean | null
          neighbourhood?: string | null
          pincode?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          banned_permanently: boolean | null
          banned_until: string | null
          clan_id: string | null
          created_at: string | null
          current_held_hexes: number | null
          current_round_points: number | null
          current_streak: number | null
          daily_cap_remaining: number | null
          daily_cap_reset_at: string | null
          device_fingerprint: string | null
          display_name: string | null
          flags: Json | null
          ghost_mode: boolean | null
          hex_colour: string | null
          home_neighbourhood: string | null
          id: string
          language_pref: string | null
          last_capture_at: string | null
          level: number | null
          lifetime_points: number | null
          longest_streak: number | null
          notification_prefs: Json | null
          phone: string
          pincode: string | null
          streak_freezes_available: number | null
          strikes: number | null
          updated_at: string | null
          username: string | null
          vacation_tokens_available: number | null
        }
        Insert: {
          avatar_url?: string | null
          banned_permanently?: boolean | null
          banned_until?: string | null
          clan_id?: string | null
          created_at?: string | null
          current_held_hexes?: number | null
          current_round_points?: number | null
          current_streak?: number | null
          daily_cap_remaining?: number | null
          daily_cap_reset_at?: string | null
          device_fingerprint?: string | null
          display_name?: string | null
          flags?: Json | null
          ghost_mode?: boolean | null
          hex_colour?: string | null
          home_neighbourhood?: string | null
          id: string
          language_pref?: string | null
          last_capture_at?: string | null
          level?: number | null
          lifetime_points?: number | null
          longest_streak?: number | null
          notification_prefs?: Json | null
          phone: string
          pincode?: string | null
          streak_freezes_available?: number | null
          strikes?: number | null
          updated_at?: string | null
          username?: string | null
          vacation_tokens_available?: number | null
        }
        Update: {
          avatar_url?: string | null
          banned_permanently?: boolean | null
          banned_until?: string | null
          clan_id?: string | null
          created_at?: string | null
          current_held_hexes?: number | null
          current_round_points?: number | null
          current_streak?: number | null
          daily_cap_remaining?: number | null
          daily_cap_reset_at?: string | null
          device_fingerprint?: string | null
          display_name?: string | null
          flags?: Json | null
          ghost_mode?: boolean | null
          hex_colour?: string | null
          home_neighbourhood?: string | null
          id?: string
          language_pref?: string | null
          last_capture_at?: string | null
          level?: number | null
          lifetime_points?: number | null
          longest_streak?: number | null
          notification_prefs?: Json | null
          phone?: string
          pincode?: string | null
          streak_freezes_available?: number | null
          strikes?: number | null
          updated_at?: string | null
          username?: string | null
          vacation_tokens_available?: number | null
        }
        Relationships: []
      }
      walks: {
        Row: {
          distance_m: number
          duration_s: number
          ended_at: string
          hexes: number
          id: number
          points: number
          user_id: string
        }
        Insert: {
          distance_m: number
          duration_s: number
          ended_at?: string
          hexes: number
          id?: never
          points: number
          user_id: string
        }
        Update: {
          distance_m?: number
          duration_s?: number
          ended_at?: string
          hexes?: number
          id?: never
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "walks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_users: {
        Row: {
          avatar_url: string | null
          current_round_points: number | null
          display_name: string | null
          ghost_mode: boolean | null
          hex_colour: string | null
          id: string | null
          level: number | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          current_round_points?: number | null
          display_name?: string | null
          ghost_mode?: boolean | null
          hex_colour?: string | null
          id?: string | null
          level?: number | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          current_round_points?: number | null
          display_name?: string | null
          ghost_mode?: boolean | null
          hex_colour?: string | null
          id?: string | null
          level?: number | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      capture_hex: {
        Args: { p_h3: string; p_lat: number; p_lng: number }
        Returns: Json
      }
      hexa_point_in_hex: {
        Args: { p_boundary: Json; p_lat: number; p_lng: number }
        Returns: boolean
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
