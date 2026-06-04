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
          capture_type: string
          captured_at: string
          h3_index: string
          id: number
          ip_awarded: number
          prev_owner_id: string | null
          round_id: string | null
          user_id: string
        }
        Insert: {
          capture_type?: string
          captured_at?: string
          h3_index: string
          id?: never
          ip_awarded: number
          prev_owner_id?: string | null
          round_id?: string | null
          user_id: string
        }
        Update: {
          capture_type?: string
          captured_at?: string
          h3_index?: string
          id?: never
          ip_awarded?: number
          prev_owner_id?: string | null
          round_id?: string | null
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
      clan_join_requests: {
        Row: {
          clan_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: number
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: never
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: never
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_join_requests_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_messages: {
        Row: {
          body: string
          clan_id: string
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          body: string
          clan_id: string
          created_at?: string
          id?: never
          kind?: string
          user_id: string
        }
        Update: {
          body?: string
          clan_id?: string
          created_at?: string
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_messages_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          colour: string
          created_at: string
          description: string
          id: string
          member_count: number
          min_hexes: number
          min_points: number
          name: string
          owner_id: string | null
        }
        Insert: {
          colour?: string
          created_at?: string
          description?: string
          id?: string
          member_count?: number
          min_hexes?: number
          min_points?: number
          name: string
          owner_id?: string | null
        }
        Update: {
          colour?: string
          created_at?: string
          description?: string
          id?: string
          member_count?: number
          min_hexes?: number
          min_points?: number
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_activity: {
        Row: {
          ist_day: string
          rp_earned: number
          user_id: string
        }
        Insert: {
          ist_day: string
          rp_earned?: number
          user_id: string
        }
        Update: {
          ist_day?: string
          rp_earned?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: number
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: never
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: never
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hex_ownership: {
        Row: {
          block_until: string | null
          captured_at: string
          fresh_paint_until: string | null
          h3_index: string
          ip_value: number
          last_visited_at: string | null
          owner_id: string
        }
        Insert: {
          block_until?: string | null
          captured_at?: string
          fresh_paint_until?: string | null
          h3_index: string
          ip_value?: number
          last_visited_at?: string | null
          owner_id: string
        }
        Update: {
          block_until?: string | null
          captured_at?: string
          fresh_paint_until?: string | null
          h3_index?: string
          ip_value?: number
          last_visited_at?: string | null
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
          pph_value: number | null
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
          pph_value?: number | null
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
          pph_value?: number | null
        }
        Relationships: []
      }
      medals: {
        Row: {
          criteria_threshold: number
          criteria_type: string
          description: string
          id: string
          lp_reward: number
          name: string
          sort: number
          tier: string
        }
        Insert: {
          criteria_threshold?: number
          criteria_type: string
          description: string
          id: string
          lp_reward?: number
          name: string
          sort?: number
          tier: string
        }
        Update: {
          criteria_threshold?: number
          criteria_type?: string
          description?: string
          id?: string
          lp_reward?: number
          name?: string
          sort?: number
          tier?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: number
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: never
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: never
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_runs: {
        Row: {
          ran_at: string
          run_hour: string
          total_minted: number
          users_paid: number
        }
        Insert: {
          ran_at?: string
          run_hour: string
          total_minted: number
          users_paid: number
        }
        Update: {
          ran_at?: string
          run_hour?: string
          total_minted?: number
          users_paid?: number
        }
        Relationships: []
      }
      round_results: {
        Row: {
          points: number
          rank: number
          round_id: string
          snapshot_at: string
          user_id: string
        }
        Insert: {
          points: number
          rank: number
          round_id: string
          snapshot_at?: string
          user_id: string
        }
        Update: {
          points?: number
          rank?: number
          round_id?: string
          snapshot_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medals: {
        Row: {
          earned_at: string
          medal_id: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          medal_id: string
          user_id: string
        }
        Update: {
          earned_at?: string
          medal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medals_medal_id_fkey"
            columns: ["medal_id"]
            isOneToOne: false
            referencedRelation: "medals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_medals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          banned_permanently: boolean | null
          banned_until: string | null
          clan_id: string | null
          clan_role: string | null
          created_at: string | null
          current_held_hexes: number | null
          current_round_points: number | null
          current_streak: number | null
          daily_cap_remaining: number | null
          daily_cap_reset_at: string | null
          device_fingerprint: string | null
          display_name: string | null
          equipped_medal: string | null
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
          clan_role?: string | null
          created_at?: string | null
          current_held_hexes?: number | null
          current_round_points?: number | null
          current_streak?: number | null
          daily_cap_remaining?: number | null
          daily_cap_reset_at?: string | null
          device_fingerprint?: string | null
          display_name?: string | null
          equipped_medal?: string | null
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
          clan_role?: string | null
          created_at?: string | null
          current_held_hexes?: number | null
          current_round_points?: number | null
          current_streak?: number | null
          daily_cap_remaining?: number | null
          daily_cap_reset_at?: string | null
          device_fingerprint?: string | null
          display_name?: string | null
          equipped_medal?: string | null
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
        Relationships: [
          {
            foreignKeyName: "users_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_equipped_medal_fkey"
            columns: ["equipped_medal"]
            isOneToOne: false
            referencedRelation: "medals"
            referencedColumns: ["id"]
          },
        ]
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
          equipped_medal: string | null
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
          equipped_medal?: string | null
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
          equipped_medal?: string | null
          ghost_mode?: boolean | null
          hex_colour?: string | null
          id?: string | null
          level?: number | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_equipped_medal_fkey"
            columns: ["equipped_medal"]
            isOneToOne: false
            referencedRelation: "medals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_medal: {
        Args: { p_cond: boolean; p_key: string; p_uid: string }
        Returns: undefined
      }
      cancel_join_request: { Args: { p_request_id: number }; Returns: Json }
      capture_hex: {
        Args: { p_h3: string; p_lat: number; p_lng: number }
        Returns: Json
      }
      check_level_up: { Args: { p_uid: string }; Returns: undefined }
      check_medals: { Args: { p_uid: string }; Returns: undefined }
      clan_display_name: { Args: { p_id: string }; Returns: string }
      clan_log: {
        Args: { p_actor: string; p_body: string; p_clan_id: string }
        Returns: undefined
      }
      clan_members: {
        Args: { p_clan_id: string }
        Returns: {
          avatar_url: string | null
          current_round_points: number | null
          display_name: string | null
          equipped_medal: string | null
          ghost_mode: boolean | null
          hex_colour: string | null
          id: string | null
          level: number | null
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "public_users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clan_roster: {
        Args: { p_clan_id: string }
        Returns: {
          clan_role: string
          current_round_points: number
          display_name: string
          hex_colour: string
          id: string
          level: number
          username: string
        }[]
      }
      clan_stats: {
        Args: { p_clan_id: string }
        Returns: {
          clan_id: string
          member_count: number
          name: string
          total_hexes: number
          total_points: number
        }[]
      }
      clans_leaderboard: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          clan_id: string
          colour: string
          member_count: number
          name: string
          rank: number
          total_hexes: number
          total_points: number
        }[]
      }
      create_clan: {
        Args: {
          p_colour: string
          p_description?: string
          p_min_hexes?: number
          p_min_points?: number
          p_name: string
        }
        Returns: Json
      }
      disband_clan: { Args: never; Returns: Json }
      equip_medal: { Args: { p_medal_id: string }; Returns: undefined }
      grant_points: {
        Args: { p_lp_extra?: number; p_rp: number; p_uid: string }
        Returns: undefined
      }
      hexa_point_in_hex: {
        Args: { p_boundary: Json; p_lat: number; p_lng: number }
        Returns: boolean
      }
      hexes_in_bbox: {
        Args: {
          p_limit?: number
          p_max_lat: number
          p_max_lng: number
          p_min_lat: number
          p_min_lng: number
        }
        Returns: {
          boundary: Json
          center_lat: number
          center_lng: number
          h3_index: string
          owner: string
          pincode: string
        }[]
      }
      join_clan: { Args: { p_clan_id: string }; Returns: Json }
      kick_member: { Args: { p_target_user_id: string }; Returns: Json }
      leave_clan: { Args: never; Returns: Json }
      level_for_lp: { Args: { p_lp: number }; Returns: number }
      level_name: { Args: { p_level: number }; Returns: string }
      mark_notifications_read: { Args: never; Returns: undefined }
      my_rent_rate: { Args: never; Returns: number }
      request_to_join: {
        Args: { p_clan_id: string; p_message?: string }
        Returns: Json
      }
      reset_round: { Args: { p_round_id?: string }; Returns: Json }
      respond_join_request: {
        Args: { p_accept: boolean; p_request_id: number }
        Returns: Json
      }
      run_hourly_economy: { Args: never; Returns: Json }
      set_member_role: {
        Args: { p_role: string; p_target_user_id: string }
        Returns: Json
      }
      update_clan: {
        Args: {
          p_colour?: string
          p_description?: string
          p_min_hexes?: number
          p_min_points?: number
          p_name?: string
        }
        Returns: Json
      }
      update_streak_if_needed: { Args: { p_uid: string }; Returns: undefined }
      user_card: {
        Args: { p_id: string }
        Returns: {
          captures: number
          clan_id: string
          clan_name: string
          clan_role: string
          current_round_points: number
          display_name: string
          equipped_medal: string
          friendship: string
          friendship_id: number
          ghost_mode: boolean
          hex_colour: string
          id: string
          level: number
          username: string
        }[]
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
