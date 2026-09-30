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
      admin_emails: {
        Row: {
          attachments: Json | null
          bcc: string[] | null
          body_html: string
          body_text: string
          broadcast_group: string | null
          broadcast_id: string | null
          cc: string[] | null
          created_at: string
          direction: string
          email_type: string
          id: string
          in_reply_to: string | null
          is_archived: boolean
          is_read: boolean
          is_starred: boolean
          raw_headers: Json | null
          read_at: string | null
          read_by: string | null
          recipient_email: string
          recipient_id: string | null
          recipient_name: string | null
          related_message_id: string | null
          related_message_type: string | null
          resend_id: string | null
          scheduled_at: string | null
          sender_email: string
          sender_name: string | null
          sent_by: string | null
          status: string
          subject: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          bcc?: string[] | null
          body_html?: string
          body_text?: string
          broadcast_group?: string | null
          broadcast_id?: string | null
          cc?: string[] | null
          created_at?: string
          direction?: string
          email_type?: string
          id?: string
          in_reply_to?: string | null
          is_archived?: boolean
          is_read?: boolean
          is_starred?: boolean
          raw_headers?: Json | null
          read_at?: string | null
          read_by?: string | null
          recipient_email: string
          recipient_id?: string | null
          recipient_name?: string | null
          related_message_id?: string | null
          related_message_type?: string | null
          resend_id?: string | null
          scheduled_at?: string | null
          sender_email?: string
          sender_name?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          bcc?: string[] | null
          body_html?: string
          body_text?: string
          broadcast_group?: string | null
          broadcast_id?: string | null
          cc?: string[] | null
          created_at?: string
          direction?: string
          email_type?: string
          id?: string
          in_reply_to?: string | null
          is_archived?: boolean
          is_read?: boolean
          is_starred?: boolean
          raw_headers?: Json | null
          read_at?: string | null
          read_by?: string | null
          recipient_email?: string
          recipient_id?: string | null
          recipient_name?: string | null
          related_message_id?: string | null
          related_message_type?: string | null
          resend_id?: string | null
          scheduled_at?: string | null
          sender_email?: string
          sender_name?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_emails_in_reply_to_fkey"
            columns: ["in_reply_to"]
            isOneToOne: false
            referencedRelation: "admin_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_emails_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_emails_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_emails_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agb_acceptances: {
        Row: {
          accepted_at: string
          agb_version: string
          context: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string
          agb_version: string
          context?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string
          agb_version?: string
          context?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          consent_id: string
          created_at: string
          event_action: string | null
          event_category: string | null
          event_label: string | null
          event_name: string
          event_value: number | null
          id: string
          page_path: string | null
          properties: Json | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          consent_id: string
          created_at?: string
          event_action?: string | null
          event_category?: string | null
          event_label?: string | null
          event_name: string
          event_value?: number | null
          id?: string
          page_path?: string | null
          properties?: Json | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          consent_id?: string
          created_at?: string
          event_action?: string | null
          event_category?: string | null
          event_label?: string | null
          event_name?: string
          event_value?: number | null
          id?: string
          page_path?: string | null
          properties?: Json | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      analytics_page_performance: {
        Row: {
          avg_scroll_depth: number | null
          avg_time_on_page: number | null
          page_path: string | null
          unique_sessions: number | null
          views: number | null
        }
        Insert: {
          avg_scroll_depth?: number | null
          avg_time_on_page?: number | null
          page_path?: string | null
          unique_sessions?: number | null
          views?: number | null
        }
        Update: {
          avg_scroll_depth?: number | null
          avg_time_on_page?: number | null
          page_path?: string | null
          unique_sessions?: number | null
          views?: number | null
        }
        Relationships: []
      }
      analytics_page_views: {
        Row: {
          consent_id: string
          country: string | null
          created_at: string
          device_type: string | null
          id: string
          page_path: string
          page_title: string | null
          page_url: string | null
          referrer_path: string | null
          scroll_depth_percent: number | null
          session_id: string
          time_on_page_seconds: number | null
          user_id: string | null
        }
        Insert: {
          consent_id: string
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          page_path: string
          page_title?: string | null
          page_url?: string | null
          referrer_path?: string | null
          scroll_depth_percent?: number | null
          session_id: string
          time_on_page_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          consent_id?: string
          country?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          page_path?: string
          page_title?: string | null
          page_url?: string | null
          referrer_path?: string | null
          scroll_depth_percent?: number | null
          session_id?: string
          time_on_page_seconds?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_page_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      analytics_sessions: {
        Row: {
          browser: string | null
          browser_version: string | null
          consent_id: string
          country: string | null
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          events_count: number | null
          exit_page: string | null
          hostname: string | null
          id: string
          landing_page: string | null
          os: string | null
          os_version: string | null
          page_views_count: number | null
          referrer_domain: string | null
          referrer_url: string | null
          region: string | null
          session_id: string
          started_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          browser?: string | null
          browser_version?: string | null
          consent_id: string
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          events_count?: number | null
          exit_page?: string | null
          hostname?: string | null
          id?: string
          landing_page?: string | null
          os?: string | null
          os_version?: string | null
          page_views_count?: number | null
          referrer_domain?: string | null
          referrer_url?: string | null
          region?: string | null
          session_id: string
          started_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          browser?: string | null
          browser_version?: string | null
          consent_id?: string
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          events_count?: number | null
          exit_page?: string | null
          hostname?: string | null
          id?: string
          landing_page?: string | null
          os?: string | null
          os_version?: string | null
          page_views_count?: number | null
          referrer_domain?: string | null
          referrer_url?: string | null
          region?: string | null
          session_id?: string
          started_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          accept_language: string | null
          action: string
          city: string | null
          country: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accept_language?: string | null
          action: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accept_language?: string | null
          action?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_appliance_brands: {
        Row: {
          id: string
          is_active: boolean
          name: string
          segment: Database["public"]["Enums"]["style_segment_enum"] | null
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          segment?: Database["public"]["Enums"]["style_segment_enum"] | null
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          segment?: Database["public"]["Enums"]["style_segment_enum"] | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_appliance_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_front_materials: {
        Row: {
          category: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_handle_types: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_kitchen_brands: {
        Row: {
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          segment: Database["public"]["Enums"]["style_segment_enum"] | null
          slug: string
          sort_order: number
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          segment?: Database["public"]["Enums"]["style_segment_enum"] | null
          slug: string
          sort_order?: number
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          segment?: Database["public"]["Enums"]["style_segment_enum"] | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_sink_brands: {
        Row: {
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_sink_materials: {
        Row: {
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      catalog_worktop_designs: {
        Row: {
          id: string
          is_active: boolean
          manufacturer: string | null
          material_id: string | null
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          material_id?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          manufacturer?: string | null
          material_id?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_worktop_designs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "catalog_worktop_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_worktop_materials: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          admin_response: string | null
          bot_check: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          submission_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_response?: string | null
          bot_check?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          submission_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_response?: string | null
          bot_check?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          submission_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cookie_consent: {
        Row: {
          analytics: boolean
          consent_id: string
          consent_version: string
          created_at: string
          essential: boolean
          functional: boolean
          id: string
          ip_hash: string | null
          marketing: boolean
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          consent_id: string
          consent_version?: string
          created_at?: string
          essential?: boolean
          functional?: boolean
          id?: string
          ip_hash?: string | null
          marketing?: boolean
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          consent_id?: string
          consent_version?: string
          created_at?: string
          essential?: boolean
          functional?: boolean
          id?: string
          ip_hash?: string | null
          marketing?: boolean
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cron_run_locks: {
        Row: {
          key: string
          locked_at: string
        }
        Insert: {
          key: string
          locked_at?: string
        }
        Update: {
          key?: string
          locked_at?: string
        }
        Relationships: []
      }
      dealer_applications: {
        Row: {
          account_holder: string | null
          additional_documents: Json | null
          annual_revenue: string | null
          bank_name: string | null
          bic: string | null
          business_description: string | null
          company_address: string
          company_city: string
          company_name: string
          company_postal_code: string
          confirmation_link_last_sent_at: string | null
          confirmation_link_sent_count: number | null
          contact_person_name: string
          contact_person_position: string | null
          country: string
          created_at: string
          document_request_last_sent_at: string | null
          document_request_sent_count: number | null
          employee_count: string | null
          founded_year: number | null
          gewerbenachweis_url: string | null
          handelsregister_number: string | null
          hrb_document_url: string | null
          hrb_number: string | null
          iban: string | null
          id: string
          legal_form: string | null
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sepa_mandate_date: string | null
          sepa_mandate_reference: string | null
          sepa_mandate_signed: boolean | null
          status: string
          status_changed_at: string | null
          submitted_at: string
          tax_id: string | null
          trade_license_document_url: string | null
          trade_license_number: string | null
          updated_at: string
          user_id: string
          ust_id_verified: boolean | null
          vat_id: string | null
          website: string | null
        }
        Insert: {
          account_holder?: string | null
          additional_documents?: Json | null
          annual_revenue?: string | null
          bank_name?: string | null
          bic?: string | null
          business_description?: string | null
          company_address: string
          company_city: string
          company_name: string
          company_postal_code: string
          confirmation_link_last_sent_at?: string | null
          confirmation_link_sent_count?: number | null
          contact_person_name: string
          contact_person_position?: string | null
          country?: string
          created_at?: string
          document_request_last_sent_at?: string | null
          document_request_sent_count?: number | null
          employee_count?: string | null
          founded_year?: number | null
          gewerbenachweis_url?: string | null
          handelsregister_number?: string | null
          hrb_document_url?: string | null
          hrb_number?: string | null
          iban?: string | null
          id?: string
          legal_form?: string | null
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sepa_mandate_date?: string | null
          sepa_mandate_reference?: string | null
          sepa_mandate_signed?: boolean | null
          status?: string
          status_changed_at?: string | null
          submitted_at?: string
          tax_id?: string | null
          trade_license_document_url?: string | null
          trade_license_number?: string | null
          updated_at?: string
          user_id: string
          ust_id_verified?: boolean | null
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          account_holder?: string | null
          additional_documents?: Json | null
          annual_revenue?: string | null
          bank_name?: string | null
          bic?: string | null
          business_description?: string | null
          company_address?: string
          company_city?: string
          company_name?: string
          company_postal_code?: string
          confirmation_link_last_sent_at?: string | null
          confirmation_link_sent_count?: number | null
          contact_person_name?: string
          contact_person_position?: string | null
          country?: string
          created_at?: string
          document_request_last_sent_at?: string | null
          document_request_sent_count?: number | null
          employee_count?: string | null
          founded_year?: number | null
          gewerbenachweis_url?: string | null
          handelsregister_number?: string | null
          hrb_document_url?: string | null
          hrb_number?: string | null
          iban?: string | null
          id?: string
          legal_form?: string | null
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sepa_mandate_date?: string | null
          sepa_mandate_reference?: string | null
          sepa_mandate_signed?: boolean | null
          status?: string
          status_changed_at?: string | null
          submitted_at?: string
          tax_id?: string | null
          trade_license_document_url?: string | null
          trade_license_number?: string | null
          updated_at?: string
          user_id?: string
          ust_id_verified?: boolean | null
          vat_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      dealer_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          lead_auction_id: string | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          lead_auction_id?: string | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          lead_auction_id?: string | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_notifications_lead_auction_id_fkey"
            columns: ["lead_auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_payment_history: {
        Row: {
          amount: number
          created_at: string | null
          dealer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          payment_reference: string | null
          processed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          dealer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method: string
          payment_reference?: string | null
          processed_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          dealer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
          processed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_payment_history_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_payment_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          admin_notes: string | null
          app_version: string | null
          breadcrumbs: Json | null
          browser: string | null
          component_name: string | null
          connection_type: string | null
          created_at: string
          device_type: string | null
          environment: string | null
          error_category: string
          error_code: string
          error_hash: string | null
          error_message: string
          error_source: string | null
          first_seen_at: string | null
          http_status: number | null
          id: string
          is_resolved: boolean | null
          last_seen_at: string | null
          memory_usage: Json | null
          metadata: Json | null
          occurrence_count: number | null
          original_error: string | null
          page_path: string
          page_title: string | null
          page_url: string
          request_info: Json | null
          resolved_at: string | null
          resolved_by: string | null
          screen_resolution: string | null
          session_id: string | null
          severity: string
          stack_trace: string | null
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          admin_notes?: string | null
          app_version?: string | null
          breadcrumbs?: Json | null
          browser?: string | null
          component_name?: string | null
          connection_type?: string | null
          created_at?: string
          device_type?: string | null
          environment?: string | null
          error_category?: string
          error_code: string
          error_hash?: string | null
          error_message: string
          error_source?: string | null
          first_seen_at?: string | null
          http_status?: number | null
          id?: string
          is_resolved?: boolean | null
          last_seen_at?: string | null
          memory_usage?: Json | null
          metadata?: Json | null
          occurrence_count?: number | null
          original_error?: string | null
          page_path: string
          page_title?: string | null
          page_url: string
          request_info?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          severity?: string
          stack_trace?: string | null
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          admin_notes?: string | null
          app_version?: string | null
          breadcrumbs?: Json | null
          browser?: string | null
          component_name?: string | null
          connection_type?: string | null
          created_at?: string
          device_type?: string | null
          environment?: string | null
          error_category?: string
          error_code?: string
          error_hash?: string | null
          error_message?: string
          error_source?: string | null
          first_seen_at?: string | null
          http_status?: number | null
          id?: string
          is_resolved?: boolean | null
          last_seen_at?: string | null
          memory_usage?: Json | null
          metadata?: Json | null
          occurrence_count?: number | null
          original_error?: string | null
          page_path?: string
          page_title?: string | null
          page_url?: string
          request_info?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          severity?: string
          stack_trace?: string | null
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          gross_amount: number
          id: string
          invoice_id: string
          item_type: string
          net_amount: number
          quantity: number
          reference_id: string | null
          tax_amount: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          gross_amount: number
          id?: string
          invoice_id: string
          item_type?: string
          net_amount: number
          quantity?: number
          reference_id?: string | null
          tax_amount: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          gross_amount?: number
          id?: string
          invoice_id?: string
          item_type?: string
          net_amount?: number
          quantity?: number
          reference_id?: string | null
          tax_amount?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          customer_number: string | null
          dealer_country: string | null
          dealer_id: string
          due_date: string
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string
          lead_auction_id: string | null
          lead_id: string | null
          net_amount: number
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_reminder_sent: boolean | null
          payment_status: string | null
          payment_terms_days: number | null
          pdf_url: string | null
          reverse_charge: boolean
          sent_at: string | null
          sepa_mandate_reference: string | null
          service_date: string | null
          status: string
          tax_amount: number
          tax_rate: number
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          customer_number?: string | null
          dealer_country?: string | null
          dealer_id: string
          due_date: string
          gross_amount: number
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type: string
          lead_auction_id?: string | null
          lead_id?: string | null
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_reminder_sent?: boolean | null
          payment_status?: string | null
          payment_terms_days?: number | null
          pdf_url?: string | null
          reverse_charge?: boolean
          sent_at?: string | null
          sepa_mandate_reference?: string | null
          service_date?: string | null
          status?: string
          tax_amount: number
          tax_rate?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          customer_number?: string | null
          dealer_country?: string | null
          dealer_id?: string
          due_date?: string
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          lead_auction_id?: string | null
          lead_id?: string | null
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_reminder_sent?: boolean | null
          payment_status?: string | null
          payment_terms_days?: number | null
          pdf_url?: string | null
          reverse_charge?: boolean
          sent_at?: string | null
          sepa_mandate_reference?: string | null
          service_date?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_auction_id_fkey"
            columns: ["lead_auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_price_brackets: {
        Row: {
          active: boolean
          appliance_segment: Database["public"]["Enums"]["style_segment_enum"]
          created_at: string
          id: string
          kitchen_form: Database["public"]["Enums"]["kitchen_form_enum"]
          price_max_cents: number
          price_min_cents: number
          style_segment: Database["public"]["Enums"]["style_segment_enum"]
          updated_at: string
          worktop_tier: Database["public"]["Enums"]["worktop_tier_enum"]
        }
        Insert: {
          active?: boolean
          appliance_segment: Database["public"]["Enums"]["style_segment_enum"]
          created_at?: string
          id?: string
          kitchen_form: Database["public"]["Enums"]["kitchen_form_enum"]
          price_max_cents: number
          price_min_cents: number
          style_segment: Database["public"]["Enums"]["style_segment_enum"]
          updated_at?: string
          worktop_tier: Database["public"]["Enums"]["worktop_tier_enum"]
        }
        Update: {
          active?: boolean
          appliance_segment?: Database["public"]["Enums"]["style_segment_enum"]
          created_at?: string
          id?: string
          kitchen_form?: Database["public"]["Enums"]["kitchen_form_enum"]
          price_max_cents?: number
          price_min_cents?: number
          style_segment?: Database["public"]["Enums"]["style_segment_enum"]
          updated_at?: string
          worktop_tier?: Database["public"]["Enums"]["worktop_tier_enum"]
        }
        Relationships: []
      }
      kitchen_price_calibration: {
        Row: {
          factor: number
          observed_ratio: number | null
          sample_count: number
          segment: string
          updated_at: string
        }
        Insert: {
          factor?: number
          observed_ratio?: number | null
          sample_count?: number
          segment: string
          updated_at?: string
        }
        Update: {
          factor?: number
          observed_ratio?: number | null
          sample_count?: number
          segment?: string
          updated_at?: string
        }
        Relationships: []
      }
      kitchen_price_calibration_runs: {
        Row: {
          accuracy: Json
          applied: boolean
          factors: Json
          global_factor: number | null
          id: number
          observations: number
          run_at: string
        }
        Insert: {
          accuracy?: Json
          applied: boolean
          factors?: Json
          global_factor?: number | null
          id?: never
          observations?: number
          run_at?: string
        }
        Update: {
          accuracy?: Json
          applied?: boolean
          factors?: Json
          global_factor?: number | null
          id?: never
          observations?: number
          run_at?: string
        }
        Relationships: []
      }
      kitchen_pricing_rate_cards: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          overrides: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          overrides?: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          overrides?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_pricing_rate_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_ai_lab_renders: {
        Row: {
          completed_at: string | null
          config: Json
          cost_cents: number | null
          created_at: string
          error_message: string | null
          fal_response_url: string | null
          fal_status_url: string | null
          generation_ms: number | null
          id: string
          image_path: string | null
          model_slug: string
          photo_path: string
          prompt: string
          rating: number | null
          run_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          fal_response_url?: string | null
          fal_status_url?: string | null
          generation_ms?: number | null
          id?: string
          image_path?: string | null
          model_slug: string
          photo_path: string
          prompt: string
          rating?: number | null
          run_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          fal_response_url?: string | null
          fal_status_url?: string | null
          generation_ms?: number | null
          id?: string
          image_path?: string | null
          model_slug?: string
          photo_path?: string
          prompt?: string
          rating?: number | null
          run_id?: string
          status?: string
        }
        Relationships: []
      }
      kw_ai_settings: {
        Row: {
          challenger_edit_model: string | null
          challenger_share: number
          daily_render_cap: number
          edit_model: string
          fallback_edit_model: string | null
          fallback_edit_model_2: string | null
          fallback_text_model: string | null
          id: boolean
          lora_scale: number
          lora_url: string | null
          price_calibration_enabled: boolean
          text_model: string
          updated_at: string
          updated_by: string | null
          variant_model: string | null
        }
        Insert: {
          challenger_edit_model?: string | null
          challenger_share?: number
          daily_render_cap?: number
          edit_model?: string
          fallback_edit_model?: string | null
          fallback_edit_model_2?: string | null
          fallback_text_model?: string | null
          id?: boolean
          lora_scale?: number
          lora_url?: string | null
          price_calibration_enabled?: boolean
          text_model?: string
          updated_at?: string
          updated_by?: string | null
          variant_model?: string | null
        }
        Update: {
          challenger_edit_model?: string | null
          challenger_share?: number
          daily_render_cap?: number
          edit_model?: string
          fallback_edit_model?: string | null
          fallback_edit_model_2?: string | null
          fallback_text_model?: string | null
          id?: boolean
          lora_scale?: number
          lora_url?: string | null
          price_calibration_enabled?: boolean
          text_model?: string
          updated_at?: string
          updated_by?: string | null
          variant_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kw_ai_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_ai_settings_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changes: Json
          id: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changes: Json
          id?: never
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "kw_ai_settings_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_ai_stats_daily: {
        Row: {
          day: string
          stats: Json
          updated_at: string
        }
        Insert: {
          day: string
          stats: Json
          updated_at?: string
        }
        Update: {
          day?: string
          stats?: Json
          updated_at?: string
        }
        Relationships: []
      }
      kw_ai_training_samples: {
        Row: {
          config: Json
          consent_text_version: string
          created_at: string
          expires_at: string
          id: string
          lead_id: string | null
          photo_path: string
          planner_session_id: string | null
          render_feedback: Json
          room: Json
        }
        Insert: {
          config?: Json
          consent_text_version: string
          created_at?: string
          expires_at?: string
          id?: string
          lead_id?: string | null
          photo_path: string
          planner_session_id?: string | null
          render_feedback?: Json
          room?: Json
        }
        Update: {
          config?: Json
          consent_text_version?: string
          created_at?: string
          expires_at?: string
          id?: string
          lead_id?: string | null
          photo_path?: string
          planner_session_id?: string | null
          render_feedback?: Json
          room?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kw_ai_training_samples_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_ai_training_samples_planner_session_id_fkey"
            columns: ["planner_session_id"]
            isOneToOne: false
            referencedRelation: "planner_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_contact_complaints: {
        Row: {
          auction_id: string | null
          created_at: string
          dealer_id: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          invoice_id: string | null
          lead_id: string
          match_id: string
          note: string | null
          reason: string
          status: string
        }
        Insert: {
          auction_id?: string | null
          created_at?: string
          dealer_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          invoice_id?: string | null
          lead_id: string
          match_id: string
          note?: string | null
          reason: string
          status?: string
        }
        Update: {
          auction_id?: string | null
          created_at?: string
          dealer_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          invoice_id?: string | null
          lead_id?: string
          match_id?: string
          note?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kw_contact_complaints_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_contact_complaints_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_contact_complaints_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_contact_complaints_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_contact_complaints_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_contact_complaints_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "lead_match_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_dealer_market_profiles: {
        Row: {
          dealer_id: string
          min_project_value_eur: number | null
          notify_new_projects: boolean
          offer_intro: string | null
          service_postal_code: string | null
          service_radius_km: number
          updated_at: string
        }
        Insert: {
          dealer_id: string
          min_project_value_eur?: number | null
          notify_new_projects?: boolean
          offer_intro?: string | null
          service_postal_code?: string | null
          service_radius_km?: number
          updated_at?: string
        }
        Update: {
          dealer_id?: string
          min_project_value_eur?: number | null
          notify_new_projects?: boolean
          offer_intro?: string | null
          service_postal_code?: string | null
          service_radius_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kw_dealer_market_profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_funnel_events: {
        Row: {
          consent_id: string | null
          created_at: string
          device_type: string | null
          error_fields: string[] | null
          event: string
          field_name: string | null
          funnel: string
          id: number
          metadata: Json | null
          session_id: string
          step: string
          step_index: number
          time_on_step_ms: number | null
          viewport_width: number | null
        }
        Insert: {
          consent_id?: string | null
          created_at?: string
          device_type?: string | null
          error_fields?: string[] | null
          event: string
          field_name?: string | null
          funnel: string
          id?: never
          metadata?: Json | null
          session_id: string
          step: string
          step_index: number
          time_on_step_ms?: number | null
          viewport_width?: number | null
        }
        Update: {
          consent_id?: string | null
          created_at?: string
          device_type?: string | null
          error_fields?: string[] | null
          event?: string
          field_name?: string | null
          funnel?: string
          id?: never
          metadata?: Json | null
          session_id?: string
          step?: string
          step_index?: number
          time_on_step_ms?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      kw_gads_conversion_uploads: {
        Row: {
          attempts: number
          conversion_at: string
          created_at: string
          kind: string
          last_error: string | null
          lead_id: string
          next_attempt_at: string
          order_id: string
          retracted_at: string | null
          source_id: string
          status: string
          updated_at: string
          uploaded_at: string | null
          value_eur: number
        }
        Insert: {
          attempts?: number
          conversion_at: string
          created_at?: string
          kind: string
          last_error?: string | null
          lead_id: string
          next_attempt_at?: string
          order_id: string
          retracted_at?: string | null
          source_id: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          value_eur: number
        }
        Update: {
          attempts?: number
          conversion_at?: string
          created_at?: string
          kind?: string
          last_error?: string | null
          lead_id?: string
          next_attempt_at?: string
          order_id?: string
          retracted_at?: string | null
          source_id?: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          value_eur?: number
        }
        Relationships: []
      }
      kw_lead_details: {
        Row: {
          created_at: string
          customer: Json
          customer_updated_at: string | null
          expert: Json
          expert_updated_at: string | null
          expert_updated_by: string | null
          lead_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer?: Json
          customer_updated_at?: string | null
          expert?: Json
          expert_updated_at?: string | null
          expert_updated_by?: string | null
          lead_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer?: Json
          customer_updated_at?: string | null
          expert?: Json
          expert_updated_at?: string | null
          expert_updated_by?: string | null
          lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kw_lead_details_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_marketplace_settings: {
        Row: {
          auto_issue_invoices: boolean
          auto_publish_funnel_a: boolean
          auto_publish_funnel_c: boolean
          bid_visibility: string
          contact_price_fallback_cents: number
          decision_window_days: number
          default_service_radius_km: number
          id: boolean
          max_contact_purchases: number
          min_offer_ratio: number
          tender_duration_hours: number
          tender_duration_hours_unterbieten: number
          updated_at: string
        }
        Insert: {
          auto_issue_invoices?: boolean
          auto_publish_funnel_a?: boolean
          auto_publish_funnel_c?: boolean
          bid_visibility?: string
          contact_price_fallback_cents?: number
          decision_window_days?: number
          default_service_radius_km?: number
          id?: boolean
          max_contact_purchases?: number
          min_offer_ratio?: number
          tender_duration_hours?: number
          tender_duration_hours_unterbieten?: number
          updated_at?: string
        }
        Update: {
          auto_issue_invoices?: boolean
          auto_publish_funnel_a?: boolean
          auto_publish_funnel_c?: boolean
          bid_visibility?: string
          contact_price_fallback_cents?: number
          decision_window_days?: number
          default_service_radius_km?: number
          id?: boolean
          max_contact_purchases?: number
          min_offer_ratio?: number
          tender_duration_hours?: number
          tender_duration_hours_unterbieten?: number
          updated_at?: string
        }
        Relationships: []
      }
      kw_order_events: {
        Row: {
          actor: string
          actor_id: string | null
          created_at: string
          event: string
          event_at: string | null
          id: number
          note: string | null
          order_id: string
          value_eur: number | null
        }
        Insert: {
          actor: string
          actor_id?: string | null
          created_at?: string
          event: string
          event_at?: string | null
          id?: never
          note?: string | null
          order_id: string
          value_eur?: number | null
        }
        Update: {
          actor?: string
          actor_id?: string | null
          created_at?: string
          event?: string
          event_at?: string | null
          id?: never
          note?: string | null
          order_id?: string
          value_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kw_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "kw_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_orders: {
        Row: {
          auction_id: string
          bid_id: string
          cancel_note: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          completion_check_sent_at: string | null
          consumer_confirmed_at: string | null
          contacted_at: string | null
          contract_signed_at: string | null
          contract_value_eur: number | null
          created_at: string
          dealer_id: string
          escalated_at: string | null
          id: string
          installation_at: string | null
          lead_id: string
          measurement_at: string | null
          offer_price_eur: number
          problem_reported_at: string | null
          reminder_sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auction_id: string
          bid_id: string
          cancel_note?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          completion_check_sent_at?: string | null
          consumer_confirmed_at?: string | null
          contacted_at?: string | null
          contract_signed_at?: string | null
          contract_value_eur?: number | null
          created_at?: string
          dealer_id: string
          escalated_at?: string | null
          id?: string
          installation_at?: string | null
          lead_id: string
          measurement_at?: string | null
          offer_price_eur: number
          problem_reported_at?: string | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auction_id?: string
          bid_id?: string
          cancel_note?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          completion_check_sent_at?: string | null
          consumer_confirmed_at?: string | null
          contacted_at?: string | null
          contract_signed_at?: string | null
          contract_value_eur?: number | null
          created_at?: string
          dealer_id?: string
          escalated_at?: string | null
          id?: string
          installation_at?: string | null
          lead_id?: string
          measurement_at?: string | null
          offer_price_eur?: number
          problem_reported_at?: string | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kw_orders_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_orders_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "lead_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kw_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      kw_outbox: {
        Row: {
          attempts: number
          available_at: string
          channel: string
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          payload: Json
          processed_at: string | null
        }
        Insert: {
          attempts?: number
          available_at?: string
          channel?: string
          created_at?: string
          event_type: string
          id?: never
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          attempts?: number
          available_at?: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: never
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      kw_plz3_centroids: {
        Row: {
          lat: number
          lng: number
          plz3: string
        }
        Insert: {
          lat: number
          lng: number
          plz3: string
        }
        Update: {
          lat?: number
          lng?: number
          plz3?: string
        }
        Relationships: []
      }
      kw_ux_alerts: {
        Row: {
          alert_key: string
          auto_resolved: boolean
          category: string
          created_at: string
          detail: string
          field: string | null
          first_seen_at: string
          funnel: string | null
          hint: string
          id: string
          kind: string
          last_seen_at: string
          metrics: Json
          occurrences: number
          reopened_count: number
          resolved_at: string | null
          resolved_by: string | null
          resolved_note: string | null
          severity: string
          severity_rank: number | null
          status: string
          step: string | null
          step_index: number | null
          step_label: string | null
          title: string
          window_hours: number
        }
        Insert: {
          alert_key: string
          auto_resolved?: boolean
          category: string
          created_at?: string
          detail: string
          field?: string | null
          first_seen_at?: string
          funnel?: string | null
          hint: string
          id?: string
          kind: string
          last_seen_at?: string
          metrics?: Json
          occurrences?: number
          reopened_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          severity: string
          severity_rank?: number | null
          status?: string
          step?: string | null
          step_index?: number | null
          step_label?: string | null
          title: string
          window_hours?: number
        }
        Update: {
          alert_key?: string
          auto_resolved?: boolean
          category?: string
          created_at?: string
          detail?: string
          field?: string | null
          first_seen_at?: string
          funnel?: string | null
          hint?: string
          id?: string
          kind?: string
          last_seen_at?: string
          metrics?: Json
          occurrences?: number
          reopened_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          severity?: string
          severity_rank?: number | null
          status?: string
          step?: string | null
          step_index?: number | null
          step_label?: string | null
          title?: string
          window_hours?: number
        }
        Relationships: []
      }
      lead_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          lead_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          lead_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          lead_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_access_tokens_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_auction_spec_items: {
        Row: {
          auction_id: string
          brand: string | null
          category: string
          created_at: string
          designation: string | null
          id: string
          image_url: string | null
          label: string
          material: string | null
          model: string | null
          notes: string | null
          quantity: number | null
          sort_order: number
        }
        Insert: {
          auction_id: string
          brand?: string | null
          category: string
          created_at?: string
          designation?: string | null
          id?: string
          image_url?: string | null
          label: string
          material?: string | null
          model?: string | null
          notes?: string | null
          quantity?: number | null
          sort_order?: number
        }
        Update: {
          auction_id?: string
          brand?: string | null
          category?: string
          created_at?: string
          designation?: string | null
          id?: string
          image_url?: string | null
          label?: string
          material?: string | null
          model?: string | null
          notes?: string | null
          quantity?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_auction_spec_items_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_auctions: {
        Row: {
          bid_visibility: string
          cancelled_reason: string | null
          contact_price_cents: number | null
          created_at: string
          decided_at: string | null
          decision_deadline_at: string | null
          duration_hours: number
          ends_at: string | null
          estimate_max_eur: number | null
          estimate_min_eur: number | null
          id: string
          is_published: boolean
          lead_id: string
          max_contact_purchases: number
          min_bid_eur: number | null
          offer_price_eur: number | null
          penalty_state: string
          planner_session_id: string | null
          public_summary: Json
          published_at: string | null
          reference_price_eur: number | null
          spec_sheet: Json | null
          starts_at: string | null
          status: string
          updated_at: string
          won_bid_id: string | null
        }
        Insert: {
          bid_visibility?: string
          cancelled_reason?: string | null
          contact_price_cents?: number | null
          created_at?: string
          decided_at?: string | null
          decision_deadline_at?: string | null
          duration_hours?: number
          ends_at?: string | null
          estimate_max_eur?: number | null
          estimate_min_eur?: number | null
          id?: string
          is_published?: boolean
          lead_id: string
          max_contact_purchases?: number
          min_bid_eur?: number | null
          offer_price_eur?: number | null
          penalty_state?: string
          planner_session_id?: string | null
          public_summary?: Json
          published_at?: string | null
          reference_price_eur?: number | null
          spec_sheet?: Json | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          won_bid_id?: string | null
        }
        Update: {
          bid_visibility?: string
          cancelled_reason?: string | null
          contact_price_cents?: number | null
          created_at?: string
          decided_at?: string | null
          decision_deadline_at?: string | null
          duration_hours?: number
          ends_at?: string | null
          estimate_max_eur?: number | null
          estimate_min_eur?: number | null
          id?: string
          is_published?: boolean
          lead_id?: string
          max_contact_purchases?: number
          min_bid_eur?: number | null
          offer_price_eur?: number | null
          penalty_state?: string
          planner_session_id?: string | null
          public_summary?: Json
          published_at?: string | null
          reference_price_eur?: number | null
          spec_sheet?: Json | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          won_bid_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_auctions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_auctions_planner_session_id_fkey"
            columns: ["planner_session_id"]
            isOneToOne: false
            referencedRelation: "planner_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_auctions_won_bid_fkey"
            columns: ["won_bid_id"]
            isOneToOne: false
            referencedRelation: "lead_bids"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_bid_revisions: {
        Row: {
          bid_id: string
          created_at: string
          id: string
          price_eur: number
        }
        Insert: {
          bid_id: string
          created_at?: string
          id?: string
          price_eur: number
        }
        Update: {
          bid_id?: string
          created_at?: string
          id?: string
          price_eur?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_bid_revisions_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "lead_bids"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_bids: {
        Row: {
          auction_id: string
          created_at: string
          dealer_id: string
          delivery_weeks: number | null
          id: string
          includes: Json
          is_winning: boolean
          montage_included: boolean | null
          notes: string | null
          payment_terms: Json | null
          price_eur: number
          revision: number
          status: string
          updated_at: string
          valid_until: string | null
          warranty_months: number | null
        }
        Insert: {
          auction_id: string
          created_at?: string
          dealer_id: string
          delivery_weeks?: number | null
          id?: string
          includes?: Json
          is_winning?: boolean
          montage_included?: boolean | null
          notes?: string | null
          payment_terms?: Json | null
          price_eur: number
          revision?: number
          status?: string
          updated_at?: string
          valid_until?: string | null
          warranty_months?: number | null
        }
        Update: {
          auction_id?: string
          created_at?: string
          dealer_id?: string
          delivery_weeks?: number | null
          id?: string
          includes?: Json
          is_winning?: boolean
          montage_included?: boolean | null
          notes?: string | null
          payment_terms?: Json | null
          price_eur?: number
          revision?: number
          status?: string
          updated_at?: string
          valid_until?: string | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_bids_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_commission_tiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_cents: number | null
          min_cents: number
          notes: string | null
          order_value_max_cents: number | null
          order_value_min_cents: number
          percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_cents?: number | null
          min_cents: number
          notes?: string | null
          order_value_max_cents?: number | null
          order_value_min_cents: number
          percent: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_cents?: number | null
          min_cents?: number
          notes?: string | null
          order_value_max_cents?: number | null
          order_value_min_cents?: number
          percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_consents: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          ip_address: unknown
          lead_id: string | null
          purpose: string
          text_version: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          purpose: string
          text_version: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          purpose?: string
          text_version?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_files: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          lead_id: string
          shared_at: string | null
          shared_by: string | null
          shared_with_studios: boolean
          virus_scan_status: string | null
        }
        Insert: {
          category: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          id?: string
          lead_id: string
          shared_at?: string | null
          shared_by?: string | null
          shared_with_studios?: boolean
          virus_scan_status?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          lead_id?: string
          shared_at?: string | null
          shared_by?: string | null
          shared_with_studios?: boolean
          virus_scan_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_match_candidates: {
        Row: {
          access_source: string
          auction_id: string | null
          created_at: string
          dealer_id: string
          id: string
          invoice_id: string | null
          is_purchased: boolean
          lead_id: string
          price_cents: number | null
          purchased_at: string | null
        }
        Insert: {
          access_source?: string
          auction_id?: string | null
          created_at?: string
          dealer_id: string
          id?: string
          invoice_id?: string | null
          is_purchased?: boolean
          lead_id: string
          price_cents?: number | null
          purchased_at?: string | null
        }
        Update: {
          access_source?: string
          auction_id?: string | null
          created_at?: string
          dealer_id?: string
          id?: string
          invoice_id?: string | null
          is_purchased?: boolean
          lead_id?: string
          price_cents?: number | null
          purchased_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_match_candidates_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_match_candidates_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_match_candidates_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_match_candidates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_penalty_charges: {
        Row: {
          amount_cents: number
          auction_id: string
          created_at: string
          dealer_id: string | null
          id: string
          lead_id: string
          party: string
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents?: number
          auction_id: string
          created_at?: string
          dealer_id?: string | null
          id?: string
          lead_id: string
          party: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          auction_id?: string
          created_at?: string
          dealer_id?: string | null
          id?: string
          lead_id?: string
          party?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_penalty_charges_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "lead_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_penalty_charges_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_penalty_charges_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_penalty_charges_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pricing_rules: {
        Row: {
          budget_max_cents: number | null
          budget_min_cents: number
          created_at: string
          id: string
          is_active: boolean
          max_price_cents: number | null
          min_price_cents: number
          notes: string | null
          percent_of_budget: number
          tier: Database["public"]["Enums"]["lead_tier"]
          updated_at: string
        }
        Insert: {
          budget_max_cents?: number | null
          budget_min_cents: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_price_cents?: number | null
          min_price_cents: number
          notes?: string | null
          percent_of_budget: number
          tier: Database["public"]["Enums"]["lead_tier"]
          updated_at?: string
        }
        Update: {
          budget_max_cents?: number | null
          budget_min_cents?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_price_cents?: number | null
          min_price_cents?: number
          notes?: string | null
          percent_of_budget?: number
          tier?: Database["public"]["Enums"]["lead_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      lead_qualification_calls: {
        Row: {
          agent_id: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          lead_id: string
          missing_data: string[] | null
          notes: string | null
          outcome: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          lead_id: string
          missing_data?: string[] | null
          notes?: string | null
          outcome: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string
          missing_data?: string[] | null
          notes?: string | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualification_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_qualification_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_upload_tokens: {
        Row: {
          created_at: string
          expires_at: string
          lead_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          lead_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          lead_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_upload_tokens_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_views: {
        Row: {
          dealer_id: string
          id: string
          lead_id: string
          viewed_at: string
        }
        Insert: {
          dealer_id: string
          id?: string
          lead_id: string
          viewed_at?: string
        }
        Update: {
          dealer_id?: string
          id?: string
          lead_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_views_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_views_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_line: string | null
          anonymized_at: string | null
          bot_check: string | null
          budget_midpoint: number | null
          city: string | null
          consent_call: boolean
          consent_marketing: boolean
          created_at: string
          delivery_mode: string | null
          desired_delivery_at: string | null
          email: string | null
          existing_offer_price_cents: number | null
          existing_offer_studio: string | null
          fbclid: string | null
          first_name: string | null
          funnel_answers: Json | null
          funnel_type: Database["public"]["Enums"]["lead_funnel_type"]
          funnel_variant: string | null
          gbraid: string | null
          gclid: string | null
          has_existing_offer: boolean
          housing_type: string | null
          id: string
          ip_address: unknown
          kitchen_form: string | null
          kitchen_style: string | null
          landing_page: string | null
          last_name: string | null
          msclkid: string | null
          payment_down_payment_percent: number | null
          payment_financing: string | null
          payment_financing_apr: number | null
          payment_financing_months: number | null
          phone: string | null
          postal_code: string
          purchase_reason: string | null
          region: string | null
          score: number
          special_wishes: string[] | null
          status: Database["public"]["Enums"]["lead_status"]
          submission_id: string | null
          tier: Database["public"]["Enums"]["lead_tier"]
          timeframe_months: number | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          waste_separation_system: boolean | null
          wbraid: string | null
        }
        Insert: {
          address_line?: string | null
          anonymized_at?: string | null
          bot_check?: string | null
          budget_midpoint?: number | null
          city?: string | null
          consent_call?: boolean
          consent_marketing?: boolean
          created_at?: string
          delivery_mode?: string | null
          desired_delivery_at?: string | null
          email?: string | null
          existing_offer_price_cents?: number | null
          existing_offer_studio?: string | null
          fbclid?: string | null
          first_name?: string | null
          funnel_answers?: Json | null
          funnel_type?: Database["public"]["Enums"]["lead_funnel_type"]
          funnel_variant?: string | null
          gbraid?: string | null
          gclid?: string | null
          has_existing_offer?: boolean
          housing_type?: string | null
          id?: string
          ip_address?: unknown
          kitchen_form?: string | null
          kitchen_style?: string | null
          landing_page?: string | null
          last_name?: string | null
          msclkid?: string | null
          payment_down_payment_percent?: number | null
          payment_financing?: string | null
          payment_financing_apr?: number | null
          payment_financing_months?: number | null
          phone?: string | null
          postal_code: string
          purchase_reason?: string | null
          region?: string | null
          score?: number
          special_wishes?: string[] | null
          status?: Database["public"]["Enums"]["lead_status"]
          submission_id?: string | null
          tier?: Database["public"]["Enums"]["lead_tier"]
          timeframe_months?: number | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          waste_separation_system?: boolean | null
          wbraid?: string | null
        }
        Update: {
          address_line?: string | null
          anonymized_at?: string | null
          bot_check?: string | null
          budget_midpoint?: number | null
          city?: string | null
          consent_call?: boolean
          consent_marketing?: boolean
          created_at?: string
          delivery_mode?: string | null
          desired_delivery_at?: string | null
          email?: string | null
          existing_offer_price_cents?: number | null
          existing_offer_studio?: string | null
          fbclid?: string | null
          first_name?: string | null
          funnel_answers?: Json | null
          funnel_type?: Database["public"]["Enums"]["lead_funnel_type"]
          funnel_variant?: string | null
          gbraid?: string | null
          gclid?: string | null
          has_existing_offer?: boolean
          housing_type?: string | null
          id?: string
          ip_address?: unknown
          kitchen_form?: string | null
          kitchen_style?: string | null
          landing_page?: string | null
          last_name?: string | null
          msclkid?: string | null
          payment_down_payment_percent?: number | null
          payment_financing?: string | null
          payment_financing_apr?: number | null
          payment_financing_months?: number | null
          phone?: string | null
          postal_code?: string
          purchase_reason?: string | null
          region?: string | null
          score?: number
          special_wishes?: string[] | null
          status?: Database["public"]["Enums"]["lead_status"]
          submission_id?: string | null
          tier?: Database["public"]["Enums"]["lead_tier"]
          timeframe_months?: number | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          waste_separation_system?: boolean | null
          wbraid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          dealer_application_id: string
          document_name: string | null
          document_type: string
          document_url: string
          file_size: number | null
          file_url: string | null
          id: string
          mime_type: string | null
          notes: string | null
          original_filename: string
          uploaded_at: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          dealer_application_id: string
          document_name?: string | null
          document_type: string
          document_url: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename: string
          uploaded_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          dealer_application_id?: string
          document_name?: string | null
          document_type?: string
          document_url?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_filename?: string
          uploaded_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_dealer_application_id_fkey"
            columns: ["dealer_application_id"]
            isOneToOne: false
            referencedRelation: "dealer_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          completed_at: string
          id: string
          task: string
        }
        Insert: {
          completed_at?: string
          id?: string
          task: string
        }
        Update: {
          completed_at?: string
          id?: string
          task?: string
        }
        Relationships: []
      }
      musterkuechen: {
        Row: {
          brand: string | null
          condition: string
          created_at: string
          dealer_id: string
          description: string | null
          id: string
          images: string[] | null
          is_available: boolean
          is_highlighted: boolean
          original_price_eur: number
          sale_price_eur: number
          title: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          condition?: string
          created_at?: string
          dealer_id: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean
          is_highlighted?: boolean
          original_price_eur: number
          sale_price_eur: number
          title: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          condition?: string
          created_at?: string
          dealer_id?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_available?: boolean
          is_highlighted?: boolean
          original_price_eur?: number
          sale_price_eur?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "musterkuechen_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          amount_due: number
          created_at: string | null
          due_date: string
          id: string
          invoice_id: string
          message_body: string | null
          notes: string | null
          original_amount: number | null
          reminder_date: string | null
          reminder_fee: number | null
          reminder_level: number
          sent_at: string
          status: string
          subject: string | null
          total_amount: number | null
        }
        Insert: {
          amount_due: number
          created_at?: string | null
          due_date: string
          id?: string
          invoice_id: string
          message_body?: string | null
          notes?: string | null
          original_amount?: number | null
          reminder_date?: string | null
          reminder_fee?: number | null
          reminder_level: number
          sent_at?: string
          status?: string
          subject?: string | null
          total_amount?: number | null
        }
        Update: {
          amount_due?: number
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_id?: string
          message_body?: string | null
          notes?: string | null
          original_amount?: number | null
          reminder_date?: string | null
          reminder_fee?: number | null
          reminder_level?: number
          sent_at?: string
          status?: string
          subject?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_rate_limits: {
        Row: {
          bucket_key: string
          count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          bucket_key?: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      planner_renders: {
        Row: {
          attempt: number
          attempt_started_at: string | null
          base_render_id: string | null
          completed_at: string | null
          cost_cents: number | null
          created_at: string
          error_message: string | null
          fal_request_id: string | null
          fal_response_url: string | null
          fal_status_url: string | null
          fallback_from: string | null
          fallback_reason: string | null
          feedback: number | null
          feedback_at: string | null
          feedback_reasons: string[] | null
          generation_ms: number | null
          id: string
          image_height: number | null
          image_path: string | null
          image_width: number | null
          input_image_path: string | null
          mode: string
          model_slug: string | null
          negative_prompt: string | null
          prompt: string
          session_id: string
          spec_snapshot: Json
          status: string
          storage_bucket: string
          user_message: string | null
          variant_label: string | null
          verified: boolean
          version: number
        }
        Insert: {
          attempt?: number
          attempt_started_at?: string | null
          base_render_id?: string | null
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          fal_request_id?: string | null
          fal_response_url?: string | null
          fal_status_url?: string | null
          fallback_from?: string | null
          fallback_reason?: string | null
          feedback?: number | null
          feedback_at?: string | null
          feedback_reasons?: string[] | null
          generation_ms?: number | null
          id?: string
          image_height?: number | null
          image_path?: string | null
          image_width?: number | null
          input_image_path?: string | null
          mode?: string
          model_slug?: string | null
          negative_prompt?: string | null
          prompt: string
          session_id: string
          spec_snapshot: Json
          status?: string
          storage_bucket?: string
          user_message?: string | null
          variant_label?: string | null
          verified?: boolean
          version?: number
        }
        Update: {
          attempt?: number
          attempt_started_at?: string | null
          base_render_id?: string | null
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          fal_request_id?: string | null
          fal_response_url?: string | null
          fal_status_url?: string | null
          fallback_from?: string | null
          fallback_reason?: string | null
          feedback?: number | null
          feedback_at?: string | null
          feedback_reasons?: string[] | null
          generation_ms?: number | null
          id?: string
          image_height?: number | null
          image_path?: string | null
          image_width?: number | null
          input_image_path?: string | null
          mode?: string
          model_slug?: string | null
          negative_prompt?: string | null
          prompt?: string
          session_id?: string
          spec_snapshot?: Json
          status?: string
          storage_bucket?: string
          user_message?: string | null
          variant_label?: string | null
          verified?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "planner_renders_base_render_id_fkey"
            columns: ["base_render_id"]
            isOneToOne: false
            referencedRelation: "planner_renders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_renders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "planner_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_sessions: {
        Row: {
          ai_group: string | null
          ai_training_consent: boolean
          ai_training_consent_at: string | null
          contact_captured_at: string | null
          created_at: string
          current_render_id: string | null
          estimate: Json | null
          expert_note: string | null
          id: string
          ip_address: unknown
          lead_id: string | null
          photo_paths: string[]
          price_range_max_cents: number | null
          price_range_min_cents: number | null
          provenance: Json | null
          room: Json
          session_token: string
          spec: Json
          spec_version: number
          status: string
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ai_group?: string | null
          ai_training_consent?: boolean
          ai_training_consent_at?: string | null
          contact_captured_at?: string | null
          created_at?: string
          current_render_id?: string | null
          estimate?: Json | null
          expert_note?: string | null
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          photo_paths?: string[]
          price_range_max_cents?: number | null
          price_range_min_cents?: number | null
          provenance?: Json | null
          room?: Json
          session_token: string
          spec?: Json
          spec_version?: number
          status?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ai_group?: string | null
          ai_training_consent?: boolean
          ai_training_consent_at?: string | null
          contact_captured_at?: string | null
          created_at?: string
          current_render_id?: string | null
          estimate?: Json | null
          expert_note?: string | null
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          photo_paths?: string[]
          price_range_max_cents?: number | null
          price_range_min_cents?: number | null
          provenance?: Json | null
          room?: Json
          session_token?: string
          spec?: Json
          spec_version?: number
          status?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planner_sessions_current_render_fkey"
            columns: ["current_render_id"]
            isOneToOne: false
            referencedRelation: "planner_renders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planner_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_restricted: boolean | null
          account_type: string | null
          address_city: string | null
          address_country: string | null
          address_street: string | null
          address_zip: string | null
          avatar_url: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_street: string | null
          company_zip: string | null
          created_at: string
          customer_number: string | null
          description: string | null
          email: string
          email_bounced: boolean | null
          email_bounced_at: string | null
          first_name: string | null
          id: string
          is_suspended: boolean | null
          is_verified: boolean | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          restricted_at: string | null
          restriction_reason: string | null
          salutation: string | null
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          tax_id: string | null
          trade_license: string | null
          updated_at: string
          vat_id: string | null
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          account_restricted?: boolean | null
          account_type?: string | null
          address_city?: string | null
          address_country?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_street?: string | null
          company_zip?: string | null
          created_at?: string
          customer_number?: string | null
          description?: string | null
          email: string
          email_bounced?: boolean | null
          email_bounced_at?: string | null
          first_name?: string | null
          id: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          restricted_at?: string | null
          restriction_reason?: string | null
          salutation?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          tax_id?: string | null
          trade_license?: string | null
          updated_at?: string
          vat_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          account_restricted?: boolean | null
          account_type?: string | null
          address_city?: string | null
          address_country?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_street?: string | null
          company_zip?: string | null
          created_at?: string
          customer_number?: string | null
          description?: string | null
          email?: string
          email_bounced?: boolean | null
          email_bounced_at?: string | null
          first_name?: string | null
          id?: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          restricted_at?: string | null
          restriction_reason?: string | null
          salutation?: string | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          tax_id?: string | null
          trade_license?: string | null
          updated_at?: string
          vat_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          window_end: string
          window_start?: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      sepa_mandate_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          template_name: string
          template_text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_name: string
          template_text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_name?: string
          template_text?: string
        }
        Relationships: []
      }
      sepa_mandates: {
        Row: {
          activated_at: string | null
          bank_name: string | null
          bic: string | null
          cancelled_at: string | null
          created_at: string | null
          creditor_id: string
          dealer_application_id: string
          debtor_address: string
          debtor_name: string
          iban: string
          id: string
          ip_address: unknown
          mandate_date: string
          mandate_reference: string
          mandate_text: string
          signed_at: string | null
          status: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          activated_at?: string | null
          bank_name?: string | null
          bic?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          creditor_id?: string
          dealer_application_id: string
          debtor_address: string
          debtor_name: string
          iban: string
          id?: string
          ip_address?: unknown
          mandate_date?: string
          mandate_reference: string
          mandate_text: string
          signed_at?: string | null
          status?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          activated_at?: string | null
          bank_name?: string | null
          bic?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          creditor_id?: string
          dealer_application_id?: string
          debtor_address?: string
          debtor_name?: string
          iban?: string
          id?: string
          ip_address?: unknown
          mandate_date?: string
          mandate_reference?: string
          mandate_text?: string
          signed_at?: string | null
          status?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sepa_mandates_dealer_application_id_fkey"
            columns: ["dealer_application_id"]
            isOneToOne: false
            referencedRelation: "dealer_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          bank_bic: string | null
          bank_iban: string | null
          bank_name: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_postal_code: string | null
          contact_email: string
          created_at: string
          dunning_auto_enabled: boolean | null
          dunning_level1_days: number | null
          dunning_level1_fee: number | null
          dunning_level2_days: number | null
          dunning_level2_fee: number | null
          dunning_level3_days: number | null
          dunning_level3_fee: number | null
          dunning_restrict_at_level: number | null
          from_email: string
          hrb_number: string | null
          id: string
          invoice_footer_text: string | null
          invoice_payment_terms_days: number | null
          lead_forward_email: string | null
          maintenance_mode: boolean
          managing_director: string | null
          meta_description: string
          meta_keywords: string
          meta_title: string
          notify_new_registration: boolean
          site_description: string
          site_name: string
          site_tagline: string
          sitemap_enabled: boolean
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          support_phone: string
          tax_number: string | null
          tracking_config: Json
          updated_at: string
          ust_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string
          created_at?: string
          dunning_auto_enabled?: boolean | null
          dunning_level1_days?: number | null
          dunning_level1_fee?: number | null
          dunning_level2_days?: number | null
          dunning_level2_fee?: number | null
          dunning_level3_days?: number | null
          dunning_level3_fee?: number | null
          dunning_restrict_at_level?: number | null
          from_email?: string
          hrb_number?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          lead_forward_email?: string | null
          maintenance_mode?: boolean
          managing_director?: string | null
          meta_description?: string
          meta_keywords?: string
          meta_title?: string
          notify_new_registration?: boolean
          site_description?: string
          site_name?: string
          site_tagline?: string
          sitemap_enabled?: boolean
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          support_phone?: string
          tax_number?: string | null
          tracking_config?: Json
          updated_at?: string
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string
          created_at?: string
          dunning_auto_enabled?: boolean | null
          dunning_level1_days?: number | null
          dunning_level1_fee?: number | null
          dunning_level2_days?: number | null
          dunning_level2_fee?: number | null
          dunning_level3_days?: number | null
          dunning_level3_fee?: number | null
          dunning_restrict_at_level?: number | null
          from_email?: string
          hrb_number?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          lead_forward_email?: string | null
          maintenance_mode?: boolean
          managing_director?: string | null
          meta_description?: string
          meta_keywords?: string
          meta_title?: string
          notify_new_registration?: boolean
          site_description?: string
          site_name?: string
          site_tagline?: string
          sitemap_enabled?: boolean
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          support_phone?: string
          tax_number?: string | null
          tracking_config?: Json
          updated_at?: string
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_response: string | null
          created_at: string | null
          id: string
          message: string
          responded_at: string | null
          responded_by: string | null
          status: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          id?: string
          message: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          id?: string
          message?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_consent_events: {
        Row: {
          created_at: string
          granted: boolean
          id: number
          purpose: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: never
          purpose: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: never
          purpose?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          broadcast_emails_enabled: boolean | null
          created_at: string | null
          email_payment_reminder: boolean | null
          id: string
          newsletter_enabled: boolean | null
          promotional_emails: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          broadcast_emails_enabled?: boolean | null
          created_at?: string | null
          email_payment_reminder?: boolean | null
          id?: string
          newsletter_enabled?: boolean | null
          promotional_emails?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          broadcast_emails_enabled?: boolean | null
          created_at?: string | null
          email_payment_reminder?: boolean | null
          id?: string
          newsletter_enabled?: boolean | null
          promotional_emails?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      analytics_daily_summary: {
        Row: {
          date: string | null
          desktop_sessions: number | null
          mobile_sessions: number | null
          page_views: number | null
          sessions: number | null
          tablet_sessions: number | null
          unique_visitors: number | null
        }
        Relationships: []
      }
      error_logs_grouped: {
        Row: {
          affected_sessions: number | null
          affected_users: number | null
          component_name: string | null
          error_category: string | null
          error_code: string | null
          error_hash: string | null
          error_message: string | null
          first_seen: string | null
          has_unresolved: boolean | null
          last_seen: string | null
          page_path: string | null
          severity: string | null
          total_occurrences: number | null
          unique_entries: number | null
        }
        Relationships: []
      }
      error_logs_stats: {
        Row: {
          error_category: string | null
          error_count: number | null
          first_occurrence: string | null
          last_occurrence: string | null
          page_path: string | null
          severity: string | null
          unresolved_count: number | null
          user_role: string | null
        }
        Relationships: []
      }
      public_site_settings: {
        Row: {
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_postal_code: string | null
          contact_email: string | null
          created_at: string | null
          hrb_number: string | null
          id: string | null
          invoice_footer_text: string | null
          invoice_payment_terms_days: number | null
          maintenance_mode: boolean | null
          managing_director: string | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          site_description: string | null
          site_name: string | null
          site_tagline: string | null
          sitemap_enabled: boolean | null
          support_phone: string | null
          tax_number: string | null
          tracking_config: Json | null
          updated_at: string | null
          ust_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string | null
          created_at?: string | null
          hrb_number?: string | null
          id?: string | null
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          maintenance_mode?: boolean | null
          managing_director?: string | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          site_description?: string | null
          site_name?: string | null
          site_tagline?: string | null
          sitemap_enabled?: boolean | null
          support_phone?: string | null
          tax_number?: string | null
          tracking_config?: Json | null
          updated_at?: string | null
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string | null
          created_at?: string | null
          hrb_number?: string | null
          id?: string | null
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          maintenance_mode?: boolean | null
          managing_director?: string | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          site_description?: string | null
          site_name?: string | null
          site_tagline?: string | null
          sitemap_enabled?: boolean | null
          support_phone?: string | null
          tax_number?: string | null
          tracking_config?: Json | null
          updated_at?: string | null
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_add_email_suppression: {
        Args: { p_email: string; p_notes?: string; p_reason?: string }
        Returns: boolean
      }
      admin_get_cron_jobs_health: {
        Args: { p_hours?: number }
        Returns: {
          active: boolean
          avg_duration_ms: number
          command: string
          jobid: number
          jobname: string
          last_run_duration_ms: number
          last_run_end: string
          last_run_message: string
          last_run_start: string
          last_run_status: string
          runs_failed: number
          runs_succeeded: number
          runs_total: number
          schedule: string
        }[]
      }
      admin_get_cron_run_history: {
        Args: { p_jobid: number; p_limit?: number }
        Returns: {
          duration_ms: number
          end_time: string
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      admin_get_cron_schedule_drift: {
        Args: never
        Returns: {
          actual_runs_per_hour: number
          drift_ratio: number
          expected_runs_per_hour: number
          jobid: number
          jobname: string
          schedule: string
          severity: string
        }[]
      }
      admin_get_http_response_health: {
        Args: { p_hours?: number }
        Returns: {
          example_content: string
          last_seen: string
          status_class: string
          total: number
        }[]
      }
      admin_get_recent_http_failures: {
        Args: { p_hours?: number; p_limit?: number }
        Returns: {
          content: string
          created: string
          error_msg: string
          id: number
          status_code: number
          timed_out: boolean
        }[]
      }
      approve_dealer_application: {
        Args: { application_id_param: string }
        Returns: undefined
      }
      calculate_lead_commission_cents: {
        Args: { p_order_value_cents: number }
        Returns: number
      }
      calculate_lead_price_cents: {
        Args: {
          p_budget_cents: number
          p_tier: Database["public"]["Enums"]["lead_tier"]
        }
        Returns: number
      }
      clean_old_analytics_data: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_expired_rate_limits: { Args: never; Returns: number }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      ensure_profile_exists: {
        Args: {
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_phone?: string
          p_user_id: string
        }
        Returns: undefined
      }
      generate_customer_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      get_current_agb_version: { Args: never; Returns: string }
      get_dealer_tax_info: {
        Args: { p_dealer_id: string }
        Returns: {
          dealer_country: string
          is_reverse_charge: boolean
          tax_rate: number
        }[]
      }
      get_primary_role: {
        Args: { user_id_param: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_public_site_settings: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      kw_admin_ai_stats: { Args: { p_days?: number }; Returns: Json }
      kw_admin_decide_complaint: {
        Args: { p_accept: boolean; p_complaint_id: string; p_note?: string }
        Returns: Json
      }
      kw_admin_funnel_stats: {
        Args: { p_days?: number; p_funnel: string }
        Returns: Json
      }
      kw_admin_open_tender: {
        Args: { p_lead_id: string; p_notify_customer?: boolean }
        Returns: string
      }
      kw_admin_publish_tender: { Args: { p_auction_id: string }; Returns: Json }
      kw_admin_tender_action: {
        Args: {
          p_action: string
          p_auction_id: string
          p_hours?: number
          p_reason?: string
        }
        Returns: Json
      }
      kw_admin_tender_complaints: {
        Args: { p_auction_id: string }
        Returns: {
          created_at: string
          dealer_id: string
          dealer_name: string
          decided_at: string
          decision_note: string
          id: string
          invoice_id: string
          invoice_number: string
          invoice_payment_status: string
          invoice_status: string
          note: string
          reason: string
          status: string
        }[]
      }
      kw_ai_rollup_daily: { Args: { p_day: string }; Returns: undefined }
      kw_ai_stats_between: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      kw_anonymize_lead: {
        Args: { p_lead_id: string; p_source: string }
        Returns: Json
      }
      kw_can_view_lead_file: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      kw_can_view_planner_media: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      kw_clip_json: {
        Args: { p_fallback: Json; p_max_bytes: number; p_value: Json }
        Returns: Json
      }
      kw_create_market_invoice: {
        Args: {
          p_auction_id: string
          p_dealer_id: string
          p_description: string
          p_lead_id: string
          p_net_cents: number
          p_type: string
        }
        Returns: string
      }
      kw_dealer_complaint_status: {
        Args: { p_auction_id: string }
        Returns: Json
      }
      kw_dealer_file_complaint: {
        Args: { p_auction_id: string; p_note?: string; p_reason: string }
        Returns: Json
      }
      kw_dealer_in_area: {
        Args: { p_postal_code: string; p_uid: string }
        Returns: boolean
      }
      kw_dealer_order: { Args: { p_auction_id: string }; Returns: Json }
      kw_dealer_order_update: {
        Args: {
          p_at?: string
          p_auction_id: string
          p_note?: string
          p_reason?: string
          p_step: string
          p_value_eur?: number
        }
        Returns: Json
      }
      kw_dealer_origin: {
        Args: { p_uid: string }
        Returns: {
          postal_code: string
          radius_km: number
        }[]
      }
      kw_dealer_place_offer: {
        Args: {
          p_auction_id: string
          p_delivery_weeks?: number
          p_includes?: Json
          p_message?: string
          p_price_eur: number
          p_valid_until?: string
        }
        Returns: Json
      }
      kw_dealer_project: { Args: { p_auction_id: string }; Returns: Json }
      kw_dealer_projects: {
        Args: { p_limit?: number; p_offset?: number; p_scope?: string }
        Returns: {
          auction_id: string
          awarded_to_me: boolean
          contact_price_cents: number
          contact_purchases: number
          contact_unlocked: boolean
          decision_deadline_at: string
          distance_km: number
          ends_at: string
          estimate_max_eur: number
          estimate_min_eur: number
          funnel_type: string
          in_service_area: boolean
          lowest_offer_eur: number
          max_contact_purchases: number
          my_offer: Json
          offer_count: number
          postal_prefix: string
          published_at: string
          reference_price_eur: number
          region: string
          status: string
          summary: Json
        }[]
      }
      kw_dealer_unlock_contact: {
        Args: { p_auction_id: string }
        Returns: Json
      }
      kw_dealer_withdraw_offer: {
        Args: { p_auction_id: string }
        Returns: Json
      }
      kw_delete_planner_sessions: { Args: { p_ids: string[] }; Returns: number }
      kw_email_unsubscribe: {
        Args: { p_scope: string; p_user_id: string }
        Returns: Json
      }
      kw_enqueue: {
        Args: { p_delay?: string; p_event_type: string; p_payload: Json }
        Returns: undefined
      }
      kw_enqueue_order: {
        Args: { p_delay?: string; p_event_type: string; p_payload: Json }
        Returns: undefined
      }
      kw_gads_collect_conversions: { Args: never; Returns: number }
      kw_gads_credentials: { Args: never; Returns: Json }
      kw_gads_record_upload_results: {
        Args: { p_results: Json }
        Returns: number
      }
      kw_health_snapshot: { Args: never; Returns: Json }
      kw_insert_lead_with_consents: {
        Args: { p_consents: Json; p_lead: Json }
        Returns: string
      }
      kw_is_active_dealer: { Args: { p_uid: string }; Returns: boolean }
      kw_is_dealer_account: { Args: { p_uid: string }; Returns: boolean }
      kw_lead_estimate_eur: {
        Args: {
          p_key: string
          p_lead: Database["public"]["Tables"]["leads"]["Row"]
        }
        Returns: number
      }
      kw_lead_public_summary: {
        Args: { p_lead: Database["public"]["Tables"]["leads"]["Row"] }
        Returns: Json
      }
      kw_lead_share_consent: { Args: { p_lead_id: string }; Returns: boolean }
      kw_lead_storage_paths: {
        Args: { p_lead_id: string }
        Returns: {
          bucket: string
          path: string
        }[]
      }
      kw_lead_tier_score: {
        Args: {
          p_has_dimensions: boolean
          p_has_phone: boolean
          p_has_photo: boolean
          p_timeframe_months: number
          p_value_eur: number
        }
        Returns: {
          score: number
          tier: Database["public"]["Enums"]["lead_tier"]
        }[]
      }
      kw_marketplace_tick: { Args: never; Returns: Json }
      kw_open_tender: {
        Args: {
          p_estimate_max_eur: number
          p_estimate_min_eur: number
          p_lead_id: string
          p_planner_session_id?: string
          p_public_summary: Json
          p_publish: boolean
          p_reference_price_eur: number
        }
        Returns: string
      }
      kw_order_can_confirm: {
        Args: { p_confirmed_at: string; p_created_at: string; p_status: string }
        Returns: boolean
      }
      kw_order_json: {
        Args: { p_audience: string; p_order_id: string }
        Returns: Json
      }
      kw_order_outbox_claim: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          channel: string
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          payload: Json
          processed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "kw_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kw_order_status_rank: { Args: { p_status: string }; Returns: number }
      kw_order_tick: { Args: never; Returns: Json }
      kw_outbox_claim: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          available_at: string
          channel: string
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          payload: Json
          processed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "kw_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      kw_outbox_finish: {
        Args: { p_error?: string; p_id: number }
        Returns: undefined
      }
      kw_plz_distance_km: {
        Args: { p_a: string; p_b: string }
        Returns: number
      }
      kw_price_observations: {
        Args: { p_limit?: number }
        Returns: {
          auction_id: string
          bid_count: number
          created_at: string
          funnel: string
          funnel_answers: Json
          kitchen_form: string
          kitchen_style: string
          observed_eur: number
          planner_config: Json
          planner_room: Json
          postal_code: string
          shown_max_eur: number
          shown_mid_eur: number
          shown_min_eur: number
        }[]
      }
      kw_project_accept_offer: {
        Args: { p_bid_id: string; p_lead_id: string }
        Returns: Json
      }
      kw_project_cancel: {
        Args: {
          p_ip?: unknown
          p_lead_id: string
          p_reason?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      kw_project_erase: { Args: { p_lead_id: string }; Returns: Json }
      kw_project_export: { Args: { p_lead_id: string }; Returns: Json }
      kw_project_issue_token: {
        Args: { p_lead_id: string; p_token_hash: string }
        Returns: undefined
      }
      kw_project_order: { Args: { p_lead_id: string }; Returns: Json }
      kw_project_order_confirm: { Args: { p_lead_id: string }; Returns: Json }
      kw_project_order_report: {
        Args: { p_lead_id: string; p_message: string }
        Returns: Json
      }
      kw_project_resolve_token: {
        Args: { p_token_hash: string }
        Returns: string
      }
      kw_project_view: { Args: { p_lead_id: string }; Returns: Json }
      kw_redact_project_links: { Args: { p_value: string }; Returns: string }
      kw_retention_cleanup: { Args: never; Returns: Json }
      kw_retention_due_leads: {
        Args: { p_limit?: number }
        Returns: {
          lead_id: string
          reason: string
        }[]
      }
      kw_retention_stale_planner_files: {
        Args: { p_limit?: number }
        Returns: {
          bucket: string
          path: string
          session_id: string
        }[]
      }
      kw_studios_covering: { Args: { p_postal_code: string }; Returns: number }
      kw_tender_recipients: {
        Args: { p_auction_id: string }
        Returns: {
          company_name: string
          dealer_id: string
          distance_km: number
          email: string
          notify_email: boolean
        }[]
      }
      kw_turnstile_secret: { Args: never; Returns: string }
      kw_ux_detect_alerts: { Args: never; Returns: Json }
      kw_ux_field_label: { Args: { p_field: string }; Returns: string }
      kw_wilson_lower: {
        Args: { p_hits: number; p_total: number }
        Returns: number
      }
      lift_dealer_restriction: {
        Args: { dealer_id_param: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: undefined
      }
      log_error: {
        Args: {
          p_app_version?: string
          p_breadcrumbs?: Json
          p_browser?: string
          p_component_name?: string
          p_connection_type?: string
          p_device_type?: string
          p_environment?: string
          p_error_category?: string
          p_error_code: string
          p_error_hash?: string
          p_error_message: string
          p_error_source?: string
          p_http_status?: number
          p_memory_usage?: Json
          p_metadata?: Json
          p_original_error?: string
          p_page_path?: string
          p_page_title?: string
          p_page_url?: string
          p_request_info?: Json
          p_screen_resolution?: string
          p_session_id?: string
          p_severity?: string
          p_stack_trace?: string
          p_user_agent?: string
          p_user_email?: string
          p_user_id?: string
          p_user_role?: string
        }
        Returns: string
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      planner_rate_limit_increment: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          current_count: number
          reset_at: string
        }[]
      }
      planner_rate_limits_cleanup: {
        Args: { p_older_than_hours?: number }
        Returns: number
      }
      reapply_dealer_application: {
        Args: { application_id_param: string }
        Returns: undefined
      }
      record_agb_acceptance: {
        Args: {
          p_context?: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: undefined
      }
      release_cron_lock: { Args: { p_key: string }; Returns: undefined }
      restrict_dealer_account: {
        Args: { dealer_id_param: string; reason?: string }
        Returns: boolean
      }
      try_acquire_cron_lock: {
        Args: { p_key: string; p_ttl_minutes?: number }
        Returns: boolean
      }
      webhook_add_email_suppression: {
        Args: {
          p_email: string
          p_notes?: string
          p_reason: string
          p_source?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dealer" | "seller" | "consumer"
      kitchen_form_enum: "zeile" | "l" | "u" | "insel" | "parallel" | "g"
      lead_funnel_type: "a" | "b" | "traumkueche"
      lead_status:
        | "new"
        | "qualified"
        | "disqualified"
        | "matched"
        | "in_auction"
        | "sold"
        | "contacted"
        | "appointment_set"
        | "offer_sent"
        | "closed_won"
        | "closed_lost"
        | "disputed"
      lead_tier: "standard" | "qualified" | "premium" | "hot"
      style_segment_enum: "budget" | "mittel" | "premium" | "luxus"
      worktop_tier_enum: "basic" | "mid" | "premium"
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
      app_role: ["admin", "dealer", "seller", "consumer"],
      kitchen_form_enum: ["zeile", "l", "u", "insel", "parallel", "g"],
      lead_funnel_type: ["a", "b", "traumkueche"],
      lead_status: [
        "new",
        "qualified",
        "disqualified",
        "matched",
        "in_auction",
        "sold",
        "contacted",
        "appointment_set",
        "offer_sent",
        "closed_won",
        "closed_lost",
        "disputed",
      ],
      lead_tier: ["standard", "qualified", "premium", "hot"],
      style_segment_enum: ["budget", "mittel", "premium", "luxus"],
      worktop_tier_enum: ["basic", "mid", "premium"],
    },
  },
} as const
