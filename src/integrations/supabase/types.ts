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
      packages: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_products: number
          max_sms_per_month: number
          max_users: number
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number
          max_sms_per_month?: number
          max_users?: number
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number
          max_sms_per_month?: number
          max_users?: number
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_gateway_settings: {
        Row: {
          app_key: string | null
          app_secret: string | null
          created_at: string
          id: string
          is_active: boolean
          merchant_number: string | null
          mode: string
          password: string | null
          provider: string
          updated_at: string
          username: string | null
        }
        Insert: {
          app_key?: string | null
          app_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_number?: string | null
          mode?: string
          password?: string | null
          provider?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          app_key?: string | null
          app_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_number?: string | null
          mode?: string
          password?: string | null
          provider?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_name: string
          package_id: string | null
          phone: string
          status: Database["public"]["Enums"]["shop_status"]
          subscription_end: string | null
          subscription_start: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_name: string
          package_id?: string | null
          phone: string
          status?: Database["public"]["Enums"]["shop_status"]
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_name?: string
          package_id?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["shop_status"]
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_gateway_settings: {
        Row: {
          api_token: string | null
          created_at: string
          id: string
          is_active: boolean
          provider: string
          sender_id: string | null
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          sender_id?: string | null
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          sender_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          message: string
          recipient: string
          response: string | null
          sent_at: string | null
          shop_id: string | null
          status: Database["public"]["Enums"]["sms_status"]
          template_code: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          message: string
          recipient: string
          response?: string | null
          sent_at?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          template_code?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          message?: string
          recipient?: string
          response?: string | null
          sent_at?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          template_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          bkash_payment_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string
          raw_response: Json | null
          shop_id: string
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bkash_payment_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          raw_response?: Json | null
          shop_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bkash_payment_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          raw_response?: Json | null
          shop_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          ends_at: string
          id: string
          package_id: string
          shop_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          ends_at: string
          id?: string
          package_id: string
          shop_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          ends_at?: string
          id?: string
          package_id?: string
          shop_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_shop_member: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      user_shop_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role: "super_admin" | "shop_owner" | "shop_manager" | "shop_cashier"
      billing_cycle: "monthly" | "yearly"
      payment_status: "pending" | "success" | "failed" | "refunded"
      shop_status: "active" | "expired" | "locked" | "suspended"
      sms_status: "pending" | "sent" | "failed"
      subscription_status: "pending" | "active" | "expired" | "cancelled"
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
      app_role: ["super_admin", "shop_owner", "shop_manager", "shop_cashier"],
      billing_cycle: ["monthly", "yearly"],
      payment_status: ["pending", "success", "failed", "refunded"],
      shop_status: ["active", "expired", "locked", "suspended"],
      sms_status: ["pending", "sent", "failed"],
      subscription_status: ["pending", "active", "expired", "cancelled"],
    },
  },
} as const
