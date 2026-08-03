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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          points_reward: number
          requirement_type: string
          requirement_value: number
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          points_reward?: number
          requirement_type: string
          requirement_value: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          points_reward?: number
          requirement_type?: string
          requirement_value?: number
          title?: string
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      aspirations: {
        Row: {
          content: string
          created_at: string
          id: string
          status: string
          student_class: string | null
          student_name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          status?: string
          student_class?: string | null
          student_name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          status?: string
          student_class?: string | null
          student_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenge_completions: {
        Row: {
          challenge_id: string
          completed_at: string
          id: string
          score_achieved: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          id?: string
          score_achieved: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          id?: string
          score_achieved?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          is_system: boolean | null
          message: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          message: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          message?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          admin_id: string
          aspiration_id: string
          comment_text: string
          created_at: string
          id: string
        }
        Insert: {
          admin_id: string
          aspiration_id: string
          comment_text: string
          created_at?: string
          id?: string
        }
        Update: {
          admin_id?: string
          aspiration_id?: string
          comment_text?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_aspiration_id_fkey"
            columns: ["aspiration_id"]
            isOneToOne: false
            referencedRelation: "aspirations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_challenges: {
        Row: {
          bonus_points: number
          challenge_date: string
          created_at: string
          description: string
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          target_score: number
          title: string
        }
        Insert: {
          bonus_points?: number
          challenge_date: string
          created_at?: string
          description: string
          game_type: Database["public"]["Enums"]["game_type"]
          id?: string
          target_score: number
          title: string
        }
        Update: {
          bonus_points?: number
          challenge_date?: string
          created_at?: string
          description?: string
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          target_score?: number
          title?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      game_rooms: {
        Row: {
          created_at: string | null
          ended_at: string | null
          game_type: Database["public"]["Enums"]["game_type"]
          host_id: string
          id: string
          is_private: boolean | null
          max_players: number | null
          room_code: string
          started_at: string | null
          status: Database["public"]["Enums"]["room_status"] | null
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          game_type: Database["public"]["Enums"]["game_type"]
          host_id: string
          id?: string
          is_private?: boolean | null
          max_players?: number | null
          room_code: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["room_status"] | null
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          game_type?: Database["public"]["Enums"]["game_type"]
          host_id?: string
          id?: string
          is_private?: boolean | null
          max_players?: number | null
          room_code?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["room_status"] | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          room_id: string | null
          total_players: number
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          game_type: Database["public"]["Enums"]["game_type"]
          id?: string
          room_id?: string | null
          total_players: number
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          room_id?: string | null
          total_players?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      player_badges: {
        Row: {
          badge_description: string
          badge_icon: string
          badge_name: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_description: string
          badge_icon: string
          badge_name: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_description?: string
          badge_icon?: string
          badge_name?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      player_items: {
        Row: {
          id: string
          power_up_id: string
          purchased_at: string
          quantity: number
          user_id: string
        }
        Insert: {
          id?: string
          power_up_id: string
          purchased_at?: string
          quantity?: number
          user_id: string
        }
        Update: {
          id?: string
          power_up_id?: string
          purchased_at?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_items_power_up_id_fkey"
            columns: ["power_up_id"]
            isOneToOne: false
            referencedRelation: "power_ups"
            referencedColumns: ["id"]
          },
        ]
      }
      player_rankings: {
        Row: {
          achieved_at: string
          id: string
          min_points: number
          rank_icon: string
          rank_name: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          id?: string
          min_points: number
          rank_icon: string
          rank_name: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          min_points?: number
          rank_icon?: string
          rank_name?: string
          user_id?: string
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          created_at: string | null
          highest_streak: number | null
          id: string
          total_games_played: number | null
          total_points: number | null
          total_wins: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          highest_streak?: number | null
          id?: string
          total_games_played?: number | null
          total_points?: number | null
          total_wins?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          highest_streak?: number | null
          id?: string
          total_games_played?: number | null
          total_points?: number | null
          total_wins?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      power_ups: {
        Row: {
          cost: number
          created_at: string
          description: string
          effect_type: string
          effect_value: number
          icon: string
          id: string
          name: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          effect_type: string
          effect_value?: number
          icon: string
          id?: string
          name: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          effect_type?: string
          effect_value?: number
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      room_players: {
        Row: {
          id: string
          is_ready: boolean | null
          joined_at: string | null
          room_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          room_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string | null
          room_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      session_scores: {
        Row: {
          created_at: string | null
          id: string
          rank: number | null
          score: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rank?: number | null
          score: number
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rank?: number | null
          score?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      special_events: {
        Row: {
          bonus_multiplier: number
          created_at: string
          description: string
          end_date: string
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          start_date: string
          title: string
        }
        Insert: {
          bonus_multiplier?: number
          created_at?: string
          description: string
          end_date: string
          game_type: Database["public"]["Enums"]["game_type"]
          id?: string
          start_date: string
          title: string
        }
        Update: {
          bonus_multiplier?: number
          created_at?: string
          description?: string
          end_date?: string
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          start_date?: string
          title?: string
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
      generate_room_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "developer"
      game_type: "brain_rush" | "pattern_master" | "word_sprint"
      room_status: "waiting" | "playing" | "finished"
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
    Enums: {
      app_role: ["admin", "developer"],
      game_type: ["brain_rush", "pattern_master", "word_sprint"],
      room_status: ["waiting", "playing", "finished"],
    },
  },
} as const
