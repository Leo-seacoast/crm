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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          changes: Json | null
          context: Json | null
          id: number
          occurred_at: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          changes?: Json | null
          context?: Json | null
          id?: never
          occurred_at?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          changes?: Json | null
          context?: Json | null
          id?: never
          occurred_at?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          archived_at: string | null
          business_name: string | null
          created_at: string
          created_by: string | null
          daily_summary_enabled: boolean
          daily_summary_hour: number
          id: string
          owner_id: string | null
          singleton: boolean
          time_zone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          daily_summary_enabled?: boolean
          daily_summary_hour?: number
          id?: string
          owner_id?: string | null
          singleton?: boolean
          time_zone?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          daily_summary_enabled?: boolean
          daily_summary_hour?: number
          id?: string
          owner_id?: string | null
          singleton?: boolean
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          extra_fields: Json
          ghl_id: string | null
          id: string
          import_id: string | null
          name: string
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          search_text: string | null
          tags: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          extra_fields?: Json
          ghl_id?: string | null
          id?: string
          import_id?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          search_text?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          extra_fields?: Json
          ghl_id?: string | null
          id?: string
          import_id?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          search_text?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          email_consent: Database["public"]["Enums"]["consent_status"]
          email_consent_at: string | null
          email_consent_source: string | null
          extra_fields: Json
          first_name: string | null
          ghl_id: string | null
          id: string
          import_id: string | null
          last_name: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          search_text: string | null
          sms_consent: Database["public"]["Enums"]["consent_status"]
          sms_consent_at: string | null
          sms_consent_source: string | null
          source: string | null
          tags: string[]
          time_zone: string | null
          types: Database["public"]["Enums"]["contact_type"][]
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_consent?: Database["public"]["Enums"]["consent_status"]
          email_consent_at?: string | null
          email_consent_source?: string | null
          extra_fields?: Json
          first_name?: string | null
          ghl_id?: string | null
          id?: string
          import_id?: string | null
          last_name?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          search_text?: string | null
          sms_consent?: Database["public"]["Enums"]["consent_status"]
          sms_consent_at?: string | null
          sms_consent_source?: string | null
          source?: string | null
          tags?: string[]
          time_zone?: string | null
          types?: Database["public"]["Enums"]["contact_type"][]
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_consent?: Database["public"]["Enums"]["consent_status"]
          email_consent_at?: string | null
          email_consent_source?: string | null
          extra_fields?: Json
          first_name?: string | null
          ghl_id?: string | null
          id?: string
          import_id?: string | null
          last_name?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          search_text?: string | null
          sms_consent?: Database["public"]["Enums"]["consent_status"]
          sms_consent_at?: string | null
          sms_consent_source?: string | null
          source?: string | null
          tags?: string[]
          time_zone?: string | null
          types?: Database["public"]["Enums"]["contact_type"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          archived_at: string | null
          closed_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          expected_close_date: string | null
          extra_fields: Json
          ghl_id: string | null
          id: string
          import_id: string | null
          owner_id: string | null
          pipeline_id: string
          stage_id: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          archived_at?: string | null
          closed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_close_date?: string | null
          extra_fields?: Json
          ghl_id?: string | null
          id?: string
          import_id?: string | null
          owner_id?: string | null
          pipeline_id: string
          stage_id: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          archived_at?: string | null
          closed_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_close_date?: string | null
          extra_fields?: Json
          ghl_id?: string | null
          id?: string
          import_id?: string | null
          owner_id?: string | null
          pipeline_id?: string
          stage_id?: string
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_pipeline_id_fkey"
            columns: ["stage_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id", "pipeline_id"]
          },
        ]
      }
      imports: {
        Row: {
          archived_at: string | null
          companies_created: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_count: number
          error_count: number
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["import_kind"]
          owner_id: string | null
          settings: Json
          skipped_count: number
          source: string
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number
          undone_at: string | null
          updated_at: string
          updated_count: number
        }
        Insert: {
          archived_at?: string | null
          companies_created?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_count?: number
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["import_kind"]
          owner_id?: string | null
          settings?: Json
          skipped_count?: number
          source?: string
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          undone_at?: string | null
          updated_at?: string
          updated_count?: number
        }
        Update: {
          archived_at?: string | null
          companies_created?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_count?: number
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["import_kind"]
          owner_id?: string | null
          settings?: Json
          skipped_count?: number
          source?: string
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number
          undone_at?: string | null
          updated_at?: string
          updated_count?: number
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived_at: string | null
          body: string
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          id: string
          import_id: string | null
          owner_id: string | null
          pinned: boolean
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          import_id?: string | null
          owner_id?: string | null
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          id?: string
          import_id?: string | null
          owner_id?: string | null
          pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["stage_kind"]
          name: string
          owner_id: string | null
          pipeline_id: string
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["stage_kind"]
          name: string
          owner_id?: string | null
          pipeline_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["stage_kind"]
          name?: string
          owner_id?: string | null
          pipeline_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          owner_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          owner_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          owner_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string | null
          id: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived_at: string | null
          company_id: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          details: string | null
          due_date: string
          due_time: string | null
          id: string
          owner_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          details?: string | null
          due_date: string
          due_time?: string | null
          id?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          details?: string | null
          due_date?: string
          due_time?: string | null
          id?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_standard_triggers: { Args: { target: unknown }; Returns: undefined }
      begin_import_context: {
        Args: { p_import_id: string; p_what: string }
        Returns: undefined
      }
      current_actor_type: {
        Args: never
        Returns: Database["public"]["Enums"]["actor_type"]
      }
      find_existing_contacts: {
        Args: { p_emails: string[]; p_ghl_ids: string[]; p_phones: string[] }
        Returns: {
          email: string
          first_name: string
          ghl_id: string
          id: string
          last_name: string
          phone: string
        }[]
      }
      finish_import: {
        Args: { p_import_id: string; p_skipped_in_preview: number }
        Returns: undefined
      }
      import_companies: {
        Args: { p_import_id: string; p_names: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      import_contacts_batch: {
        Args: { p_import_id: string; p_rows: Json }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      log_export: {
        Args: { p_filters: Json; p_row_count: number; p_table: string }
        Returns: undefined
      }
      require_admin: { Args: never; Returns: undefined }
      require_open_import: {
        Args: {
          p_import_id: string
          p_kind: Database["public"]["Enums"]["import_kind"]
        }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      start_import: {
        Args: {
          p_file_name: string
          p_kind: Database["public"]["Enums"]["import_kind"]
          p_settings: Json
          p_total_rows: number
        }
        Returns: string
      }
      undo_import_step: {
        Args: { p_import_id: string; p_limit?: number }
        Returns: Json
      }
    }
    Enums: {
      actor_type: "user" | "system" | "automation"
      app_role: "admin" | "member"
      consent_status: "unknown" | "opted_in" | "opted_out"
      contact_type: "lead" | "client" | "owner" | "guest" | "vendor" | "partner"
      import_kind: "contacts" | "companies" | "deals" | "notes"
      import_status: "in_progress" | "completed" | "undone"
      stage_kind: "open" | "won" | "lost"
      task_status: "open" | "done"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_type: ["user", "system", "automation"],
      app_role: ["admin", "member"],
      consent_status: ["unknown", "opted_in", "opted_out"],
      contact_type: ["lead", "client", "owner", "guest", "vendor", "partner"],
      import_kind: ["contacts", "companies", "deals", "notes"],
      import_status: ["in_progress", "completed", "undone"],
      stage_kind: ["open", "won", "lost"],
      task_status: ["open", "done"],
    },
  },
} as const
