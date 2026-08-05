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
      categories: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      commitments: {
        Row: {
          amount: number
          category: string
          created_at: string
          debt_id: string | null
          id: string
          item_name: string
          last_paid_date: string | null
          next_due_date: string | null
          notes: string | null
          paid: boolean
          payment_method: string
          prev_due_date: string | null
          store: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          debt_id?: string | null
          id?: string
          item_name: string
          last_paid_date?: string | null
          next_due_date?: string | null
          notes?: string | null
          paid?: boolean
          payment_method?: string
          prev_due_date?: string | null
          store?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          debt_id?: string | null
          id?: string
          item_name?: string
          last_paid_date?: string | null
          next_due_date?: string | null
          notes?: string | null
          paid?: boolean
          payment_method?: string
          prev_due_date?: string | null
          store?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_items: {
        Row: {
          created_at: string
          debt_id: string
          id: string
          item_name: string
          price: number
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          id?: string
          item_name: string
          price?: number
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          id?: string
          item_name?: string
          price?: number
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_items_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          id: string
          installment_dates: Json
          installments_total: number | null
          kind: string
          name: string
          notes: string | null
          payments: Json
          start_date: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          installment_dates?: Json
          installments_total?: number | null
          kind?: string
          name: string
          notes?: string | null
          payments?: Json
          start_date?: string | null
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          installment_dates?: Json
          installments_total?: number | null
          kind?: string
          name?: string
          notes?: string | null
          payments?: Json
          start_date?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_version: string | null
          attachment_path: string | null
          created_at: string
          email: string | null
          email_sent: boolean
          email_sent_at: string | null
          id: string
          message: string
          route: string | null
          severity: string | null
          subject: string
          type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          attachment_path?: string | null
          created_at?: string
          email?: string | null
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          message: string
          route?: string | null
          severity?: string | null
          subject: string
          type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          attachment_path?: string | null
          created_at?: string
          email?: string | null
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          message?: string
          route?: string | null
          severity?: string | null
          subject?: string
          type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          notes: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payments: Json
          person_name: string
          start_date: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payments?: Json
          person_name: string
          start_date?: string | null
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payments?: Json
          person_name?: string
          start_date?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_beta_disclaimer_at: string | null
          accepted_privacy_at: string | null
          country: string
          created_at: string
          currency: string
          currency_symbol: string | null
          display_name: string
          full_name: string
          heard_about: string | null
          id: string
          symbol_position: string
          theme: string
          updated_at: string
        }
        Insert: {
          accepted_beta_disclaimer_at?: string | null
          accepted_privacy_at?: string | null
          country?: string
          created_at?: string
          currency?: string
          currency_symbol?: string | null
          display_name?: string
          full_name?: string
          heard_about?: string | null
          id: string
          symbol_position?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          accepted_beta_disclaimer_at?: string | null
          accepted_privacy_at?: string | null
          country?: string
          created_at?: string
          currency?: string
          currency_symbol?: string | null
          display_name?: string
          full_name?: string
          heard_about?: string | null
          id?: string
          symbol_position?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipt_scans: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_incomes: {
        Row: {
          active: boolean
          allocations: Json
          amount: number
          cadence: string
          category: string
          created_at: string
          id: string
          last_generated_date: string | null
          next_date: string
          notes: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          allocations?: Json
          amount?: number
          cadence: string
          category?: string
          created_at?: string
          id?: string
          last_generated_date?: string | null
          next_date: string
          notes?: string | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          allocations?: Json
          amount?: number
          cadence?: string
          category?: string
          created_at?: string
          id?: string
          last_generated_date?: string | null
          next_date?: string
          notes?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings: {
        Row: {
          account: string
          amount: number
          created_at: string
          date: string
          id: string
          kind: string
          notes: string | null
          user_id: string
        }
        Insert: {
          account: string
          amount?: number
          created_at?: string
          date: string
          id?: string
          kind: string
          notes?: string | null
          user_id: string
        }
        Update: {
          account?: string
          amount?: number
          created_at?: string
          date?: string
          id?: string
          kind?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          commitment_id: string | null
          created_at: string
          date: string
          dismissed_at: string | null
          expiration_date: string | null
          id: string
          is_pending: boolean
          items: Json
          notes: string | null
          payment_splits: Json
          protection_duration: string | null
          protection_type: string | null
          receipt_attached: boolean
          receipt_location: string
          receipt_type: string
          refunds: Json
          retailer: string
          total_amount: number
          user_id: string
        }
        Insert: {
          commitment_id?: string | null
          created_at?: string
          date: string
          dismissed_at?: string | null
          expiration_date?: string | null
          id?: string
          is_pending?: boolean
          items?: Json
          notes?: string | null
          payment_splits?: Json
          protection_duration?: string | null
          protection_type?: string | null
          receipt_attached?: boolean
          receipt_location?: string
          receipt_type?: string
          refunds?: Json
          retailer: string
          total_amount?: number
          user_id: string
        }
        Update: {
          commitment_id?: string | null
          created_at?: string
          date?: string
          dismissed_at?: string | null
          expiration_date?: string | null
          id?: string
          is_pending?: boolean
          items?: Json
          notes?: string | null
          payment_splits?: Json
          protection_duration?: string | null
          protection_type?: string | null
          receipt_attached?: boolean
          receipt_location?: string
          receipt_type?: string
          refunds?: Json
          retailer?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
        ]
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
      user_settings: {
        Row: {
          blur_amounts: boolean
          carryover_enabled: boolean
          created_at: string
          cycle_anchor: string
          cycle_override_end: string | null
          cycle_override_start: string | null
          cycle_type: string
          hidden_items: string[]
          hidden_retailers: string[]
          hide_category_chart: boolean
          joy_categories: string[]
          last_carryover_cycle_key: string | null
          onboarding_completed: boolean
          tutorial_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          blur_amounts?: boolean
          carryover_enabled?: boolean
          created_at?: string
          cycle_anchor?: string
          cycle_override_end?: string | null
          cycle_override_start?: string | null
          cycle_type?: string
          hidden_items?: string[]
          hidden_retailers?: string[]
          hide_category_chart?: boolean
          joy_categories?: string[]
          last_carryover_cycle_key?: string | null
          onboarding_completed?: boolean
          tutorial_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          blur_amounts?: boolean
          carryover_enabled?: boolean
          created_at?: string
          cycle_anchor?: string
          cycle_override_end?: string | null
          cycle_override_start?: string | null
          cycle_type?: string
          hidden_items?: string[]
          hidden_retailers?: string[]
          hide_category_chart?: boolean
          joy_categories?: string[]
          last_carryover_cycle_key?: string | null
          onboarding_completed?: boolean
          tutorial_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "beta" | "user"
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
      app_role: ["admin", "beta", "user"],
    },
  },
} as const
