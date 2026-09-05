export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_config: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          key: string;
          knowledge: string | null;
          prompt: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          key: string;
          knowledge?: string | null;
          prompt?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          key?: string;
          knowledge?: string | null;
          prompt?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          contact: string;
          cpm_id: string;
          cpm_nickname: string;
          created_at: string;
          experience: string | null;
          id: string;
          message: string | null;
          reviewed_by: string | null;
          state: string;
          updated_at: string;
        };
        Insert: {
          contact: string;
          cpm_id: string;
          cpm_nickname: string;
          created_at?: string;
          experience?: string | null;
          id?: string;
          message?: string | null;
          reviewed_by?: string | null;
          state?: string;
          updated_at?: string;
        };
        Update: {
          contact?: string;
          cpm_id?: string;
          cpm_nickname?: string;
          created_at?: string;
          experience?: string | null;
          id?: string;
          message?: string | null;
          reviewed_by?: string | null;
          state?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: string | null;
          created_at: string;
          detail: string | null;
          id: string;
          result: string;
          severity: string;
          target: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: string | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          result?: string;
          severity?: string;
          target?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          created_at?: string;
          detail?: string | null;
          id?: string;
          result?: string;
          severity?: string;
          target?: string | null;
        };
        Relationships: [];
      };
      garage_vehicles: {
        Row: {
          build: string | null;
          category: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          model: string;
          owner_member_id: string | null;
          owner_name: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          build?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          model: string;
          owner_member_id?: string | null;
          owner_name?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          build?: string | null;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          model?: string;
          owner_member_id?: string | null;
          owner_name?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "garage_vehicles_owner_member_id_fkey";
            columns: ["owner_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      meet_credentials: {
        Row: {
          created_at: string;
          meet_id: string;
          room_id: string;
          room_password: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          meet_id: string;
          room_id: string;
          room_password: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          meet_id?: string;
          room_id?: string;
          room_password?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "meet_credentials_meet_id_fkey";
            columns: ["meet_id"];
            isOneToOne: true;
            referencedRelation: "meets";
            referencedColumns: ["id"];
          },
        ];
      };
      meet_registrations: {
        Row: {
          cpm_id: string;
          cpm_nickname: string;
          created_at: string;
          id: string;
          meet_id: string;
          member_id: string | null;
          updated_at: string;
          verified: boolean;
        };
        Insert: {
          cpm_id: string;
          cpm_nickname: string;
          created_at?: string;
          id?: string;
          meet_id: string;
          member_id?: string | null;
          updated_at?: string;
          verified?: boolean;
        };
        Update: {
          cpm_id?: string;
          cpm_nickname?: string;
          created_at?: string;
          id?: string;
          meet_id?: string;
          member_id?: string | null;
          updated_at?: string;
          verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "meet_registrations_meet_id_fkey";
            columns: ["meet_id"];
            isOneToOne: false;
            referencedRelation: "meets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meet_registrations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      meets: {
        Row: {
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          id: string;
          registration_closes_at: string | null;
          scheduled_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          registration_closes_at?: string | null;
          scheduled_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          registration_closes_at?: string | null;
          scheduled_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      members: {
        Row: {
          cpm_id: string;
          cpm_nickname: string;
          created_at: string;
          created_by: string | null;
          id: string;
          joined_at: string | null;
          role: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          cpm_id: string;
          cpm_nickname: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cpm_id?: string;
          cpm_nickname?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      music_tracks: {
        Row: {
          artist: string | null;
          created_at: string;
          created_by: string | null;
          duration_seconds: number | null;
          id: string;
          sort_order: number;
          source_url: string | null;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          artist?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          id?: string;
          sort_order?: number;
          source_url?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          artist?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          id?: string;
          sort_order?: number;
          source_url?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_first_owner: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      meet_participants: {
        Args: { _meet_id: string };
        Returns: {
          cpm_nickname: string;
          registered_at: string;
        }[];
      };
      meet_public_active: {
        Args: never;
        Returns: {
          capacity: number;
          id: string;
          registered_count: number;
          registration_closes_at: string;
          scheduled_at: string;
          status: string;
          title: string;
        }[];
      };
      meet_register: {
        Args: { _cpm_id: string; _cpm_nickname: string; _meet_id: string };
        Returns: string;
      };
      owner_exists: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "owner" | "admin" | "moderator";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "moderator"],
    },
  },
} as const;
