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
      appointments: {
        Row: {
          appointment_date: string
          created_at: string | null
          duration_minutes: number | null
          handover_protocol_url: string | null
          id: string
          kitchen_id: string
          notes: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_status: string | null
          pin_generated_at: string | null
          release_pin: string | null
          reminder_sent: boolean | null
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
          kitchen_id: string
          notes?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          pin_generated_at?: string | null
          release_pin?: string | null
          reminder_sent?: boolean | null
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
          kitchen_id?: string
          notes?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          pin_generated_at?: string | null
          release_pin?: string | null
          reminder_sent?: boolean | null
          seller_id?: string
          station_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
      auction_addenda: {
        Row: {
          auction_id: string
          content: string
          created_at: string
          id: string
          seller_id: string
        }
        Insert: {
          auction_id: string
          content: string
          created_at?: string
          id?: string
          seller_id: string
        }
        Update: {
          auction_id?: string
          content?: string
          created_at?: string
          id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_addenda_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_addenda_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          agb_version_at_start: string | null
          auction_round: number
          auto_relist: boolean
          created_at: string
          current_bid: number | null
          dynamic_pricing: boolean
          end_time: string | null
          festpreis_admin_notified_at: string | null
          id: string
          kaufchance_expires_at: string | null
          kaufchance_min_price: number | null
          kitchen_id: string
          last_price_reduction_at: string | null
          marketing_phase_max_until: string | null
          marketing_phase_started_at: string | null
          reserve_price: number | null
          seller_initial_instant_price: number | null
          seller_initial_reserve: number | null
          soft_close_extension_minutes: number
          start_time: string | null
          starting_bid: number
          status: Database["public"]["Enums"]["auction_status"]
          updated_at: string
        }
        Insert: {
          agb_version_at_start?: string | null
          auction_round?: number
          auto_relist?: boolean
          created_at?: string
          current_bid?: number | null
          dynamic_pricing?: boolean
          end_time?: string | null
          festpreis_admin_notified_at?: string | null
          id?: string
          kaufchance_expires_at?: string | null
          kaufchance_min_price?: number | null
          kitchen_id: string
          last_price_reduction_at?: string | null
          marketing_phase_max_until?: string | null
          marketing_phase_started_at?: string | null
          reserve_price?: number | null
          seller_initial_instant_price?: number | null
          seller_initial_reserve?: number | null
          soft_close_extension_minutes?: number
          start_time?: string | null
          starting_bid: number
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string
        }
        Update: {
          agb_version_at_start?: string | null
          auction_round?: number
          auto_relist?: boolean
          created_at?: string
          current_bid?: number | null
          dynamic_pricing?: boolean
          end_time?: string | null
          festpreis_admin_notified_at?: string | null
          id?: string
          kaufchance_expires_at?: string | null
          kaufchance_min_price?: number | null
          kitchen_id?: string
          last_price_reduction_at?: string | null
          marketing_phase_max_until?: string | null
          marketing_phase_started_at?: string | null
          reserve_price?: number | null
          seller_initial_instant_price?: number | null
          seller_initial_reserve?: number | null
          soft_close_extension_minutes?: number
          start_time?: string | null
          starting_bid?: number
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: true
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
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
      bing_oauth_state: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_error_at: string | null
          last_refreshed_at: string
          lock_holder_until: string | null
          refresh_token: string
          rotation_count: number
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          id: string
          last_error?: string | null
          last_error_at?: string | null
          last_refreshed_at?: string
          lock_holder_until?: string | null
          refresh_token: string
          rotation_count?: number
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_refreshed_at?: string
          lock_holder_until?: string | null
          refresh_token?: string
          rotation_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      bing_offline_conversions_log: {
        Row: {
          auction_id: string | null
          conversion_currency: string
          conversion_name: string
          conversion_time: string
          conversion_value: number
          error_message: string | null
          http_status: number | null
          id: string
          kitchen_id: string
          msclkid: string | null
          source: string
          status: string
          uploaded_at: string
        }
        Insert: {
          auction_id?: string | null
          conversion_currency?: string
          conversion_name: string
          conversion_time: string
          conversion_value: number
          error_message?: string | null
          http_status?: number | null
          id?: string
          kitchen_id: string
          msclkid?: string | null
          source: string
          status: string
          uploaded_at?: string
        }
        Update: {
          auction_id?: string | null
          conversion_currency?: string
          conversion_name?: string
          conversion_time?: string
          conversion_value?: number
          error_message?: string | null
          http_status?: number | null
          id?: string
          kitchen_id?: string
          msclkid?: string | null
          source?: string
          status?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bing_offline_conversions_log_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
          kitchen_id: string
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
          kitchen_id: string
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
          kitchen_id?: string
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
            foreignKeyName: "claims_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
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
            foreignKeyName: "claims_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
            foreignKeyName: "commission_calculations_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
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
      commission_tier_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_row: Json | null
          old_row: Json | null
          operation: string
          tier_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          operation: string
          tier_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          operation?: string
          tier_id?: string
        }
        Relationships: []
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
          updated_at: string | null
        }
        Insert: {
          admin_response?: string | null
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
          updated_at?: string | null
        }
        Update: {
          admin_response?: string | null
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
      damage_photos: {
        Row: {
          created_at: string | null
          damage_description: string
          damage_location: string | null
          damage_severity: string | null
          display_order: number | null
          file_size: number | null
          id: string
          kitchen_id: string
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
          kitchen_id: string
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
          kitchen_id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "damage_photos_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
      dealer_instant_buy_alerts: {
        Row: {
          body_types: string[]
          countries: string[]
          created_at: string
          enabled: boolean
          last_alert_at: string | null
          manufacturers: string[]
          max_mileage: number | null
          max_price: number | null
          max_year: number | null
          min_price: number | null
          min_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_types?: string[]
          countries?: string[]
          created_at?: string
          enabled?: boolean
          last_alert_at?: string | null
          manufacturers?: string[]
          max_mileage?: number | null
          max_price?: number | null
          max_year?: number | null
          min_price?: number | null
          min_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body_types?: string[]
          countries?: string[]
          created_at?: string
          enabled?: boolean
          last_alert_at?: string | null
          manufacturers?: string[]
          max_mileage?: number | null
          max_price?: number | null
          max_year?: number | null
          min_price?: number | null
          min_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dealer_levels: {
        Row: {
          created_at: string | null
          dealer_id: string
          id: string
          level: string
          level_updated_at: string | null
          points: number
          total_bids: number
          total_volume: number
          updated_at: string | null
          won_auctions: number
        }
        Insert: {
          created_at?: string | null
          dealer_id: string
          id?: string
          level?: string
          level_updated_at?: string | null
          points?: number
          total_bids?: number
          total_volume?: number
          updated_at?: string | null
          won_auctions?: number
        }
        Update: {
          created_at?: string | null
          dealer_id?: string
          id?: string
          level?: string
          level_updated_at?: string | null
          points?: number
          total_bids?: number
          total_volume?: number
          updated_at?: string | null
          won_auctions?: number
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
      dealer_notifications: {
        Row: {
          auction_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          auction_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          auction_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_notifications_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_notifications_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
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
          comment: string | null
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
          title: string | null
          updated_at: string | null
        }
        Insert: {
          auction_id: string
          comment?: string | null
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
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          auction_id?: string
          comment?: string | null
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
          title?: string | null
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
            foreignKeyName: "dealer_reviews_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
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
          purchase_volume: number | null
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
          purchase_volume?: number | null
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
          purchase_volume?: number | null
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
      google_offline_conversions_log: {
        Row: {
          auction_id: string | null
          conversion_action_id: string
          conversion_currency: string
          conversion_time: string
          conversion_value: number
          error_message: string | null
          gbraid: string | null
          gclid: string | null
          http_status: number | null
          id: string
          kitchen_id: string
          order_id: string | null
          skip_reason: string | null
          source: string
          status: string
          uploaded_at: string
          wbraid: string | null
        }
        Insert: {
          auction_id?: string | null
          conversion_action_id: string
          conversion_currency?: string
          conversion_time: string
          conversion_value: number
          error_message?: string | null
          gbraid?: string | null
          gclid?: string | null
          http_status?: number | null
          id?: string
          kitchen_id: string
          order_id?: string | null
          skip_reason?: string | null
          source: string
          status: string
          uploaded_at?: string
          wbraid?: string | null
        }
        Update: {
          auction_id?: string | null
          conversion_action_id?: string
          conversion_currency?: string
          conversion_time?: string
          conversion_value?: number
          error_message?: string | null
          gbraid?: string | null
          gclid?: string | null
          http_status?: number | null
          id?: string
          kitchen_id?: string
          order_id?: string | null
          skip_reason?: string | null
          source?: string
          status?: string
          uploaded_at?: string
          wbraid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_offline_conversions_log_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      google_review_requests: {
        Row: {
          click_count: number
          clicked_at: string | null
          created_at: string
          delivery_error: string | null
          delivery_status: string
          email: string
          enqueued_at: string
          id: string
          recipient_name: string | null
          resend_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          source: string
          source_first_seen_at: string | null
          source_user_id: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          click_count?: number
          clicked_at?: string | null
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string
          email: string
          enqueued_at?: string
          id?: string
          recipient_name?: string | null
          resend_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          source: string
          source_first_seen_at?: string | null
          source_user_id?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          click_count?: number
          clicked_at?: string | null
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string
          email?: string
          enqueued_at?: string
          id?: string
          recipient_name?: string | null
          resend_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          source?: string
          source_first_seen_at?: string | null
          source_user_id?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instant_buy_alerts_sent: {
        Row: {
          auction_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          auction_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          auction_id?: string
          sent_at?: string
          user_id?: string
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
          dealer_country: string | null
          dealer_id: string
          due_date: string
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string
          kitchen_id: string | null
          net_amount: number
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_reminder_sent: boolean | null
          payment_status: string | null
          payment_terms_days: number | null
          pdf_url: string | null
          penalty_reason: string | null
          reverse_charge: boolean
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
          dealer_country?: string | null
          dealer_id: string
          due_date: string
          gross_amount: number
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type?: string
          kitchen_id?: string | null
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_reminder_sent?: boolean | null
          payment_status?: string | null
          payment_terms_days?: number | null
          pdf_url?: string | null
          penalty_reason?: string | null
          reverse_charge?: boolean
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
          dealer_country?: string | null
          dealer_id?: string
          due_date?: string
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          kitchen_id?: string | null
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_reminder_sent?: boolean | null
          payment_status?: string | null
          payment_terms_days?: number | null
          pdf_url?: string | null
          penalty_reason?: string | null
          reverse_charge?: boolean
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
            foreignKeyName: "invoices_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      kaufchance_invitations: {
        Row: {
          auction_id: string
          bidder_id: string
          highest_bid: number
          id: string
          invited_at: string | null
          rank: number
        }
        Insert: {
          auction_id: string
          bidder_id: string
          highest_bid: number
          id?: string
          invited_at?: string | null
          rank: number
        }
        Update: {
          auction_id?: string
          bidder_id?: string
          highest_bid?: number
          id?: string
          invited_at?: string | null
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "kaufchance_invitations_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kaufchance_invitations_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_photos: {
        Row: {
          card_url: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          kitchen_id: string
          medium_url: string | null
          processed_at: string | null
          processing_attempts: number
          processing_error: string | null
          url: string
        }
        Insert: {
          card_url?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          kitchen_id: string
          medium_url?: string | null
          processed_at?: string | null
          processing_attempts?: number
          processing_error?: string | null
          url: string
        }
        Update: {
          card_url?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          kitchen_id?: string
          medium_url?: string | null
          processed_at?: string | null
          processing_attempts?: number
          processing_error?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_photos_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
      kitchen_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          kitchen_id: string | null
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
          kitchen_id?: string | null
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
          kitchen_id?: string | null
          question?: string
          questioner_email?: string
          questioner_id?: string | null
          questioner_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_questions_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchens: {
        Row: {
          accident_free: boolean | null
          account_type: string | null
          additional_equipment: string | null
          air_conditioning_type:
            | Database["public"]["Enums"]["air_conditioning_type"]
            | null
          available_from: string | null
          awning_length_m: number | null
          base_vehicle: string | null
          battery_capacity_ah: number | null
          beds_description: string | null
          body_type: Database["public"]["Enums"]["kitchen_body_type"]
          city: string | null
          condition: Database["public"]["Enums"]["kitchen_condition"]
          contract_number: string | null
          contract_url: string | null
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
          gbraid: string | null
          gclid: string | null
          grey_water_capacity_liters: number | null
          has_air_conditioning: boolean | null
          has_airbag: boolean | null
          has_alarm: boolean | null
          has_awning: boolean | null
          has_awning_tent: boolean | null
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
          has_roof_ac: boolean | null
          has_satellite: boolean | null
          has_shower: boolean | null
          has_solar: boolean | null
          has_stand_ac: boolean | null
          has_swivel_seats: boolean | null
          has_toilet: boolean | null
          has_tuev: boolean | null
          has_tv: boolean | null
          heating_type: Database["public"]["Enums"]["heating_type"] | null
          height_m: number | null
          id: string
          instant_price: number | null
          instant_price_floor: number | null
          is_archived: boolean
          last_tuev_date: string | null
          length_m: number | null
          license_plate: string | null
          listing_number: string | null
          location: string | null
          main_tires: string | null
          manufacturer: string
          mileage: number
          model: string
          msclkid: string | null
          mwst_ausweisbar: boolean | null
          non_smoker: boolean | null
          number_of_axles: number | null
          payload_kg: number | null
          postal_code: string | null
          power_kw: number | null
          previous_owners: number | null
          price: number | null
          refrigerator_type:
            | Database["public"]["Enums"]["refrigerator_type"]
            | null
          reserve_price: number | null
          reserve_price_floor: number | null
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
          wbraid: string | null
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
          base_vehicle?: string | null
          battery_capacity_ah?: number | null
          beds_description?: string | null
          body_type: Database["public"]["Enums"]["kitchen_body_type"]
          city?: string | null
          condition: Database["public"]["Enums"]["kitchen_condition"]
          contract_number?: string | null
          contract_url?: string | null
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
          gbraid?: string | null
          gclid?: string | null
          grey_water_capacity_liters?: number | null
          has_air_conditioning?: boolean | null
          has_airbag?: boolean | null
          has_alarm?: boolean | null
          has_awning?: boolean | null
          has_awning_tent?: boolean | null
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
          has_roof_ac?: boolean | null
          has_satellite?: boolean | null
          has_shower?: boolean | null
          has_solar?: boolean | null
          has_stand_ac?: boolean | null
          has_swivel_seats?: boolean | null
          has_toilet?: boolean | null
          has_tuev?: boolean | null
          has_tv?: boolean | null
          heating_type?: Database["public"]["Enums"]["heating_type"] | null
          height_m?: number | null
          id?: string
          instant_price?: number | null
          instant_price_floor?: number | null
          is_archived?: boolean
          last_tuev_date?: string | null
          length_m?: number | null
          license_plate?: string | null
          listing_number?: string | null
          location?: string | null
          main_tires?: string | null
          manufacturer: string
          mileage: number
          model: string
          msclkid?: string | null
          mwst_ausweisbar?: boolean | null
          non_smoker?: boolean | null
          number_of_axles?: number | null
          payload_kg?: number | null
          postal_code?: string | null
          power_kw?: number | null
          previous_owners?: number | null
          price?: number | null
          refrigerator_type?:
            | Database["public"]["Enums"]["refrigerator_type"]
            | null
          reserve_price?: number | null
          reserve_price_floor?: number | null
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
          wbraid?: string | null
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
          base_vehicle?: string | null
          battery_capacity_ah?: number | null
          beds_description?: string | null
          body_type?: Database["public"]["Enums"]["kitchen_body_type"]
          city?: string | null
          condition?: Database["public"]["Enums"]["kitchen_condition"]
          contract_number?: string | null
          contract_url?: string | null
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
          gbraid?: string | null
          gclid?: string | null
          grey_water_capacity_liters?: number | null
          has_air_conditioning?: boolean | null
          has_airbag?: boolean | null
          has_alarm?: boolean | null
          has_awning?: boolean | null
          has_awning_tent?: boolean | null
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
          has_roof_ac?: boolean | null
          has_satellite?: boolean | null
          has_shower?: boolean | null
          has_solar?: boolean | null
          has_stand_ac?: boolean | null
          has_swivel_seats?: boolean | null
          has_toilet?: boolean | null
          has_tuev?: boolean | null
          has_tv?: boolean | null
          heating_type?: Database["public"]["Enums"]["heating_type"] | null
          height_m?: number | null
          id?: string
          instant_price?: number | null
          instant_price_floor?: number | null
          is_archived?: boolean
          last_tuev_date?: string | null
          length_m?: number | null
          license_plate?: string | null
          listing_number?: string | null
          location?: string | null
          main_tires?: string | null
          manufacturer?: string
          mileage?: number
          model?: string
          msclkid?: string | null
          mwst_ausweisbar?: boolean | null
          non_smoker?: boolean | null
          number_of_axles?: number | null
          payload_kg?: number | null
          postal_code?: string | null
          power_kw?: number | null
          previous_owners?: number | null
          price?: number | null
          refrigerator_type?:
            | Database["public"]["Enums"]["refrigerator_type"]
            | null
          reserve_price?: number | null
          reserve_price_floor?: number | null
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
          wbraid?: string | null
          weight_kg?: number | null
          width_m?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kitchens_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          created_at: string
          duration_hours: number
          ends_at: string | null
          id: string
          is_published: boolean
          lead_id: string
          min_bid_eur: number | null
          offer_price_eur: number | null
          penalty_state: string
          published_at: string | null
          spec_sheet: Json | null
          starts_at: string | null
          status: string
          updated_at: string
          won_bid_id: string | null
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          ends_at?: string | null
          id?: string
          is_published?: boolean
          lead_id: string
          min_bid_eur?: number | null
          offer_price_eur?: number | null
          penalty_state?: string
          published_at?: string | null
          spec_sheet?: Json | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          won_bid_id?: string | null
        }
        Update: {
          created_at?: string
          duration_hours?: number
          ends_at?: string | null
          id?: string
          is_published?: boolean
          lead_id?: string
          min_bid_eur?: number | null
          offer_price_eur?: number | null
          penalty_state?: string
          published_at?: string | null
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
            foreignKeyName: "lead_auctions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
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
      lead_bids: {
        Row: {
          auction_id: string
          created_at: string
          dealer_id: string
          delivery_weeks: number | null
          id: string
          is_winning: boolean
          montage_included: boolean | null
          notes: string | null
          payment_terms: Json | null
          price_eur: number
          warranty_months: number | null
        }
        Insert: {
          auction_id: string
          created_at?: string
          dealer_id: string
          delivery_weeks?: number | null
          id?: string
          is_winning?: boolean
          montage_included?: boolean | null
          notes?: string | null
          payment_terms?: Json | null
          price_eur: number
          warranty_months?: number | null
        }
        Update: {
          auction_id?: string
          created_at?: string
          dealer_id?: string
          delivery_weeks?: number | null
          id?: string
          is_winning?: boolean
          montage_included?: boolean | null
          notes?: string | null
          payment_terms?: Json | null
          price_eur?: number
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
            foreignKeyName: "lead_consents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
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
          {
            foreignKeyName: "lead_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_match_candidates: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          is_purchased: boolean
          lead_id: string
          price_cents: number | null
          purchased_at: string | null
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          is_purchased?: boolean
          lead_id: string
          price_cents?: number | null
          purchased_at?: string | null
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          is_purchased?: boolean
          lead_id?: string
          price_cents?: number | null
          purchased_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_match_candidates_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_match_candidates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_match_candidates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
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
            foreignKeyName: "lead_penalty_charges_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
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
          {
            foreignKeyName: "lead_qualification_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
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
          {
            foreignKeyName: "lead_views_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_line: string | null
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
          first_name: string | null
          funnel_answers: Json | null
          funnel_type: Database["public"]["Enums"]["lead_funnel_type"]
          funnel_variant: string | null
          has_existing_offer: boolean
          housing_type: string | null
          id: string
          ip_address: unknown
          kitchen_form: string | null
          kitchen_style: string | null
          landing_page: string | null
          last_name: string | null
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
        }
        Insert: {
          address_line?: string | null
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
          first_name?: string | null
          funnel_answers?: Json | null
          funnel_type?: Database["public"]["Enums"]["lead_funnel_type"]
          funnel_variant?: string | null
          has_existing_offer?: boolean
          housing_type?: string | null
          id?: string
          ip_address?: unknown
          kitchen_form?: string | null
          kitchen_style?: string | null
          landing_page?: string | null
          last_name?: string | null
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
        }
        Update: {
          address_line?: string | null
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
          first_name?: string | null
          funnel_answers?: Json | null
          funnel_type?: Database["public"]["Enums"]["lead_funnel_type"]
          funnel_variant?: string | null
          has_existing_offer?: boolean
          housing_type?: string | null
          id?: string
          ip_address?: unknown
          kitchen_form?: string | null
          kitchen_style?: string | null
          landing_page?: string | null
          last_name?: string | null
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
          completed_at: string | null
          cost_cents: number | null
          created_at: string
          error_message: string | null
          fal_request_id: string | null
          generation_ms: number | null
          id: string
          image_height: number | null
          image_path: string | null
          image_width: number | null
          model_slug: string | null
          negative_prompt: string | null
          prompt: string
          session_id: string
          spec_snapshot: Json
          status: string
          user_message: string | null
          version: number
        }
        Insert: {
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          fal_request_id?: string | null
          generation_ms?: number | null
          id?: string
          image_height?: number | null
          image_path?: string | null
          image_width?: number | null
          model_slug?: string | null
          negative_prompt?: string | null
          prompt: string
          session_id: string
          spec_snapshot: Json
          status?: string
          user_message?: string | null
          version?: number
        }
        Update: {
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          error_message?: string | null
          fal_request_id?: string | null
          generation_ms?: number | null
          id?: string
          image_height?: number | null
          image_path?: string | null
          image_width?: number | null
          model_slug?: string | null
          negative_prompt?: string | null
          prompt?: string
          session_id?: string
          spec_snapshot?: Json
          status?: string
          user_message?: string | null
          version?: number
        }
        Relationships: [
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
          contact_captured_at: string | null
          created_at: string
          current_render_id: string | null
          expert_note: string | null
          id: string
          ip_address: unknown
          lead_id: string | null
          price_range_max_cents: number | null
          price_range_min_cents: number | null
          session_token: string
          spec: Json
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
          contact_captured_at?: string | null
          created_at?: string
          current_render_id?: string | null
          expert_note?: string | null
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          price_range_max_cents?: number | null
          price_range_min_cents?: number | null
          session_token: string
          spec?: Json
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
          contact_captured_at?: string | null
          created_at?: string
          current_render_id?: string | null
          expert_note?: string | null
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          price_range_max_cents?: number | null
          price_range_min_cents?: number | null
          session_token?: string
          spec?: Json
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
          {
            foreignKeyName: "planner_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      post_auction_offers: {
        Row: {
          auction_id: string
          auction_round: number
          buyer_id: string
          counter_offer_amount: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_invited: boolean | null
          message: string | null
          offer_amount: number
          responded_at: string | null
          seller_response: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          auction_id: string
          auction_round?: number
          buyer_id: string
          counter_offer_amount?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_invited?: boolean | null
          message?: string | null
          offer_amount: number
          responded_at?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          auction_id?: string
          auction_round?: number
          buyer_id?: string
          counter_offer_amount?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_invited?: boolean | null
          message?: string | null
          offer_amount?: number
          responded_at?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_auction_offers_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_auction_offers_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      price_change_requests: {
        Row: {
          admin_note: string | null
          auction_id: string | null
          created_at: string
          current_instant: number | null
          current_reserve: number | null
          id: string
          kitchen_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string
          requested_instant: number | null
          requested_reserve: number | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          auction_id?: string | null
          created_at?: string
          current_instant?: number | null
          current_reserve?: number | null
          id?: string
          kitchen_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          requested_instant?: number | null
          requested_reserve?: number | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          auction_id?: string | null
          created_at?: string
          current_instant?: number | null
          current_reserve?: number | null
          id?: string
          kitchen_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          requested_instant?: number | null
          requested_reserve?: number | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_change_requests_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_requests_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_requests_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_change_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      purchase_contracts: {
        Row: {
          auction_id: string | null
          blank_protocol_storage_path: string | null
          blank_protocol_url: string | null
          buyer_contract_url: string | null
          buyer_customer_number: string | null
          buyer_id: string | null
          buyer_name: string | null
          buyer_storage_path: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          contract_number: string
          contract_url: string | null
          created_at: string | null
          id: string
          item_description: string | null
          kitchen_id: string | null
          notes: string | null
          sale_price: number
          seller_id: string | null
          seller_name: string | null
          status: string
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          auction_id?: string | null
          blank_protocol_storage_path?: string | null
          blank_protocol_url?: string | null
          buyer_contract_url?: string | null
          buyer_customer_number?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_storage_path?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_number: string
          contract_url?: string | null
          created_at?: string | null
          id?: string
          item_description?: string | null
          kitchen_id?: string | null
          notes?: string | null
          sale_price: number
          seller_id?: string | null
          seller_name?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          auction_id?: string | null
          blank_protocol_storage_path?: string | null
          blank_protocol_url?: string | null
          buyer_contract_url?: string | null
          buyer_customer_number?: string | null
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_storage_path?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          contract_number?: string
          contract_url?: string | null
          created_at?: string | null
          id?: string
          item_description?: string | null
          kitchen_id?: string | null
          notes?: string | null
          sale_price?: number
          seller_id?: string | null
          seller_name?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_contracts_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_contracts_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_contracts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_contracts_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_contracts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
          kitchen_id: string
          matched_at: string | null
          notification_sent: boolean | null
          notification_sent_at: string | null
        }
        Insert: {
          alert_id: string
          id?: string
          kitchen_id: string
          matched_at?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
        }
        Update: {
          alert_id?: string
          id?: string
          kitchen_id?: string
          matched_at?: string | null
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
            foreignKeyName: "search_alert_matches_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
          bank_bic: string | null
          bank_iban: string | null
          bank_name: string | null
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
          dunning_auto_enabled: boolean | null
          dunning_level1_days: number | null
          dunning_level1_fee: number | null
          dunning_level2_days: number | null
          dunning_level2_fee: number | null
          dunning_level3_days: number | null
          dunning_level3_fee: number | null
          dunning_restrict_at_level: number | null
          favicon_url: string | null
          from_email: string
          google_analytics_id: string | null
          google_tag_manager_id: string | null
          hrb_number: string | null
          id: string
          invoice_footer_text: string | null
          invoice_payment_terms_days: number | null
          lead_forward_email: string | null
          logo_url: string | null
          maintenance_mode: boolean
          managing_director: string | null
          meta_description: string
          meta_keywords: string
          meta_title: string
          min_bid_increment_percent: number
          notify_new_auction: boolean
          notify_new_bid: boolean
          notify_new_registration: boolean
          openai_api_key: string | null
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
          tax_number: string | null
          tracking_config: Json
          tuv_badge_url: string | null
          updated_at: string
          ust_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          autobid_enabled?: boolean
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
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
          dunning_auto_enabled?: boolean | null
          dunning_level1_days?: number | null
          dunning_level1_fee?: number | null
          dunning_level2_days?: number | null
          dunning_level2_fee?: number | null
          dunning_level3_days?: number | null
          dunning_level3_fee?: number | null
          dunning_restrict_at_level?: number | null
          favicon_url?: string | null
          from_email?: string
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          hrb_number?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          lead_forward_email?: string | null
          logo_url?: string | null
          maintenance_mode?: boolean
          managing_director?: string | null
          meta_description?: string
          meta_keywords?: string
          meta_title?: string
          min_bid_increment_percent?: number
          notify_new_auction?: boolean
          notify_new_bid?: boolean
          notify_new_registration?: boolean
          openai_api_key?: string | null
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
          tax_number?: string | null
          tracking_config?: Json
          tuv_badge_url?: string | null
          updated_at?: string
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          autobid_enabled?: boolean
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
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
          dunning_auto_enabled?: boolean | null
          dunning_level1_days?: number | null
          dunning_level1_fee?: number | null
          dunning_level2_days?: number | null
          dunning_level2_fee?: number | null
          dunning_level3_days?: number | null
          dunning_level3_fee?: number | null
          dunning_restrict_at_level?: number | null
          favicon_url?: string | null
          from_email?: string
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          hrb_number?: string | null
          id?: string
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          lead_forward_email?: string | null
          logo_url?: string | null
          maintenance_mode?: boolean
          managing_director?: string | null
          meta_description?: string
          meta_keywords?: string
          meta_title?: string
          min_bid_increment_percent?: number
          notify_new_auction?: boolean
          notify_new_bid?: boolean
          notify_new_registration?: boolean
          openai_api_key?: string | null
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
          tax_number?: string | null
          tracking_config?: Json
          tuv_badge_url?: string | null
          updated_at?: string
          ust_id?: string | null
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
          alert_enabled: boolean | null
          created_at: string | null
          id: string
          kitchen_id: string | null
          last_notified_price: number | null
          user_id: string | null
        }
        Insert: {
          alert_enabled?: boolean | null
          created_at?: string | null
          id?: string
          kitchen_id?: string | null
          last_notified_price?: number | null
          user_id?: string | null
        }
        Update: {
          alert_enabled?: boolean | null
          created_at?: string | null
          id?: string
          kitchen_id?: string | null
          last_notified_price?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchens"
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
          broadcast_emails_enabled: boolean | null
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
          last_digest_sent_at: string | null
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
          broadcast_emails_enabled?: boolean | null
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
          last_digest_sent_at?: string | null
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
          broadcast_emails_enabled?: boolean | null
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
          last_digest_sent_at?: string | null
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
      wizard_sessions: {
        Row: {
          admin_called_at: string | null
          admin_estimated_value: number | null
          admin_notes: string | null
          anonymous_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          disposition: string | null
          done_email_count: number | null
          done_email_last_sent: string | null
          followup_email_sent_at: string | null
          form_data: Json
          gbraid: string | null
          gclid: string | null
          id: string
          is_viewed: boolean
          kitchen_summary: string | null
          last_activity_at: string | null
          max_step_reached: number
          msclkid: string | null
          no_answer_email_count: number | null
          no_answer_email_last_sent: string | null
          resume_email_sent_at: string | null
          resume_token: string
          status: string
          step_name: string | null
          total_steps: number
          updated_at: string | null
          user_id: string | null
          wbraid: string | null
          wrong_number_email_count: number | null
          wrong_number_email_last_sent: string | null
        }
        Insert: {
          admin_called_at?: string | null
          admin_estimated_value?: number | null
          admin_notes?: string | null
          anonymous_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          disposition?: string | null
          done_email_count?: number | null
          done_email_last_sent?: string | null
          followup_email_sent_at?: string | null
          form_data?: Json
          gbraid?: string | null
          gclid?: string | null
          id?: string
          is_viewed?: boolean
          kitchen_summary?: string | null
          last_activity_at?: string | null
          max_step_reached?: number
          msclkid?: string | null
          no_answer_email_count?: number | null
          no_answer_email_last_sent?: string | null
          resume_email_sent_at?: string | null
          resume_token?: string
          status?: string
          step_name?: string | null
          total_steps?: number
          updated_at?: string | null
          user_id?: string | null
          wbraid?: string | null
          wrong_number_email_count?: number | null
          wrong_number_email_last_sent?: string | null
        }
        Update: {
          admin_called_at?: string | null
          admin_estimated_value?: number | null
          admin_notes?: string | null
          anonymous_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_step?: number
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          disposition?: string | null
          done_email_count?: number | null
          done_email_last_sent?: string | null
          followup_email_sent_at?: string | null
          form_data?: Json
          gbraid?: string | null
          gclid?: string | null
          id?: string
          is_viewed?: boolean
          kitchen_summary?: string | null
          last_activity_at?: string | null
          max_step_reached?: number
          msclkid?: string | null
          no_answer_email_count?: number | null
          no_answer_email_last_sent?: string | null
          resume_email_sent_at?: string | null
          resume_token?: string
          status?: string
          step_name?: string | null
          total_steps?: number
          updated_at?: string | null
          user_id?: string | null
          wbraid?: string | null
          wrong_number_email_count?: number | null
          wrong_number_email_last_sent?: string | null
        }
        Relationships: []
      }
      wizard_step_events: {
        Row: {
          created_at: string
          device_type: string | null
          error_fields: string[] | null
          event: string
          field_name: string | null
          id: number
          metadata: Json | null
          session_id: string
          step: number
          time_on_step_ms: number | null
          viewport_width: number | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          error_fields?: string[] | null
          event: string
          field_name?: string | null
          id?: number
          metadata?: Json | null
          session_id: string
          step: number
          time_on_step_ms?: number | null
          viewport_width?: number | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          error_fields?: string[] | null
          event?: string
          field_name?: string | null
          id?: number
          metadata?: Json | null
          session_id?: string
          step?: number
          time_on_step_ms?: number | null
          viewport_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wizard_step_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wizard_sessions"
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
      auctions_public: {
        Row: {
          auction_round: number | null
          created_at: string | null
          current_bid: number | null
          end_time: string | null
          id: string | null
          kaufchance_expires_at: string | null
          kaufchance_min_price: number | null
          kitchen_id: string | null
          last_price_reduction_at: string | null
          marketing_phase_started_at: string | null
          reserve_price: number | null
          soft_close_extension_minutes: number | null
          start_time: string | null
          starting_bid: number | null
          status: Database["public"]["Enums"]["auction_status"] | null
          updated_at: string | null
        }
        Insert: {
          auction_round?: number | null
          created_at?: string | null
          current_bid?: number | null
          end_time?: string | null
          id?: string | null
          kaufchance_expires_at?: string | null
          kaufchance_min_price?: number | null
          kitchen_id?: string | null
          last_price_reduction_at?: string | null
          marketing_phase_started_at?: string | null
          reserve_price?: number | null
          soft_close_extension_minutes?: number | null
          start_time?: string | null
          starting_bid?: number | null
          status?: Database["public"]["Enums"]["auction_status"] | null
          updated_at?: string | null
        }
        Update: {
          auction_round?: number | null
          created_at?: string | null
          current_bid?: number | null
          end_time?: string | null
          id?: string | null
          kaufchance_expires_at?: string | null
          kaufchance_min_price?: number | null
          kitchen_id?: string | null
          last_price_reduction_at?: string | null
          marketing_phase_started_at?: string | null
          reserve_price?: number | null
          soft_close_extension_minutes?: number | null
          start_time?: string | null
          starting_bid?: number | null
          status?: Database["public"]["Enums"]["auction_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: true
            referencedRelation: "kitchens"
            referencedColumns: ["id"]
          },
        ]
      }
      bids_public: {
        Row: {
          amount: number | null
          auction_id: string | null
          bidder_id: string | null
          created_at: string | null
          id: string | null
          is_autobid: boolean | null
          max_autobid_amount: number | null
        }
        Insert: {
          amount?: number | null
          auction_id?: string | null
          bidder_id?: string | null
          created_at?: string | null
          id?: string | null
          is_autobid?: boolean | null
          max_autobid_amount?: never
        }
        Update: {
          amount?: number | null
          auction_id?: string | null
          bidder_id?: string | null
          created_at?: string | null
          id?: string | null
          is_autobid?: boolean | null
          max_autobid_amount?: never
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
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions_public"
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
      leads_masked: {
        Row: {
          budget_midpoint: number | null
          created_at: string | null
          delivery_mode: string | null
          desired_delivery_at: string | null
          existing_offer_price_cents: number | null
          funnel_answers: Json | null
          funnel_type: Database["public"]["Enums"]["lead_funnel_type"] | null
          has_existing_offer: boolean | null
          housing_type: string | null
          id: string | null
          kitchen_form: string | null
          kitchen_style: string | null
          payment_financing: string | null
          postal_code: string | null
          purchase_reason: string | null
          region: string | null
          score: number | null
          special_wishes: string[] | null
          status: Database["public"]["Enums"]["lead_status"] | null
          tier: Database["public"]["Enums"]["lead_tier"] | null
          timeframe_months: number | null
          updated_at: string | null
          waste_separation_system: boolean | null
        }
        Insert: {
          budget_midpoint?: number | null
          created_at?: string | null
          delivery_mode?: string | null
          desired_delivery_at?: string | null
          existing_offer_price_cents?: number | null
          funnel_answers?: Json | null
          funnel_type?: Database["public"]["Enums"]["lead_funnel_type"] | null
          has_existing_offer?: boolean | null
          housing_type?: string | null
          id?: string | null
          kitchen_form?: string | null
          kitchen_style?: string | null
          payment_financing?: string | null
          postal_code?: string | null
          purchase_reason?: string | null
          region?: string | null
          score?: number | null
          special_wishes?: string[] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tier?: Database["public"]["Enums"]["lead_tier"] | null
          timeframe_months?: number | null
          updated_at?: string | null
          waste_separation_system?: boolean | null
        }
        Update: {
          budget_midpoint?: number | null
          created_at?: string | null
          delivery_mode?: string | null
          desired_delivery_at?: string | null
          existing_offer_price_cents?: number | null
          funnel_answers?: Json | null
          funnel_type?: Database["public"]["Enums"]["lead_funnel_type"] | null
          has_existing_offer?: boolean | null
          housing_type?: string | null
          id?: string | null
          kitchen_form?: string | null
          kitchen_style?: string | null
          payment_financing?: string | null
          postal_code?: string | null
          purchase_reason?: string | null
          region?: string | null
          score?: number | null
          special_wishes?: string[] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tier?: Database["public"]["Enums"]["lead_tier"] | null
          timeframe_months?: number | null
          updated_at?: string | null
          waste_separation_system?: boolean | null
        }
        Relationships: []
      }
      public_site_settings: {
        Row: {
          autobid_enabled: boolean | null
          buy_now_enabled: boolean | null
          commission_rate_percent: number | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_postal_code: string | null
          contact_email: string | null
          created_at: string | null
          dark_mode_enabled: boolean | null
          default_auction_duration_days: number | null
          favicon_url: string | null
          google_analytics_id: string | null
          google_tag_manager_id: string | null
          hrb_number: string | null
          id: string | null
          invoice_footer_text: string | null
          invoice_payment_terms_days: number | null
          logo_url: string | null
          maintenance_mode: boolean | null
          managing_director: string | null
          meta_description: string | null
          meta_keywords: string | null
          meta_title: string | null
          min_bid_increment_percent: number | null
          primary_color: string | null
          reserve_price_required: boolean | null
          secondary_color: string | null
          site_description: string | null
          site_name: string | null
          site_tagline: string | null
          sitemap_enabled: boolean | null
          soft_close_extension_minutes: number | null
          support_phone: string | null
          tax_number: string | null
          tracking_config: Json | null
          tuv_badge_url: string | null
          updated_at: string | null
          ust_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          autobid_enabled?: boolean | null
          buy_now_enabled?: boolean | null
          commission_rate_percent?: number | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string | null
          created_at?: string | null
          dark_mode_enabled?: boolean | null
          default_auction_duration_days?: number | null
          favicon_url?: string | null
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          hrb_number?: string | null
          id?: string | null
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          logo_url?: string | null
          maintenance_mode?: boolean | null
          managing_director?: string | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          min_bid_increment_percent?: number | null
          primary_color?: string | null
          reserve_price_required?: boolean | null
          secondary_color?: string | null
          site_description?: string | null
          site_name?: string | null
          site_tagline?: string | null
          sitemap_enabled?: boolean | null
          soft_close_extension_minutes?: number | null
          support_phone?: string | null
          tax_number?: string | null
          tracking_config?: Json | null
          tuv_badge_url?: string | null
          updated_at?: string | null
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          autobid_enabled?: boolean | null
          buy_now_enabled?: boolean | null
          commission_rate_percent?: number | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_postal_code?: string | null
          contact_email?: string | null
          created_at?: string | null
          dark_mode_enabled?: boolean | null
          default_auction_duration_days?: number | null
          favicon_url?: string | null
          google_analytics_id?: string | null
          google_tag_manager_id?: string | null
          hrb_number?: string | null
          id?: string | null
          invoice_footer_text?: string | null
          invoice_payment_terms_days?: number | null
          logo_url?: string | null
          maintenance_mode?: boolean | null
          managing_director?: string | null
          meta_description?: string | null
          meta_keywords?: string | null
          meta_title?: string | null
          min_bid_increment_percent?: number | null
          primary_color?: string | null
          reserve_price_required?: boolean | null
          secondary_color?: string | null
          site_description?: string | null
          site_name?: string | null
          site_tagline?: string | null
          sitemap_enabled?: boolean | null
          soft_close_extension_minutes?: number | null
          support_phone?: string | null
          tax_number?: string | null
          tracking_config?: Json | null
          tuv_badge_url?: string | null
          updated_at?: string | null
          ust_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_kaufchance_offer_atomic: {
        Args: {
          p_expected_auction_status: Database["public"]["Enums"]["auction_status"]
          p_offer_id: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_add_email_suppression: {
        Args: { p_email: string; p_notes?: string; p_reason?: string }
        Returns: boolean
      }
      admin_delete_bid: { Args: { p_bid_id: string }; Returns: Json }
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
      bing_oauth_release_lock: { Args: { p_id: string }; Returns: undefined }
      bing_oauth_try_acquire_lock: { Args: { p_id: string }; Returns: boolean }
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
      check_search_criteria_match: {
        Args: { criteria: Json; motorhome_record: Record<string, unknown> }
        Returns: boolean
      }
      claim_google_review_batch: {
        Args: { p_limit?: number }
        Returns: {
          email: string
          id: string
          recipient_name: string
          unsubscribe_token: string
        }[]
      }
      clean_old_analytics_data: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_expired_rate_limits: { Args: never; Returns: number }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      compute_random_starting_bid: {
        Args: { p_reserve_price: number }
        Returns: number
      }
      create_auction_invoice: {
        Args: { auction_id_param: string; dealer_id_param: string }
        Returns: string
      }
      create_instant_buy_invoice: {
        Args: {
          auction_id_param: string
          dealer_id_param: string
          sale_price_param: number
        }
        Returns: string
      }
      create_seller_penalty_invoice: {
        Args: {
          auction_id_param?: string
          motorhome_id_param?: string
          notes_param?: string
          penalty_reason_param?: string
          seller_id_param: string
        }
        Returns: string
      }
      create_wizard_session: {
        Args: {
          p_anonymous_id: string
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_total_steps?: number
          p_user_id?: string
        }
        Returns: string
      }
      enqueue_google_review_for_email: {
        Args: { p_email: string }
        Returns: Json
      }
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
      find_wizard_session_by_anonymous_id: {
        Args: { p_anonymous_id: string }
        Returns: {
          admin_called_at: string | null
          admin_estimated_value: number | null
          admin_notes: string | null
          anonymous_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          disposition: string | null
          done_email_count: number | null
          done_email_last_sent: string | null
          followup_email_sent_at: string | null
          form_data: Json
          gbraid: string | null
          gclid: string | null
          id: string
          is_viewed: boolean
          kitchen_summary: string | null
          last_activity_at: string | null
          max_step_reached: number
          msclkid: string | null
          no_answer_email_count: number | null
          no_answer_email_last_sent: string | null
          resume_email_sent_at: string | null
          resume_token: string
          status: string
          step_name: string | null
          total_steps: number
          updated_at: string | null
          user_id: string | null
          wbraid: string | null
          wrong_number_email_count: number | null
          wrong_number_email_last_sent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wizard_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_wizard_session_by_resume_token: {
        Args: { p_resume_token: string }
        Returns: {
          admin_called_at: string | null
          admin_estimated_value: number | null
          admin_notes: string | null
          anonymous_id: string | null
          completed_at: string | null
          created_at: string | null
          current_step: number
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          disposition: string | null
          done_email_count: number | null
          done_email_last_sent: string | null
          followup_email_sent_at: string | null
          form_data: Json
          gbraid: string | null
          gclid: string | null
          id: string
          is_viewed: boolean
          kitchen_summary: string | null
          last_activity_at: string | null
          max_step_reached: number
          msclkid: string | null
          no_answer_email_count: number | null
          no_answer_email_last_sent: string | null
          resume_email_sent_at: string | null
          resume_token: string
          status: string
          step_name: string | null
          total_steps: number
          updated_at: string | null
          user_id: string | null
          wbraid: string | null
          wrong_number_email_count: number | null
          wrong_number_email_last_sent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wizard_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_contract_number: { Args: never; Returns: string }
      generate_customer_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_listing_number: { Args: never; Returns: string }
      generate_release_pin: { Args: never; Returns: string }
      generate_sepa_reference: { Args: never; Returns: string }
      get_auction_marketing_anchors: {
        Args: { p_motorhome_id: string }
        Returns: {
          auction_id: string
          seller_initial_instant_price: number
          seller_initial_reserve: number
        }[]
      }
      get_auction_owner_meta: {
        Args: { p_auction_id: string }
        Returns: {
          agb_version_at_start: string
          auction_id: string
          auto_relist: boolean
          dynamic_pricing: boolean
          marketing_phase_max_until: string
          seller_initial_instant_price: number
          seller_initial_reserve: number
        }[]
      }
      get_auctions_owner_meta_bulk: {
        Args: { p_auction_ids: string[] }
        Returns: {
          agb_version_at_start: string
          auction_id: string
          auto_relist: boolean
          dynamic_pricing: boolean
          marketing_phase_max_until: string
          seller_initial_instant_price: number
          seller_initial_reserve: number
        }[]
      }
      get_current_agb_version: { Args: never; Returns: string }
      get_dealer_tax_info: {
        Args: { p_dealer_id: string }
        Returns: {
          dealer_country: string
          is_reverse_charge: boolean
          tax_rate: number
        }[]
      }
      get_google_review_stats: { Args: never; Returns: Json }
      get_primary_role: {
        Args: { user_id_param: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_public_platform_stats: { Args: never; Returns: Json }
      get_request_anonymous_id: { Args: never; Returns: string }
      get_vapid_keys: { Args: never; Returns: Json }
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
      hash_review_ip: { Args: { p_ip: string }; Returns: string }
      lift_dealer_restriction: {
        Args: { dealer_id_param: string }
        Returns: boolean
      }
      link_wizard_sessions_to_confirmed_user: { Args: never; Returns: number }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: undefined
      }
      log_error:
        | {
            Args: {
              p_browser?: string
              p_component_name?: string
              p_device_type?: string
              p_error_category?: string
              p_error_code: string
              p_error_message: string
              p_metadata?: Json
              p_original_error?: string
              p_page_path?: string
              p_page_title?: string
              p_page_url?: string
              p_severity?: string
              p_stack_trace?: string
              p_user_agent?: string
              p_user_email?: string
              p_user_id?: string
              p_user_role?: string
            }
            Returns: string
          }
        | {
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
      mark_google_review_delivered: {
        Args: { p_email: string; p_resend_id?: string }
        Returns: boolean
      }
      mark_google_review_failed: {
        Args: { p_error: string; p_id: string; p_status?: string }
        Returns: boolean
      }
      place_bid_atomic: {
        Args: {
          p_auction_id: string
          p_bid_amount: number
          p_bidder_id: string
          p_is_autobid?: boolean
          p_max_autobid_amount?: number
          p_min_increment?: number
        }
        Returns: Json
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
      process_approved_claim: {
        Args: { claim_id_param: string }
        Returns: undefined
      }
      process_google_review_unsubscribe: {
        Args: { p_token: string }
        Returns: Json
      }
      process_search_alerts_for_kitchen: {
        Args: { motorhome_id_param: string }
        Returns: number
      }
      reactivate_wizard_session_by_resume_token: {
        Args: { p_resume_token: string }
        Returns: string
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
      seller_archive_listing: {
        Args: { p_motorhome_id: string }
        Returns: Json
      }
      seller_restart_listing: {
        Args: {
          p_motorhome_id: string
          p_new_instant?: number
          p_new_reserve?: number
        }
        Returns: Json
      }
      seller_unarchive_listing: {
        Args: { p_motorhome_id: string }
        Returns: Json
      }
      toggle_auto_relist: {
        Args: { p_auction_id: string; p_value: boolean }
        Returns: boolean
      }
      toggle_dynamic_pricing: {
        Args: { p_auction_id: string; p_value: boolean }
        Returns: boolean
      }
      track_google_review_click: { Args: { p_token: string }; Returns: boolean }
      try_acquire_cron_lock: {
        Args: { p_key: string; p_ttl_minutes?: number }
        Returns: boolean
      }
      update_dealer_level: { Args: { p_dealer_id: string }; Returns: undefined }
      update_dealer_rating_summary: {
        Args: { dealer_id_param: string }
        Returns: undefined
      }
      update_kitchen_damage_status: {
        Args: { motorhome_id_param: string }
        Returns: undefined
      }
      update_listing_prices_in_draft: {
        Args: {
          p_motorhome_id: string
          p_new_instant: number
          p_new_reserve: number
        }
        Returns: Json
      }
      update_wizard_session_by_anonymous_id: {
        Args: { p_anonymous_id: string; p_session_id: string; p_updates: Json }
        Returns: undefined
      }
      verify_wizard_session_ownership: {
        Args: {
          p_anonymous_id?: string
          p_session_id: string
          p_user_id?: string
        }
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
      webhook_mark_google_review_delivered: {
        Args: { p_resend_message_id: string }
        Returns: boolean
      }
    }
    Enums: {
      air_conditioning_type: "Keine" | "Fahrerhaus" | "Wohnraum" | "Beides"
      app_role: "admin" | "dealer" | "seller" | "consumer"
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
      kitchen_body_type:
        | "Teilintegriert"
        | "Alkoven"
        | "Vollintegriert"
        | "Kastenwagen"
        | "Campingbus"
        | "Wohnwagen"
        | "Faltcaravan"
        | "Mobilheim"
      kitchen_condition:
        | "Neuwertig"
        | "Sehr gut"
        | "Gut"
        | "Befriedigend"
        | "ReparaturbedÃ¼rftig"
        | "Sehr gepflegt"
        | "Gepflegt"
        | "Gebrauchsspuren"
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
      refrigerator_type: "Kompressor" | "Absorber" | "Thermoelektrisch"
      sale_channel: "instant_price" | "auction" | "station"
      style_segment_enum: "budget" | "mittel" | "premium" | "luxus"
      transmission_type: "Schaltgetriebe" | "Automatik"
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
      app_role: ["admin", "dealer", "seller", "consumer"],
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
      kitchen_body_type: [
        "Teilintegriert",
        "Alkoven",
        "Vollintegriert",
        "Kastenwagen",
        "Campingbus",
        "Wohnwagen",
        "Faltcaravan",
        "Mobilheim",
      ],
      kitchen_condition: [
        "Neuwertig",
        "Sehr gut",
        "Gut",
        "Befriedigend",
        "ReparaturbedÃ¼rftig",
        "Sehr gepflegt",
        "Gepflegt",
        "Gebrauchsspuren",
      ],
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
      refrigerator_type: ["Kompressor", "Absorber", "Thermoelektrisch"],
      sale_channel: ["instant_price", "auction", "station"],
      style_segment_enum: ["budget", "mittel", "premium", "luxus"],
      transmission_type: ["Schaltgetriebe", "Automatik"],
      worktop_tier_enum: ["basic", "mid", "premium"],
    },
  },
} as const
