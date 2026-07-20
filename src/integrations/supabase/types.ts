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
      app_branding: {
        Row: {
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          facebook_url: string | null
          favicon_url: string | null
          footer_note: string | null
          id: string
          logo_url: string | null
          singleton: boolean
          site_name: string
          tagline: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          footer_note?: string | null
          id?: string
          logo_url?: string | null
          singleton?: boolean
          site_name?: string
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          facebook_url?: string | null
          favicon_url?: string | null
          footer_note?: string | null
          id?: string
          logo_url?: string | null
          singleton?: boolean
          site_name?: string
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note: string | null
          payment_date: string
          payment_method: string
          reference: string | null
          sale_id: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          reference?: string | null
          sale_id?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          reference?: string | null
          sale_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          is_active: boolean
          name: string
          note: string | null
          opening_balance: number
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          opening_balance?: number
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          opening_balance?: number
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string
          phone: string
          shop_name: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name: string
          phone: string
          shop_name?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          phone?: string
          shop_name?: string | null
          status?: string
        }
        Relationships: []
      }
      impersonation_audit: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          ip: string | null
          shop_id: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip?: string | null
          shop_id: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          shop_id?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_audit_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_tokens: {
        Row: {
          admin_user_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          shop_id: string
          target_user_id: string
          token: string
        }
        Insert: {
          admin_user_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          shop_id: string
          target_user_id: string
          token: string
        }
        Update: {
          admin_user_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          shop_id?: string
          target_user_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_schedules: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_date: string
          id: string
          installment_no: number
          paid_amount: number
          sale_id: string
          shop_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          installment_no: number
          paid_amount?: number
          sale_id: string
          shop_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          installment_no?: number
          paid_amount?: number
          sale_id?: string
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_schedules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_schedules_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_schedules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
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
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_alert: number
          name: string
          purchase_price: number
          sale_price: number
          shop_id: string
          sku: string | null
          stock_quantity: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_alert?: number
          name: string
          purchase_price?: number
          sale_price?: number
          shop_id: string
          sku?: string | null
          stock_quantity?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_alert?: number
          name?: string
          purchase_price?: number
          sale_price?: number
          shop_id?: string
          sku?: string | null
          stock_quantity?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
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
      purchase_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string
          purchase_id: string
          quantity: number
          shop_id: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id: string
          purchase_id: string
          quantity: number
          shop_id: string
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          purchase_id?: string
          quantity?: number
          shop_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          discount: number
          due: number
          id: string
          invoice_no: string | null
          note: string | null
          paid: number
          payment_method: string
          purchase_date: string
          shop_id: string
          subtotal: number
          supplier_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount?: number
          due?: number
          id?: string
          invoice_no?: string | null
          note?: string | null
          paid?: number
          payment_method?: string
          purchase_date?: string
          shop_id: string
          subtotal?: number
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount?: number
          due?: number
          id?: string
          invoice_no?: string | null
          note?: string | null
          paid?: number
          payment_method?: string
          purchase_date?: string
          shop_id?: string
          subtotal?: number
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          shop_id: string
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id: string
          quantity: number
          sale_id: string
          shop_id: string
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          sale_id?: string
          shop_id?: string
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          due: number
          id: string
          invoice_no: string | null
          note: string | null
          paid: number
          payment_method: string
          sale_date: string
          sale_type: string
          shop_id: string
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          due?: number
          id?: string
          invoice_no?: string | null
          note?: string | null
          paid?: number
          payment_method?: string
          sale_date?: string
          sale_type?: string
          shop_id: string
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          due?: number
          id?: string
          invoice_no?: string | null
          note?: string | null
          paid?: number
          payment_method?: string
          sale_date?: string
          sale_type?: string
          shop_id?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          shop_id: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          shop_id: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          shop_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          payment_date: string
          payment_method: string
          purchase_id: string | null
          reference: string | null
          shop_id: string
          supplier_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          purchase_id?: string | null
          reference?: string | null
          shop_id: string
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          purchase_id?: string | null
          reference?: string | null
          shop_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          current_balance: number
          id: string
          is_active: boolean
          name: string
          note: string | null
          opening_balance: number
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          opening_balance?: number
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          opening_balance?: number
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          shop_id: string
          short_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          shop_id: string
          short_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          shop_id?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_shop_id_fkey"
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
      apply_stock_movement: {
        Args: {
          _movement_type: string
          _note: string
          _product_id: string
          _quantity: number
          _reference_id: string
          _reference_type: string
          _shop_id: string
          _unit_cost: number
        }
        Returns: string
      }
      create_purchase: {
        Args: {
          _discount: number
          _invoice_no: string
          _items: Json
          _note: string
          _paid: number
          _payment_method: string
          _purchase_date: string
          _shop_id: string
          _supplier_id: string
        }
        Returns: string
      }
      create_sale: {
        Args: {
          _customer_id: string
          _discount: number
          _installment_frequency: string
          _installment_start: string
          _installments: number
          _invoice_no: string
          _items: Json
          _note: string
          _paid: number
          _payment_method: string
          _sale_date: string
          _sale_type: string
          _shop_id: string
        }
        Returns: string
      }
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
      pay_supplier: {
        Args: {
          _amount: number
          _note: string
          _payment_date: string
          _payment_method: string
          _reference: string
          _shop_id: string
          _supplier_id: string
        }
        Returns: string
      }
      receive_customer_payment: {
        Args: {
          _amount: number
          _customer_id: string
          _note: string
          _payment_date: string
          _payment_method: string
          _reference: string
          _sale_id: string
          _shop_id: string
        }
        Returns: string
      }
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
