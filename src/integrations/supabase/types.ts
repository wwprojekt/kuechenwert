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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
        Insert: {
          date?: string | null
          desktop_sessions?: number | null
          mobile_sessions?: number | null
          page_views?: number | null
          sessions?: number | null
          tablet_sessions?: number | null
          unique_visitors?: number | null
        }
        Update: {
          date?: string | null
          desktop_sessions?: number | null
          mobile_sessions?: number | null
          page_views?: number | null
          sessions?: number | null
          tablet_sessions?: number | null
          unique_visitors?: number | null
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
      appointments: {
        Row: {
          appointment_date: string
          created_at: string | null
          duration_minutes: number | null
          handover_protocol_url: string | null
          id: string
          motorhome_id: string
          notes: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_status: string | null
          pin_generated_at: string | null
          release_pin: string | null
          seller_id: string
          station_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          created_at?: string | null
          duration_minutes?: number | null
          handover_protocol_url?: string | null
          id?: string
          motorhome_id: string
          notes?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          pin_generated_at?: string | null
          release_pin?: string | null
          seller_id: string
          station_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          created_at?: string | null
          duration_minutes?: number | null
          handover_protocol_url?: string | null
          id?: string
          motorhome_id?: string
          notes?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          pin_generated_at?: string | null
          release_pin?: string | null
          seller_id?: string
          station_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "purchase_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          created_at: string
          current_bid: number | null
          end_time: string | null
          id: string
          kaufchance_expires_at: string | null
          motorhome_id: string
          reserve_price: number | null
          soft_close_extension_minutes: number
          start_time: string | null
          starting_bid: number
          status: Database["public"]["Enums"]["auction_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_bid?: number | null
          end_time?: string | null
          id?: string
          kaufchance_expires_at?: string | null
          motorhome_id: string
          reserve_price?: number | null
          soft_close_extension_minutes?: number
          start_time?: string | null
          starting_bid: number
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_bid?: number | null
          end_time?: string | null
          id?: string
          kaufchance_expires_at?: string | null
          motorhome_id?: string
          reserve_price?: number | null
          soft_close_extension_minutes?: number
          start_time?: string | null
          starting_bid?: number
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: true
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string
          id: string
          is_autobid: boolean
          max_autobid_amount: number | null
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string
          id?: string
          is_autobid?: boolean
          max_autobid_amount?: number | null
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string
          id?: string
          is_autobid?: boolean
          max_autobid_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      claim_photos: {
        Row: {
          claim_id: string
          display_order: number | null
          file_size: number | null
          id: string
          photo_description: string
          photo_type: string | null
          photo_url: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          claim_id: string
          display_order?: number | null
          file_size?: number | null
          id?: string
          photo_description: string
          photo_type?: string | null
          photo_url: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          claim_id?: string
          display_order?: number | null
          file_size?: number | null
          id?: string
          photo_description?: string
          photo_type?: string | null
          photo_url?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_photos_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_status_history: {
        Row: {
          change_reason: string | null
          changed_at: string | null
          changed_by: string
          claim_id: string
          id: string
          new_status: string
          notes: string | null
          previous_status: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by: string
          claim_id: string
          id?: string
          new_status: string
          notes?: string | null
          previous_status?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string | null
          changed_by?: string
          claim_id?: string
          id?: string
          new_status?: string
          notes?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          admin_notes: string | null
          approved_amount: number | null
          assigned_to: string | null
          auction_id: string
          claim_amount: number | null
          claim_type: string
          commission_charge_amount: number | null
          commission_charged_to_seller: boolean | null
          created_at: string | null
          dealer_id: string
          description: string
          id: string
          motorhome_id: string
          priority: string
          resolution_notes: string | null
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_amount?: number | null
          assigned_to?: string | null
          auction_id: string
          claim_amount?: number | null
          claim_type: string
          commission_charge_amount?: number | null
          commission_charged_to_seller?: boolean | null
          created_at?: string | null
          dealer_id: string
          description: string
          id?: string
          motorhome_id: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_amount?: number | null
          assigned_to?: string | null
          auction_id?: string
          claim_amount?: number | null
          claim_type?: string
          commission_charge_amount?: number | null
          commission_charged_to_seller?: boolean | null
          created_at?: string | null
          dealer_id?: string
          description?: string
          id?: string
          motorhome_id?: string
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_calculations: {
        Row: {
          auction_id: string
          base_commission_rate: number
          calculation_details: Json | null
          commission_amount: number
          created_at: string | null
          dealer_id: string
          final_commission_rate: number
          id: string
          sale_amount: number
          tier_used_id: string | null
          volume_discount_rate: number | null
        }
        Insert: {
          auction_id: string
          base_commission_rate: number
          calculation_details?: Json | null
          commission_amount: number
          created_at?: string | null
          dealer_id: string
          final_commission_rate: number
          id?: string
          sale_amount: number
          tier_used_id?: string | null
          volume_discount_rate?: number | null
        }
        Update: {
          auction_id?: string
          base_commission_rate?: number
          calculation_details?: Json | null
          commission_amount?: number
          created_at?: string | null
          dealer_id?: string
          final_commission_rate?: number
          id?: string
          sale_amount?: number
          tier_used_id?: string | null
          volume_discount_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_calculations_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_calculations_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_calculations_tier_used_id_fkey"
            columns: ["tier_used_id"]
            isOneToOne: false
            referencedRelation: "commission_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_amount: number
          min_amount: number
          min_commission: number | null
          rate_type: string
          rate_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_amount: number
          min_amount: number
          min_commission?: number | null
          rate_type: string
          rate_value: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_amount?: number
          min_amount?: number
          min_commission?: number | null
          rate_type?: string
          rate_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          admin_response: string | null
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
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
      damage_photos: {
        Row: {
          created_at: string | null
          damage_description: string
          damage_location: string | null
          damage_severity: string | null
          display_order: number | null
          file_size: number | null
          id: string
          motorhome_id: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          damage_description: string
          damage_location?: string | null
          damage_severity?: string | null
          display_order?: number | null
          file_size?: number | null
          id?: string
          motorhome_id: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          damage_description?: string
          damage_location?: string | null
          damage_severity?: string | null
          display_order?: number | null
          file_size?: number | null
          id?: string
          motorhome_id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_photos_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
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
          contact_person_name: string
          contact_person_position: string | null
          created_at: string
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
          submitted_at: string
          tax_id: string | null
          trade_license_document_url: string | null
          trade_license_number: string | null
          updated_at: string
          user_id: string
          ust_id_verified: boolean | null
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
          contact_person_name: string
          contact_person_position?: string | null
          created_at?: string
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
          submitted_at?: string
          tax_id?: string | null
          trade_license_document_url?: string | null
          trade_license_number?: string | null
          updated_at?: string
          user_id: string
          ust_id_verified?: boolean | null
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
          contact_person_name?: string
          contact_person_position?: string | null
          created_at?: string
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
          submitted_at?: string
          tax_id?: string | null
          trade_license_document_url?: string | null
          trade_license_number?: string | null
          updated_at?: string
          user_id?: string
          ust_id_verified?: boolean | null
          website?: string | null
        }
        Relationships: []
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
      dealer_levels: {
        Row: {
          id: string
          dealer_id: string
          level: string
          total_bids: number
          won_auctions: number
          total_volume: number
          points: number
          level_updated_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          dealer_id: string
          level?: string
          total_bids?: number
          won_auctions?: number
          total_volume?: number
          points?: number
          level_updated_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          dealer_id?: string
          level?: string
          total_bids?: number
          won_auctions?: number
          total_volume?: number
          points?: number
          level_updated_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_levels_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_rating_summary: {
        Row: {
          average_rating: number | null
          avg_communication: number | null
          avg_professionalism: number | null
          avg_reliability: number | null
          dealer_id: string
          last_calculated_at: string | null
          rating_1_count: number | null
          rating_2_count: number | null
          rating_3_count: number | null
          rating_4_count: number | null
          rating_5_count: number | null
          total_reviews: number | null
        }
        Insert: {
          average_rating?: number | null
          avg_communication?: number | null
          avg_professionalism?: number | null
          avg_reliability?: number | null
          dealer_id: string
          last_calculated_at?: string | null
          rating_1_count?: number | null
          rating_2_count?: number | null
          rating_3_count?: number | null
          rating_4_count?: number | null
          rating_5_count?: number | null
          total_reviews?: number | null
        }
        Update: {
          average_rating?: number | null
          avg_communication?: number | null
          avg_professionalism?: number | null
          avg_reliability?: number | null
          dealer_id?: string
          last_calculated_at?: string | null
          rating_1_count?: number | null
          rating_2_count?: number | null
          rating_3_count?: number | null
          rating_4_count?: number | null
          rating_5_count?: number | null
          total_reviews?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_rating_summary_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_reviews: {
        Row: {
          auction_id: string
          communication_rating: number
          created_at: string | null
          dealer_id: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          professionalism_rating: number
          rating: number
          reliability_rating: number
          review_text: string
          reviewer_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          auction_id: string
          communication_rating: number
          created_at?: string | null
          dealer_id: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          professionalism_rating: number
          rating: number
          reliability_rating: number
          review_text: string
          reviewer_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          auction_id?: string
          communication_rating?: number
          created_at?: string | null
          dealer_id?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          professionalism_rating?: number
          rating?: number
          reliability_rating?: number
          review_text?: string
          reviewer_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_reviews_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_reviews_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_volume_discounts: {
        Row: {
          active_until: string | null
          approved_by: string | null
          created_at: string | null
          dealer_id: string
          discount_rate: number
          id: string
          is_active: boolean | null
          reason: string | null
        }
        Insert: {
          active_until?: string | null
          approved_by?: string | null
          created_at?: string | null
          dealer_id: string
          discount_rate: number
          id?: string
          is_active?: boolean | null
          reason?: string | null
        }
        Update: {
          active_until?: string | null
          approved_by?: string | null
          created_at?: string | null
          dealer_id?: string
          discount_rate?: number
          id?: string
          is_active?: boolean | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_volume_discounts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          admin_notes: string | null
          browser: string | null
          component_name: string | null
          created_at: string
          device_type: string | null
          error_category: string
          error_code: string
          error_message: string
          id: string
          is_resolved: boolean | null
          metadata: Json | null
          original_error: string | null
          page_path: string
          page_title: string | null
          page_url: string
          resolved_at: string | null
          resolved_by: string | null
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
          browser?: string | null
          component_name?: string | null
          created_at?: string
          device_type?: string | null
          error_category?: string
          error_code: string
          error_message: string
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          original_error?: string | null
          page_path: string
          page_title?: string | null
          page_url: string
          resolved_at?: string | null
          resolved_by?: string | null
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
          browser?: string | null
          component_name?: string | null
          created_at?: string
          device_type?: string | null
          error_category?: string
          error_code?: string
          error_message?: string
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          original_error?: string | null
          page_path?: string
          page_title?: string | null
          page_url?: string
          resolved_at?: string | null
          resolved_by?: string | null
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
          auction_id: string | null
          created_at: string | null
          customer_number: string | null
          dealer_id: string
          due_date: string
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_terms_days: number | null
          pdf_url: string | null
          sent_at: string | null
          sepa_mandate_reference: string | null
          status: string
          tax_amount: number
          tax_rate: number
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          auction_id?: string | null
          created_at?: string | null
          customer_number?: string | null
          dealer_id: string
          due_date: string
          gross_amount: number
          id?: string
          invoice_date?: string
          invoice_number: string
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_terms_days?: number | null
          pdf_url?: string | null
          sent_at?: string | null
          sepa_mandate_reference?: string | null
          status?: string
          tax_amount: number
          tax_rate?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          auction_id?: string | null
          created_at?: string | null
          customer_number?: string | null
          dealer_id?: string
          due_date?: string
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_terms_days?: number | null
          pdf_url?: string | null
          sent_at?: string | null
          sepa_mandate_reference?: string | null
          status?: string
          tax_amount?: number
          tax_rate?: number
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          dealer_application_id: string
          document_type: string
          document_url: string
          file_size: number | null
          id: string
          notes: string | null
          original_filename: string
          uploaded_at: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          dealer_application_id: string
          document_type: string
          document_url: string
          file_size?: number | null
          id?: string
          notes?: string | null
          original_filename: string
          uploaded_at?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          dealer_application_id?: string
          document_type?: string
          document_url?: string
          file_size?: number | null
          id?: string
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
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      motorhome_photos: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          motorhome_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          motorhome_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          motorhome_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorhome_photos_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
      }
      motorhomes: {
        Row: {
          accident_free: boolean | null
          account_type: string | null
          additional_equipment: string | null
          air_conditioning_type:
            | Database["public"]["Enums"]["air_conditioning_type"]
            | null
          available_from: string | null
          awning_length_m: number | null
          battery_capacity_ah: number | null
          beds_description: string | null
          body_type: Database["public"]["Enums"]["motorhome_body_type"]
          city: string | null
          condition: Database["public"]["Enums"]["motorhome_condition"]
          country: string | null
          created_at: string | null
          damage_summary: string | null
          description: string | null
          emission_class: Database["public"]["Enums"]["emission_class"] | null
          engine_displacement_ccm: number | null
          engine_power_hp: number | null
          first_registration: string | null
          fuel_tank_capacity_liters: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"] | null
          gas_system: string | null
          grey_water_capacity_liters: number | null
          has_air_conditioning: boolean | null
          has_airbag: boolean | null
          has_alarm: boolean | null
          has_awning: boolean | null
          has_backup_camera: boolean | null
          has_bathroom: boolean | null
          has_bike_rack: boolean | null
          has_central_locking: boolean | null
          has_cruise_control: boolean | null
          has_damage: boolean | null
          has_esp: boolean | null
          has_garage: boolean | null
          has_heating: boolean | null
          has_inverter: boolean | null
          has_kitchen: boolean | null
          has_markise: boolean | null
          has_navigation: boolean | null
          has_parking_sensors: boolean | null
          has_satellite: boolean | null
          has_shower: boolean | null
          has_solar: boolean | null
          has_swivel_seats: boolean | null
          has_toilet: boolean | null
          has_tuev: boolean | null
          has_tv: boolean | null
          heating_type: Database["public"]["Enums"]["heating_type"] | null
          height_m: number | null
          id: string
          instant_price: number | null
          last_tuev_date: string | null
          length_m: number | null
          license_plate: string | null
          listing_number: string | null
          location: string | null
          main_tires: string | null
          manufacturer: string
          mileage: number
          model: string
          non_smoker: boolean | null
          number_of_axles: number | null
          payload_kg: number | null
          postal_code: string | null
          previous_owners: number | null
          price: number | null
          refrigerator_type:
            | Database["public"]["Enums"]["refrigerator_type"]
            | null
          reserve_price: number | null
          sale_channel: Database["public"]["Enums"]["sale_channel"] | null
          sale_type: string | null
          seats: number | null
          second_tires: string | null
          seller_id: string
          service_history_available: boolean | null
          sleeping_places: number | null
          solar_power_watts: number | null
          sold_at: string | null
          sold_to: string | null
          status: string
          transmission: Database["public"]["Enums"]["transmission_type"] | null
          tuev_valid_until: string | null
          updated_at: string | null
          vehicle_identification_number: string | null
          water_tank_liters: number | null
          weight_kg: number | null
          width_m: number | null
          year: number
        }
        Insert: {
          accident_free?: boolean | null
          account_type?: string | null
          additional_equipment?: string | null
          air_conditioning_type?:
            | Database["public"]["Enums"]["air_conditioning_type"]
            | null
          available_from?: string | null
          awning_length_m?: number | null
          battery_capacity_ah?: number | null
          beds_description?: string | null
          body_type: Database["public"]["Enums"]["motorhome_body_type"]
          city?: string | null
          condition: Database["public"]["Enums"]["motorhome_condition"]
          country?: string | null
          created_at?: string | null
          damage_summary?: string | null
          description?: string | null
          emission_class?: Database["public"]["Enums"]["emission_class"] | null
          engine_displacement_ccm?: number | null
          engine_power_hp?: number | null
          first_registration?: string | null
          fuel_tank_capacity_liters?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          gas_system?: string | null
          grey_water_capacity_liters?: number | null
          has_air_conditioning?: boolean | null
          has_airbag?: boolean | null
          has_alarm?: boolean | null
          has_awning?: boolean | null
          has_backup_camera?: boolean | null
          has_bathroom?: boolean | null
          has_bike_rack?: boolean | null
          has_central_locking?: boolean | null
          has_cruise_control?: boolean | null
          has_damage?: boolean | null
          has_esp?: boolean | null
          has_garage?: boolean | null
          has_heating?: boolean | null
          has_inverter?: boolean | null
          has_kitchen?: boolean | null
          has_markise?: boolean | null
          has_navigation?: boolean | null
          has_parking_sensors?: boolean | null
          has_satellite?: boolean | null
          has_shower?: boolean | null
          has_solar?: boolean | null
          has_swivel_seats?: boolean | null
          has_toilet?: boolean | null
          has_tuev?: boolean | null
          has_tv?: boolean | null
          heating_type?: Database["public"]["Enums"]["heating_type"] | null
          height_m?: number | null
          id?: string
          instant_price?: number | null
          last_tuev_date?: string | null
          length_m?: number | null
          license_plate?: string | null
          listing_number?: string | null
          location?: string | null
          main_tires?: string | null
          manufacturer: string
          mileage: number
          model: string
          non_smoker?: boolean | null
          number_of_axles?: number | null
          payload_kg?: number | null
          postal_code?: string | null
          previous_owners?: number | null
          price?: number | null
          refrigerator_type?:
            | Database["public"]["Enums"]["refrigerator_type"]
            | null
          reserve_price?: number | null
          sale_channel?: Database["public"]["Enums"]["sale_channel"] | null
          sale_type?: string | null
          seats?: number | null
          second_tires?: string | null
          seller_id: string
          service_history_available?: boolean | null
          sleeping_places?: number | null
          solar_power_watts?: number | null
          sold_at?: string | null
          sold_to?: string | null
          status?: string
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          tuev_valid_until?: string | null
          updated_at?: string | null
          vehicle_identification_number?: string | null
          water_tank_liters?: number | null
          weight_kg?: number | null
          width_m?: number | null
          year: number
        }
        Update: {
          accident_free?: boolean | null
          account_type?: string | null
          additional_equipment?: string | null
          air_conditioning_type?:
            | Database["public"]["Enums"]["air_conditioning_type"]
            | null
          available_from?: string | null
          awning_length_m?: number | null
          battery_capacity_ah?: number | null
          beds_description?: string | null
          body_type?: Database["public"]["Enums"]["motorhome_body_type"]
          city?: string | null
          condition?: Database["public"]["Enums"]["motorhome_condition"]
          country?: string | null
          created_at?: string | null
          damage_summary?: string | null
          description?: string | null
          emission_class?: Database["public"]["Enums"]["emission_class"] | null
          engine_displacement_ccm?: number | null
          engine_power_hp?: number | null
          first_registration?: string | null
          fuel_tank_capacity_liters?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"] | null
          gas_system?: string | null
          grey_water_capacity_liters?: number | null
          has_air_conditioning?: boolean | null
          has_airbag?: boolean | null
          has_alarm?: boolean | null
          has_awning?: boolean | null
          has_backup_camera?: boolean | null
          has_bathroom?: boolean | null
          has_bike_rack?: boolean | null
          has_central_locking?: boolean | null
          has_cruise_control?: boolean | null
          has_damage?: boolean | null
          has_esp?: boolean | null
          has_garage?: boolean | null
          has_heating?: boolean | null
          has_inverter?: boolean | null
          has_kitchen?: boolean | null
          has_markise?: boolean | null
          has_navigation?: boolean | null
          has_parking_sensors?: boolean | null
          has_satellite?: boolean | null
          has_shower?: boolean | null
          has_solar?: boolean | null
          has_swivel_seats?: boolean | null
          has_toilet?: boolean | null
          has_tuev?: boolean | null
          has_tv?: boolean | null
          heating_type?: Database["public"]["Enums"]["heating_type"] | null
          height_m?: number | null
          id?: string
          instant_price?: number | null
          last_tuev_date?: string | null
          length_m?: number | null
          license_plate?: string | null
          listing_number?: string | null
          location?: string | null
          main_tires?: string | null
          manufacturer?: string
          mileage?: number
          model?: string
          non_smoker?: boolean | null
          number_of_axles?: number | null
          payload_kg?: number | null
          postal_code?: string | null
          previous_owners?: number | null
          price?: number | null
          refrigerator_type?:
            | Database["public"]["Enums"]["refrigerator_type"]
            | null
          reserve_price?: number | null
          sale_channel?: Database["public"]["Enums"]["sale_channel"] | null
          sale_type?: string | null
          seats?: number | null
          second_tires?: string | null
          seller_id?: string
          service_history_available?: boolean | null
          sleeping_places?: number | null
          solar_power_watts?: number | null
          sold_at?: string | null
          sold_to?: string | null
          status?: string
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          tuev_valid_until?: string | null
          updated_at?: string | null
          vehicle_identification_number?: string | null
          water_tank_liters?: number | null
          weight_kg?: number | null
          width_m?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorhomes_seller_id_fkey"
            columns: ["seller_id"]
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
          notes: string | null
          reminder_level: number
          sent_at: string
          status: string
        }
        Insert: {
          amount_due: number
          created_at?: string | null
          due_date: string
          id?: string
          invoice_id: string
          notes?: string | null
          reminder_level: number
          sent_at?: string
          status?: string
        }
        Update: {
          amount_due?: number
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          reminder_level?: number
          sent_at?: string
          status?: string
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
      pin_attempts: {
        Row: {
          appointment_id: string
          attempted_pin: string
          created_at: string | null
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          appointment_id: string
          attempted_pin: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          appointment_id?: string
          attempted_pin?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pin_attempts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_auction_offers: {
        Row: {
          auction_id: string
          buyer_id: string
          created_at: string | null
          id: string
          message: string | null
          offer_amount: number
          responded_at: string | null
          seller_response: string | null
          status: string
        }
        Insert: {
          auction_id: string
          buyer_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          offer_amount: number
          responded_at?: string | null
          seller_response?: string | null
          status?: string
        }
        Update: {
          auction_id?: string
          buyer_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          offer_amount?: number
          responded_at?: string | null
          seller_response?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_auction_offers_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
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
          first_name: string | null
          id: string
          is_suspended: boolean | null
          is_verified: boolean | null
          last_name: string | null
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
          first_name?: string | null
          id: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
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
          first_name?: string | null
          id?: string
          is_suspended?: boolean | null
          is_verified?: boolean | null
          last_name?: string | null
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
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      purchase_stations: {
        Row: {
          accepts_cash_payment: boolean | null
          accepts_sepa_instant: boolean | null
          address: string
          city: string
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          manager_name: string | null
          name: string
          opening_hours: Json | null
          phone: string
          postal_code: string
          updated_at: string | null
        }
        Insert: {
          accepts_cash_payment?: boolean | null
          accepts_sepa_instant?: boolean | null
          address: string
          city: string
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name: string
          opening_hours?: Json | null
          phone: string
          postal_code: string
          updated_at?: string | null
        }
        Update: {
          accepts_cash_payment?: boolean | null
          accepts_sepa_instant?: boolean | null
          address?: string
          city?: string
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name?: string
          opening_hours?: Json | null
          phone?: string
          postal_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quick_leads: {
        Row: {
          admin_notes: string | null
          body_type: string | null
          contacted_at: string | null
          created_at: string | null
          email: string | null
          form_data_snapshot: Record<string, unknown> | null
          id: string
          last_wizard_step: number | null
          lead_quality: string | null
          manufacturer: string | null
          max_wizard_step: number | null
          model: string | null
          name: string | null
          notes: string | null
          page_url: string | null
          phone: string | null
          referrer: string | null
          sale_channel: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_agent: string | null
          wizard_completed: boolean | null
        }
        Insert: {
          admin_notes?: string | null
          body_type?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          form_data_snapshot?: Record<string, unknown> | null
          id?: string
          last_wizard_step?: number | null
          lead_quality?: string | null
          manufacturer?: string | null
          max_wizard_step?: number | null
          model?: string | null
          name?: string | null
          notes?: string | null
          page_url?: string | null
          phone?: string | null
          referrer?: string | null
          sale_channel?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
          wizard_completed?: boolean | null
        }
        Update: {
          admin_notes?: string | null
          body_type?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          form_data_snapshot?: Record<string, unknown> | null
          id?: string
          last_wizard_step?: number | null
          lead_quality?: string | null
          manufacturer?: string | null
          max_wizard_step?: number | null
          model?: string | null
          name?: string | null
          notes?: string | null
          page_url?: string | null
          phone?: string | null
          referrer?: string | null
          sale_channel?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_agent?: string | null
          wizard_completed?: boolean | null
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
      review_responses: {
        Row: {
          created_at: string | null
          id: string
          responder_id: string
          response_text: string
          review_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          responder_id: string
          response_text: string
          review_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          responder_id?: string
          response_text?: string
          review_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "dealer_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      search_alert_matches: {
        Row: {
          alert_id: string
          id: string
          matched_at: string | null
          motorhome_id: string
          notification_sent: boolean | null
          notification_sent_at: string | null
        }
        Insert: {
          alert_id: string
          id?: string
          matched_at?: string | null
          motorhome_id: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
        }
        Update: {
          alert_id?: string
          id?: string
          matched_at?: string | null
          motorhome_id?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_alert_matches_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "search_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_alert_matches_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
      }
      search_alerts: {
        Row: {
          alert_frequency: string | null
          alert_name: string
          created_at: string | null
          dealer_id: string
          email_enabled: boolean | null
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          last_triggered_at: string | null
          match_count: number | null
          max_price: number | null
          max_year: number | null
          min_year: number | null
          search_criteria: Json
          updated_at: string | null
        }
        Insert: {
          alert_frequency?: string | null
          alert_name: string
          created_at?: string | null
          dealer_id: string
          email_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          last_triggered_at?: string | null
          match_count?: number | null
          max_price?: number | null
          max_year?: number | null
          min_year?: number | null
          search_criteria: Json
          updated_at?: string | null
        }
        Update: {
          alert_frequency?: string | null
          alert_name?: string
          created_at?: string | null
          dealer_id?: string
          email_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          last_triggered_at?: string | null
          match_count?: number | null
          max_price?: number | null
          max_year?: number | null
          min_year?: number | null
          search_criteria?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_alerts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          autobid_enabled: boolean
          buy_now_enabled: boolean
          commission_rate_percent: number
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_postal_code: string | null
          contact_email: string
          created_at: string
          dark_mode_enabled: boolean
          default_auction_duration_days: number
          favicon_url: string | null
          from_email: string
          google_analytics_id: string | null
          google_tag_manager_id: string | null
          id: string
          logo_url: string | null
          maintenance_mode: boolean
          meta_description: string
          meta_keywords: string
          meta_title: string
          min_bid_increment_percent: number
          notify_new_auction: boolean
          notify_new_bid: boolean
          notify_new_registration: boolean
          primary_color: string
          reserve_price_required: boolean
          secondary_color: string
          site_description: string
          site_name: string
          site_tagline: string
          sitemap_enabled: boolean
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          soft_close_extension_minutes: number
          support_phone: string
          bank_iban: string | null
          bank_bic: string | null
          bank_name: string | null
          ust_id: string | null
          tax_number: string | null
          managing_director: string | null
          hrb_number: string | null
          invoice_footer_text: string | null
          invoice_payment_terms_days: number | null
          dunning_level1_days: number | null
          dunning_level1_fee: number | null
          dunning_level2_days: number | null
          dunning_level2_fee: number | null
          dunning_level3_days: number | null
          dunning_level3_fee: number | null
          dunning_restrict_at_level: number | null
          dunning_auto_enabled: boolean | null
          tuv_badge_url: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          autobid_enabled?: boolean
          buy_now_enabled?: boolean
          commission_rate_percent?: number
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string
          created_at?: string
          dark_mode_enabled?: boolean
          default_auction_duration_days?: number
          favicon_url?: string | null
          from_email?: string
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          id?: string
          logo_url?: string | null
          maintenance_mode?: boolean
          meta_description?: string
          meta_keywords?: string
          meta_title?: string
          min_bid_increment_percent?: number
          notify_new_auction?: boolean
          notify_new_bid?: boolean
          notify_new_registration?: boolean
          primary_color?: string
          reserve_price_required?: boolean
          secondary_color?: string
          site_description?: string
          site_name?: string
          site_tagline?: string
          sitemap_enabled?: boolean
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          soft_close_extension_minutes?: number
          support_phone?: string
          bank_iban?: string | null
          bank_bic?: string | null
          bank_name?: string | null
          ust_id?: string | null
          tax_number?: string | null
          managing_director?: string | null
          hrb_number?: string | null
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          dunning_level1_days?: number | null
          dunning_level1_fee?: number | null
          dunning_level2_days?: number | null
          dunning_level2_fee?: number | null
          dunning_level3_days?: number | null
          dunning_level3_fee?: number | null
          dunning_restrict_at_level?: number | null
          dunning_auto_enabled?: boolean | null
          tuv_badge_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          autobid_enabled?: boolean
          buy_now_enabled?: boolean
          commission_rate_percent?: number
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string
          created_at?: string
          dark_mode_enabled?: boolean
          default_auction_duration_days?: number
          favicon_url?: string | null
          from_email?: string
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          id?: string
          logo_url?: string | null
          maintenance_mode?: boolean
          meta_description?: string
          meta_keywords?: string
          meta_title?: string
          min_bid_increment_percent?: number
          notify_new_auction?: boolean
          notify_new_bid?: boolean
          notify_new_registration?: boolean
          primary_color?: string
          reserve_price_required?: boolean
          secondary_color?: string
          site_description?: string
          site_name?: string
          site_tagline?: string
          sitemap_enabled?: boolean
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          soft_close_extension_minutes?: number
          support_phone?: string
          bank_iban?: string | null
          bank_bic?: string | null
          bank_name?: string | null
          ust_id?: string | null
          tax_number?: string | null
          managing_director?: string | null
          hrb_number?: string | null
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          dunning_level1_days?: number | null
          dunning_level1_fee?: number | null
          dunning_level2_days?: number | null
          dunning_level2_fee?: number | null
          dunning_level3_days?: number | null
          dunning_level3_fee?: number | null
          dunning_restrict_at_level?: number | null
          dunning_auto_enabled?: boolean | null
          tuv_badge_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      station_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          station_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          station_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          station_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "station_availability_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "purchase_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string | null
          id: string
          reason: string | null
          station_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string | null
          id?: string
          reason?: string | null
          station_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_blocked_dates_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "purchase_stations"
            referencedColumns: ["id"]
          },
        ]
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
      user_favorites: {
        Row: {
          created_at: string | null
          id: string
          motorhome_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          motorhome_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          motorhome_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          audio_auction_won: boolean | null
          audio_enabled: boolean | null
          audio_new_bid: boolean | null
          audio_outbid: boolean | null
          audio_volume: number | null
          created_at: string | null
          digest_frequency: string | null
          email_auction_ending: boolean | null
          email_auction_won: boolean | null
          email_new_auction: boolean | null
          email_new_bid: boolean | null
          email_outbid: boolean | null
          email_payment_reminder: boolean | null
          email_price_alerts: boolean | null
          id: string
          newsletter_enabled: boolean | null
          promotional_emails: boolean | null
          push_auction_ending: boolean | null
          push_enabled: boolean | null
          push_new_bid: boolean | null
          push_outbid: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_auction_won?: boolean | null
          audio_enabled?: boolean | null
          audio_new_bid?: boolean | null
          audio_outbid?: boolean | null
          audio_volume?: number | null
          created_at?: string | null
          digest_frequency?: string | null
          email_auction_ending?: boolean | null
          email_auction_won?: boolean | null
          email_new_auction?: boolean | null
          email_new_bid?: boolean | null
          email_outbid?: boolean | null
          email_payment_reminder?: boolean | null
          email_price_alerts?: boolean | null
          id?: string
          newsletter_enabled?: boolean | null
          promotional_emails?: boolean | null
          push_auction_ending?: boolean | null
          push_enabled?: boolean | null
          push_new_bid?: boolean | null
          push_outbid?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_auction_won?: boolean | null
          audio_enabled?: boolean | null
          audio_new_bid?: boolean | null
          audio_outbid?: boolean | null
          audio_volume?: number | null
          created_at?: string | null
          digest_frequency?: string | null
          email_auction_ending?: boolean | null
          email_auction_won?: boolean | null
          email_new_auction?: boolean | null
          email_new_bid?: boolean | null
          email_outbid?: boolean | null
          email_payment_reminder?: boolean | null
          email_price_alerts?: boolean | null
          id?: string
          newsletter_enabled?: boolean | null
          promotional_emails?: boolean | null
          push_auction_ending?: boolean | null
          push_enabled?: boolean | null
          push_new_bid?: boolean | null
          push_outbid?: boolean | null
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
      value_assessment_leads: {
        Row: {
          admin_notes: string | null
          body_type: string | null
          condition: string | null
          contacted_at: string | null
          created_at: string | null
          email: string
          estimated_value_max: number | null
          estimated_value_min: number | null
          id: string
          manufacturer: string | null
          message: string | null
          mileage: number | null
          model: string | null
          name: string
          phone: string | null
          source: string
          status: string | null
          year: number | null
        }
        Insert: {
          admin_notes?: string | null
          body_type?: string | null
          condition?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email: string
          estimated_value_max?: number | null
          estimated_value_min?: number | null
          id?: string
          manufacturer?: string | null
          message?: string | null
          mileage?: number | null
          model?: string | null
          name: string
          phone?: string | null
          source: string
          status?: string | null
          year?: number | null
        }
        Update: {
          admin_notes?: string | null
          body_type?: string | null
          condition?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string
          estimated_value_max?: number | null
          estimated_value_min?: number | null
          id?: string
          manufacturer?: string | null
          message?: string | null
          mileage?: number | null
          model?: string | null
          name?: string
          phone?: string | null
          source?: string
          status?: string | null
          year?: number | null
        }
        Relationships: []
      }
      vehicle_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          motorhome_id: string | null
          question: string
          questioner_email: string
          questioner_id: string | null
          questioner_name: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          motorhome_id?: string | null
          question: string
          questioner_email: string
          questioner_id?: string | null
          questioner_name?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          motorhome_id?: string | null
          question?: string
          questioner_email?: string
          questioner_id?: string | null
          questioner_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_questions_motorhome_id_fkey"
            columns: ["motorhome_id"]
            isOneToOne: false
            referencedRelation: "motorhomes"
            referencedColumns: ["id"]
          },
        ]
      }
      wizard_sessions: {
        Row: {
          admin_called_at: string | null
          admin_notes: string | null
          anonymous_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          form_data: Json
          id: string
          last_activity_at: string | null
          max_step_reached: number
          followup_email_sent_at: string | null
          resume_email_sent_at: string | null
          status: string
          step_name: string | null
          total_steps: number
          updated_at: string | null
          user_id: string | null
          vehicle_summary: string | null
        }
        Insert: {
          admin_called_at?: string | null
          admin_notes?: string | null
          anonymous_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_data?: Json
          id?: string
          last_activity_at?: string | null
          max_step_reached?: number
          followup_email_sent_at?: string | null
          resume_email_sent_at?: string | null
          status?: string
          step_name?: string | null
          total_steps?: number
          updated_at?: string | null
          user_id?: string | null
          vehicle_summary?: string | null
        }
        Update: {
          admin_called_at?: string | null
          admin_notes?: string | null
          anonymous_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_data?: Json
          id?: string
          last_activity_at?: string | null
          max_step_reached?: number
          followup_email_sent_at?: string | null
          resume_email_sent_at?: string | null
          status?: string
          step_name?: string | null
          total_steps?: number
          updated_at?: string | null
          user_id?: string | null
          vehicle_summary?: string | null
        }
        Relationships: []
      }
    }
    Views: {
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
    }
    Functions: {
      admin_search_listings: {
        Args: { search_term?: string }
        Returns: {
          created_at: string
          listing_id: string
          listing_number: string
          manufacturer: string
          model: string
          seller_email: string
          seller_name: string
          status: string
          year: number
        }[]
      }
      approve_dealer_application: {
        Args: { application_id_param: string }
        Returns: undefined
      }
      calculate_commission: {
        Args: { dealer_id_param?: string; sale_amount: number }
        Returns: {
          base_rate: number
          commission_amount: number
          final_rate: number
          tier_id: string
          volume_discount: number
        }[]
      }
      check_search_criteria_match: {
        Args: { criteria: Json; motorhome_record: Record<string, unknown> }
        Returns: boolean
      }
      clean_old_analytics_data: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_expired_rate_limits: { Args: never; Returns: number }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      create_auction_invoice: {
        Args: { auction_id_param: string; dealer_id_param: string }
        Returns: string
      }
      generate_invoice_number: { Args: never; Returns: string }
      generate_listing_number: { Args: never; Returns: string }
      generate_release_pin: { Args: never; Returns: string }
      generate_sepa_reference: { Args: never; Returns: string }
      get_primary_role: {
        Args: { user_id_param: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      handle_autobid_atomic: {
        Args: {
          p_auction_id: string
          p_min_increment?: number
          p_new_bid_amount: number
          p_new_bidder_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lift_dealer_restriction: {
        Args: { dealer_id_param: string }
        Returns: boolean
      }
      process_approved_claim: {
        Args: { claim_id_param: string }
        Returns: undefined
      }
      process_search_alerts_for_motorhome: {
        Args: { motorhome_id_param: string }
        Returns: number
      }
      restrict_dealer_account: {
        Args: { dealer_id_param: string; reason?: string }
        Returns: boolean
      }
      update_dealer_rating_summary: {
        Args: { dealer_id_param: string }
        Returns: undefined
      }
      update_motorhome_damage_status: {
        Args: { motorhome_id_param: string }
        Returns: undefined
      }
    }
    Enums: {
      air_conditioning_type: "Keine" | "Fahrerhaus" | "Wohnraum" | "Beides"
      app_role: "admin" | "dealer" | "seller"
      auction_status:
        | "draft"
        | "active"
        | "ended"
        | "sold"
        | "cancelled"
        | "kaufchance"
      emission_class:
        | "Euro 3"
        | "Euro 4"
        | "Euro 5"
        | "Euro 6"
        | "Euro 6c"
        | "Euro 6d-TEMP"
        | "Euro 6d"
      fuel_type: "Diesel" | "Benzin" | "Elektro" | "Hybrid"
      heating_type: "Gas" | "Diesel" | "Elektrisch" | "Kombiniert"
      motorhome_body_type:
        | "Teilintegriert"
        | "Alkoven"
        | "Vollintegriert"
        | "Kastenwagen"
        | "Campingbus"
        | "Wohnwagen"
        | "Faltcaravan"
        | "Mobilheim"
      motorhome_condition:
        | "Neuwertig"
        | "Sehr gut"
        | "Gut"
        | "Befriedigend"
        | "Reparaturbedürftig"
      refrigerator_type: "Kompressor" | "Absorber" | "Thermoelektrisch"
      sale_channel: "instant_price" | "auction" | "station"
      transmission_type: "Schaltgetriebe" | "Automatik"
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
      air_conditioning_type: ["Keine", "Fahrerhaus", "Wohnraum", "Beides"],
      app_role: ["admin", "dealer", "seller"],
      auction_status: [
        "draft",
        "active",
        "ended",
        "sold",
        "cancelled",
        "kaufchance",
      ],
      emission_class: [
        "Euro 3",
        "Euro 4",
        "Euro 5",
        "Euro 6",
        "Euro 6c",
        "Euro 6d-TEMP",
        "Euro 6d",
      ],
      fuel_type: ["Diesel", "Benzin", "Elektro", "Hybrid"],
      heating_type: ["Gas", "Diesel", "Elektrisch", "Kombiniert"],
      motorhome_body_type: [
        "Teilintegriert",
        "Alkoven",
        "Vollintegriert",
        "Kastenwagen",
        "Campingbus",
        "Wohnwagen",
        "Faltcaravan",
        "Mobilheim",
      ],
      motorhome_condition: [
        "Neuwertig",
        "Sehr gut",
        "Gut",
        "Befriedigend",
        "Reparaturbedürftig",
      ],
      refrigerator_type: ["Kompressor", "Absorber", "Thermoelektrisch"],
      sale_channel: ["instant_price", "auction", "station"],
      transmission_type: ["Schaltgetriebe", "Automatik"],
    },
  },
} as const
