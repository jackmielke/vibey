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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_chat_logs: {
        Row: {
          agent_id: string
          agent_response: string
          community_id: string
          created_at: string | null
          id: string
          session_key: string | null
          telegram_chat_id: number | null
          telegram_user_id: number | null
          telegram_username: string | null
          tokens_used: number | null
          user_message: string
        }
        Insert: {
          agent_id: string
          agent_response: string
          community_id: string
          created_at?: string | null
          id?: string
          session_key?: string | null
          telegram_chat_id?: number | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tokens_used?: number | null
          user_message: string
        }
        Update: {
          agent_id?: string
          agent_response?: string
          community_id?: string
          created_at?: string | null
          id?: string
          session_key?: string | null
          telegram_chat_id?: number | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tokens_used?: number | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_chat_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_chat_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          community_id: string
          created_at: string | null
          created_by: string | null
          digest_enabled: boolean | null
          digest_hour_utc: number | null
          digest_timezone: string | null
          elevenlabs_agent_id: string | null
          id: string
          intro_message: string | null
          is_active: boolean | null
          last_digest_sent_at: string | null
          max_tokens: number | null
          model: string
          name: string
          skills: Json | null
          system_prompt: string
          telegram_enabled: boolean | null
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          community_id: string
          created_at?: string | null
          created_by?: string | null
          digest_enabled?: boolean | null
          digest_hour_utc?: number | null
          digest_timezone?: string | null
          elevenlabs_agent_id?: string | null
          id?: string
          intro_message?: string | null
          is_active?: boolean | null
          last_digest_sent_at?: string | null
          max_tokens?: number | null
          model?: string
          name?: string
          skills?: Json | null
          system_prompt?: string
          telegram_enabled?: boolean | null
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          community_id?: string
          created_at?: string | null
          created_by?: string | null
          digest_enabled?: boolean | null
          digest_hour_utc?: number | null
          digest_timezone?: string | null
          elevenlabs_agent_id?: string | null
          id?: string
          intro_message?: string | null
          is_active?: boolean | null
          last_digest_sent_at?: string | null
          max_tokens?: number | null
          model?: string
          name?: string
          skills?: Json | null
          system_prompt?: string
          telegram_enabled?: boolean | null
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          chat_type: string
          community_id: string
          cost_usd: number
          created_at: string
          id: string
          message_count: number | null
          metadata: Json | null
          model_used: string
          session_end_at: string | null
          session_start_at: string
          tokens_used: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          chat_type: string
          community_id: string
          cost_usd?: number
          created_at?: string
          id?: string
          message_count?: number | null
          metadata?: Json | null
          model_used: string
          session_end_at?: string | null
          session_start_at?: string
          tokens_used?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          chat_type?: string
          community_id?: string
          cost_usd?: number
          created_at?: string
          id?: string
          message_count?: number | null
          metadata?: Json | null
          model_used?: string
          session_end_at?: string | null
          session_start_at?: string
          tokens_used?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          app_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number | null
          scopes: Database["public"]["Enums"]["api_scope"][] | null
        }
        Insert: {
          app_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit_per_minute?: number | null
          scopes?: Database["public"]["Enums"]["api_scope"][] | null
        }
        Update: {
          app_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number | null
          scopes?: Database["public"]["Enums"]["api_scope"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "registered_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          app_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          app_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          app_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "registered_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          accept_invitation: boolean | null
          anything_else: string | null
          available_from: string | null
          available_to: string | null
          background_experience: string[] | null
          cancellation_policy: boolean | null
          community_id: string | null
          confirmation_status: string | null
          confirmed_at: string | null
          contribution: string | null
          created_at: string
          edge_city_ticket: boolean | null
          email: string
          excited_to_build: string | null
          food_preferences: string | null
          full_name: string
          github_url: string | null
          hotel_room: string | null
          housing_option: string | null
          housing_sorted: boolean | null
          id: string
          instagram_handle: string | null
          linkedin_url: string | null
          media_release: boolean | null
          need_housing: boolean | null
          payment_method: string | null
          planning_dev_connect: boolean | null
          portfolio_url: string | null
          referral_source: string | null
          residency_id: string | null
          residency_tier: string | null
          seeking_experiences: string[] | null
          suggested_experience: string | null
          telegram_handle: string | null
          updated_at: string
          want_house_accommodation: boolean | null
          website_url: string | null
          x_handle: string | null
        }
        Insert: {
          accept_invitation?: boolean | null
          anything_else?: string | null
          available_from?: string | null
          available_to?: string | null
          background_experience?: string[] | null
          cancellation_policy?: boolean | null
          community_id?: string | null
          confirmation_status?: string | null
          confirmed_at?: string | null
          contribution?: string | null
          created_at?: string
          edge_city_ticket?: boolean | null
          email: string
          excited_to_build?: string | null
          food_preferences?: string | null
          full_name: string
          github_url?: string | null
          hotel_room?: string | null
          housing_option?: string | null
          housing_sorted?: boolean | null
          id?: string
          instagram_handle?: string | null
          linkedin_url?: string | null
          media_release?: boolean | null
          need_housing?: boolean | null
          payment_method?: string | null
          planning_dev_connect?: boolean | null
          portfolio_url?: string | null
          referral_source?: string | null
          residency_id?: string | null
          residency_tier?: string | null
          seeking_experiences?: string[] | null
          suggested_experience?: string | null
          telegram_handle?: string | null
          updated_at?: string
          want_house_accommodation?: boolean | null
          website_url?: string | null
          x_handle?: string | null
        }
        Update: {
          accept_invitation?: boolean | null
          anything_else?: string | null
          available_from?: string | null
          available_to?: string | null
          background_experience?: string[] | null
          cancellation_policy?: boolean | null
          community_id?: string | null
          confirmation_status?: string | null
          confirmed_at?: string | null
          contribution?: string | null
          created_at?: string
          edge_city_ticket?: boolean | null
          email?: string
          excited_to_build?: string | null
          food_preferences?: string | null
          full_name?: string
          github_url?: string | null
          hotel_room?: string | null
          housing_option?: string | null
          housing_sorted?: boolean | null
          id?: string
          instagram_handle?: string | null
          linkedin_url?: string | null
          media_release?: boolean | null
          need_housing?: boolean | null
          payment_method?: string | null
          planning_dev_connect?: boolean | null
          portfolio_url?: string | null
          referral_source?: string | null
          residency_id?: string | null
          residency_tier?: string | null
          seeking_experiences?: string[] | null
          suggested_experience?: string | null
          telegram_handle?: string | null
          updated_at?: string
          want_house_accommodation?: boolean | null
          website_url?: string | null
          x_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_residency_id_fkey"
            columns: ["residency_id"]
            isOneToOne: false
            referencedRelation: "residencies"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_recipients: {
        Row: {
          automation_id: string
          channel: string
          chat_id: string
          created_at: string
          enabled: boolean
          id: string
          label: string | null
        }
        Insert: {
          automation_id: string
          channel?: string
          chat_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
        }
        Update: {
          automation_id?: string
          channel?: string
          chat_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_recipients_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          community_id: string
          config: Json
          created_at: string
          description: string | null
          edge_function: string
          enabled: boolean
          id: string
          last_run_at: string | null
          last_run_error: string | null
          last_run_status: string | null
          name: string
          prompt: string | null
          schedule_cron: string | null
          schedule_label: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          community_id: string
          config?: Json
          created_at?: string
          description?: string | null
          edge_function: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          name: string
          prompt?: string | null
          schedule_cron?: string | null
          schedule_label?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          config?: Json
          created_at?: string
          description?: string | null
          edge_function?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          name?: string
          prompt?: string | null
          schedule_cron?: string | null
          schedule_label?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          estimated_setup_time: number | null
          example_interactions: string[] | null
          id: string
          is_featured: boolean | null
          long_description: string | null
          name: string
          tags: string[] | null
          template_config: Json
          thumbnail_url: string | null
          updated_at: string
          use_count: number | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_setup_time?: number | null
          example_interactions?: string[] | null
          id?: string
          is_featured?: boolean | null
          long_description?: string | null
          name: string
          tags?: string[] | null
          template_config?: Json
          thumbnail_url?: string | null
          updated_at?: string
          use_count?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_setup_time?: number | null
          example_interactions?: string[] | null
          id?: string
          is_featured?: boolean | null
          long_description?: string | null
          name?: string
          tags?: string[] | null
          template_config?: Json
          thumbnail_url?: string | null
          updated_at?: string
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_tokens: {
        Row: {
          chain_id: number
          community_id: string
          created_at: string
          created_by: string | null
          hook_address: string | null
          id: string
          image_ipfs_hash: string | null
          initial_supply: string | null
          launch_metadata: Json | null
          metadata_ipfs_hash: string | null
          num_tokens_to_sell: string | null
          template_id: string
          token_address: string
          token_description: string | null
          token_name: string
          token_symbol: string
          transaction_hash: string
          updated_at: string
        }
        Insert: {
          chain_id?: number
          community_id: string
          created_at?: string
          created_by?: string | null
          hook_address?: string | null
          id?: string
          image_ipfs_hash?: string | null
          initial_supply?: string | null
          launch_metadata?: Json | null
          metadata_ipfs_hash?: string | null
          num_tokens_to_sell?: string | null
          template_id: string
          token_address: string
          token_description?: string | null
          token_name: string
          token_symbol: string
          transaction_hash: string
          updated_at?: string
        }
        Update: {
          chain_id?: number
          community_id?: string
          created_at?: string
          created_by?: string | null
          hook_address?: string | null
          id?: string
          image_ipfs_hash?: string | null
          initial_supply?: string | null
          launch_metadata?: Json | null
          metadata_ipfs_hash?: string | null
          num_tokens_to_sell?: string | null
          template_id?: string
          token_address?: string
          token_description?: string | null
          token_name?: string
          token_symbol?: string
          transaction_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_tokens_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          community_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          glb_file_url: string
          id: string
          is_default: boolean | null
          metadata: Json | null
          name: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          glb_file_url: string
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          name: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          glb_file_url?: string
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          agent_avatar_url: string | null
          agent_instructions: string | null
          agent_intro_message: string | null
          agent_max_tokens: number | null
          agent_model: string | null
          agent_name: string | null
          agent_suggested_messages: string[] | null
          agent_temperature: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          daily_message_content: string | null
          daily_message_enabled: boolean | null
          daily_message_time: string | null
          description: string | null
          elevenlabs_agent_id: string | null
          experiences: string[] | null
          game_design_gravity_y: number | null
          game_design_sky_color: string | null
          game_design_time_scale: number | null
          id: string
          invite_code: string | null
          last_activity_at: string | null
          name: string
          privacy_level: string
          support_email: string | null
          telegram_bot_token: string | null
          telegram_bot_url: string | null
          timezone: string | null
          total_cost_usd: number | null
          total_tokens_used: number | null
          universal_id: string
          updated_at: string
          webhook_api_key: string | null
          webhook_enabled: boolean | null
          webhook_last_used_at: string | null
          webhook_request_count: number | null
        }
        Insert: {
          agent_avatar_url?: string | null
          agent_instructions?: string | null
          agent_intro_message?: string | null
          agent_max_tokens?: number | null
          agent_model?: string | null
          agent_name?: string | null
          agent_suggested_messages?: string[] | null
          agent_temperature?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          daily_message_content?: string | null
          daily_message_enabled?: boolean | null
          daily_message_time?: string | null
          description?: string | null
          elevenlabs_agent_id?: string | null
          experiences?: string[] | null
          game_design_gravity_y?: number | null
          game_design_sky_color?: string | null
          game_design_time_scale?: number | null
          id?: string
          invite_code?: string | null
          last_activity_at?: string | null
          name: string
          privacy_level?: string
          support_email?: string | null
          telegram_bot_token?: string | null
          telegram_bot_url?: string | null
          timezone?: string | null
          total_cost_usd?: number | null
          total_tokens_used?: number | null
          universal_id: string
          updated_at?: string
          webhook_api_key?: string | null
          webhook_enabled?: boolean | null
          webhook_last_used_at?: string | null
          webhook_request_count?: number | null
        }
        Update: {
          agent_avatar_url?: string | null
          agent_instructions?: string | null
          agent_intro_message?: string | null
          agent_max_tokens?: number | null
          agent_model?: string | null
          agent_name?: string | null
          agent_suggested_messages?: string[] | null
          agent_temperature?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          daily_message_content?: string | null
          daily_message_enabled?: boolean | null
          daily_message_time?: string | null
          description?: string | null
          elevenlabs_agent_id?: string | null
          experiences?: string[] | null
          game_design_gravity_y?: number | null
          game_design_sky_color?: string | null
          game_design_time_scale?: number | null
          id?: string
          invite_code?: string | null
          last_activity_at?: string | null
          name?: string
          privacy_level?: string
          support_email?: string | null
          telegram_bot_token?: string | null
          telegram_bot_url?: string | null
          timezone?: string | null
          total_cost_usd?: number | null
          total_tokens_used?: number | null
          universal_id?: string
          updated_at?: string
          webhook_api_key?: string | null
          webhook_enabled?: boolean | null
          webhook_last_used_at?: string | null
          webhook_request_count?: number | null
        }
        Relationships: []
      }
      community_favorites: {
        Row: {
          community_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          display_order: number | null
          group_name: string | null
          id: string
          joined_at: string
          notes: string | null
          questionnaire_completed: boolean | null
          referred_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          display_order?: number | null
          group_name?: string | null
          id?: string
          joined_at?: string
          notes?: string | null
          questionnaire_completed?: boolean | null
          referred_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          display_order?: number | null
          group_name?: string | null
          id?: string
          joined_at?: string
          notes?: string | null
          questionnaire_completed?: boolean | null
          referred_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_workflows: {
        Row: {
          community_id: string
          configuration: Json | null
          created_at: string
          id: string
          is_enabled: boolean
          updated_at: string
          workflow_type: string
        }
        Insert: {
          community_id: string
          configuration?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          workflow_type: string
        }
        Update: {
          community_id?: string
          configuration?: Json | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_workflows_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          body: string | null
          campaign_id: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          direction: string | null
          from_email: string | null
          id: string
          metadata: Json
          occurred_at: string
          subject: string | null
          to_email: string | null
          type: string
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          direction?: string | null
          from_email?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          subject?: string | null
          to_email?: string | null
          type: string
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string | null
          from_email?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          subject?: string | null
          to_email?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_admin_telegram: {
        Row: {
          created_at: string
          id: string
          notify_stale_replies: boolean
          telegram_chat_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_stale_replies?: boolean
          telegram_chat_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_stale_replies?: boolean
          telegram_chat_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_campaigns: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_contact_campaigns: {
        Row: {
          added_at: string
          campaign_id: string
          contact_id: string
        }
        Insert: {
          added_at?: string
          campaign_id: string
          contact_id: string
        }
        Update: {
          added_at?: string
          campaign_id?: string
          contact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_campaigns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          email_normalized: string | null
          full_name: string
          id: string
          last_activity_at: string | null
          linkedin_url: string | null
          location: string | null
          needs_reply_since: string | null
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          primary_campaign_id: string | null
          source: string | null
          status: string
          tags: string[]
          title: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_normalized?: string | null
          full_name: string
          id?: string
          last_activity_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          needs_reply_since?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          primary_campaign_id?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_normalized?: string | null
          full_name?: string
          id?: string
          last_activity_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          needs_reply_since?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          primary_campaign_id?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_primary_campaign_id_fkey"
            columns: ["primary_campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_email_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          domain: string | null
          email_address: string
          id: string
          is_active: boolean
          notes: string | null
          provider: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          domain?: string | null
          email_address: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          domain?: string | null
          email_address?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      custom_tool_logs: {
        Row: {
          community_id: string
          error_message: string | null
          executed_at: string
          execution_time_ms: number | null
          id: string
          input_data: Json | null
          message_context: string | null
          output_data: Json | null
          status_code: number | null
          tool_id: string
          user_id: string | null
        }
        Insert: {
          community_id: string
          error_message?: string | null
          executed_at?: string
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          message_context?: string | null
          output_data?: Json | null
          status_code?: number | null
          tool_id: string
          user_id?: string | null
        }
        Update: {
          community_id?: string
          error_message?: string | null
          executed_at?: string
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          message_context?: string | null
          output_data?: Json | null
          status_code?: number | null
          tool_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_tool_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_tool_logs_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "custom_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_tool_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_tools: {
        Row: {
          auth_type: string
          auth_value: string | null
          category: string | null
          community_id: string
          created_at: string
          description: string
          display_name: string
          endpoint_url: string
          error_count: number | null
          http_method: string
          icon: string | null
          id: string
          is_enabled: boolean | null
          last_error: string | null
          last_test_at: string | null
          last_test_result: Json | null
          name: string
          parameters: Json | null
          rate_limit_per_hour: number | null
          request_template: Json | null
          response_mapping: Json | null
          timeout_seconds: number | null
          updated_at: string
        }
        Insert: {
          auth_type?: string
          auth_value?: string | null
          category?: string | null
          community_id: string
          created_at?: string
          description: string
          display_name: string
          endpoint_url: string
          error_count?: number | null
          http_method?: string
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          last_error?: string | null
          last_test_at?: string | null
          last_test_result?: Json | null
          name: string
          parameters?: Json | null
          rate_limit_per_hour?: number | null
          request_template?: Json | null
          response_mapping?: Json | null
          timeout_seconds?: number | null
          updated_at?: string
        }
        Update: {
          auth_type?: string
          auth_value?: string | null
          category?: string | null
          community_id?: string
          created_at?: string
          description?: string
          display_name?: string
          endpoint_url?: string
          error_count?: number | null
          http_method?: string
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          last_error?: string | null
          last_test_at?: string | null
          last_test_result?: Json | null
          name?: string
          parameters?: Json | null
          rate_limit_per_hour?: number | null
          request_template?: Json | null
          response_mapping?: Json | null
          timeout_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_tools_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_recaps: {
        Row: {
          brief: string
          community_id: string
          created_at: string
          delivered_to: string | null
          delivery_status: string | null
          id: string
          source_message_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          brief: string
          community_id: string
          created_at?: string
          delivered_to?: string | null
          delivery_status?: string | null
          id?: string
          source_message_count?: number
          window_end: string
          window_start: string
        }
        Update: {
          brief?: string
          community_id?: string
          created_at?: string
          delivered_to?: string | null
          delivery_status?: string | null
          id?: string
          source_message_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          attended: boolean | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          rsvp_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          rsvp_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attended?: boolean | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          rsvp_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          current_attendees: number | null
          description: string | null
          event_end_time: string
          event_image_url: string | null
          event_location: string | null
          event_start_time: string
          event_status: string | null
          event_type: string | null
          hosted_by: string | null
          id: string
          is_featured: boolean | null
          is_public: boolean | null
          max_attendees: number | null
          metadata: Json | null
          registration_required: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          current_attendees?: number | null
          description?: string | null
          event_end_time: string
          event_image_url?: string | null
          event_location?: string | null
          event_start_time: string
          event_status?: string | null
          event_type?: string | null
          hosted_by?: string | null
          id?: string
          is_featured?: boolean | null
          is_public?: boolean | null
          max_attendees?: number | null
          metadata?: Json | null
          registration_required?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          current_attendees?: number | null
          description?: string | null
          event_end_time?: string
          event_image_url?: string | null
          event_location?: string | null
          event_start_time?: string
          event_status?: string | null
          event_type?: string | null
          hosted_by?: string | null
          id?: string
          is_featured?: boolean | null
          is_public?: boolean | null
          max_attendees?: number | null
          metadata?: Json | null
          registration_required?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_photos: {
        Row: {
          community_id: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string
          is_visible: boolean
          residency_name: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_visible?: boolean
          residency_name?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_visible?: boolean
          residency_name?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_photos_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_link_tokens: {
        Row: {
          community_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_link_tokens_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          community_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          chat_type: string | null
          community_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_type: string | null
          metadata: Json | null
          reply_to_message_id: string | null
          sender_id: string | null
          sent_by: string | null
          topic_name: string | null
          universal_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          chat_type?: string | null
          community_id?: string | null
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sent_by?: string | null
          topic_name?: string | null
          universal_id?: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          chat_type?: string | null
          community_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sent_by?: string | null
          topic_name?: string | null
          universal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          community_id: string
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          email: string | null
          id: string
          product_name: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          product_name: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          product_name?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          amount_paid: number | null
          community_id: string
          contact_email: string | null
          contact_name: string | null
          contract_value: number | null
          created_at: string
          currency: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          notes: string | null
          partner_type: string
          payment_status: string
          residency_id: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          amount_paid?: number | null
          community_id: string
          contact_email?: string | null
          contact_name?: string | null
          contract_value?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          notes?: string | null
          partner_type?: string
          payment_status?: string
          residency_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          amount_paid?: number | null
          community_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contract_value?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          notes?: string | null
          partner_type?: string
          payment_status?: string
          residency_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_residency_id_fkey"
            columns: ["residency_id"]
            isOneToOne: false
            referencedRelation: "residencies"
            referencedColumns: ["id"]
          },
        ]
      }
      player_positions: {
        Row: {
          character_glb_url: string | null
          community_id: string
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          position_x: number
          position_y: number
          position_z: number
          rotation: number
          updated_at: string
          user_id: string
        }
        Insert: {
          character_glb_url?: string | null
          community_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          position_x?: number
          position_y?: number
          position_z?: number
          rotation?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          character_glb_url?: string | null
          community_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          position_x?: number
          position_y?: number
          position_z?: number
          rotation?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_roadmap: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          description: string
          downvotes: number | null
          estimated_timeline: string | null
          icon: string | null
          id: string
          order_index: number | null
          priority: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          upvotes: number | null
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string
          description: string
          downvotes?: number | null
          estimated_timeline?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          priority: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          upvotes?: number | null
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          downvotes?: number | null
          estimated_timeline?: string | null
          icon?: string | null
          id?: string
          order_index?: number | null
          priority?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          upvotes?: number | null
        }
        Relationships: []
      }
      profile_claim_requests: {
        Row: {
          auth_user_id: string
          created_at: string
          expires_at: string
          id: string
          is_verified: boolean
          user_profile_id: string
          verification_code: string
          verified_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          expires_at?: string
          id?: string
          is_verified?: boolean
          user_profile_id: string
          verification_code: string
          verified_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_verified?: boolean
          user_profile_id?: string
          verification_code?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_claim_requests_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      registered_apps: {
        Row: {
          allowed_origins: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_user_id: string | null
          redirect_uris: string[] | null
          updated_at: string | null
        }
        Insert: {
          allowed_origins?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_user_id?: string | null
          redirect_uris?: string[] | null
          updated_at?: string | null
        }
        Update: {
          allowed_origins?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_user_id?: string | null
          redirect_uris?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registered_apps_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      residencies: {
        Row: {
          background_image_url: string | null
          community_id: string | null
          country: string | null
          created_at: string
          currency: string | null
          description: string | null
          display_order: number | null
          end_date: string | null
          external_url: string | null
          gradient_from: string | null
          gradient_to: string | null
          id: string
          internal_path: string | null
          is_visible: boolean
          location: string
          name: string
          start_date: string | null
          status: string
          total_budget: number | null
          total_expenses: number | null
          total_revenue: number | null
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          community_id?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          external_url?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          id?: string
          internal_path?: string | null
          is_visible?: boolean
          location: string
          name: string
          start_date?: string | null
          status?: string
          total_budget?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          community_id?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          external_url?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          id?: string
          internal_path?: string | null
          is_visible?: boolean
          location?: string
          name?: string
          start_date?: string | null
          status?: string
          total_budget?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "residencies_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          phone: string | null
          sponsorship_level: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          phone?: string | null
          sponsorship_level?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          phone?: string | null
          sponsorship_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_bots: {
        Row: {
          bot_name: string | null
          bot_token: string
          bot_username: string
          community_id: string
          created_at: string
          id: string
          is_active: boolean
          last_activity_at: string | null
          metadata: Json | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          bot_name?: string | null
          bot_token: string
          bot_username: string
          community_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          bot_name?: string | null
          bot_token?: string
          bot_username?: string
          community_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      telegram_chat_sessions: {
        Row: {
          bot_id: string
          community_id: string
          created_at: string
          id: string
          is_active: boolean | null
          last_message_at: string | null
          last_outreach_at: string | null
          message_count: number | null
          metadata: Json | null
          proactive_outreach_enabled: boolean | null
          telegram_chat_id: number
          telegram_first_name: string | null
          telegram_last_name: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          bot_id: string
          community_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_outreach_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          proactive_outreach_enabled?: boolean | null
          telegram_chat_id: number
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          bot_id?: string
          community_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_outreach_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          proactive_outreach_enabled?: boolean | null
          telegram_chat_id?: number
          telegram_first_name?: string | null
          telegram_last_name?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_chat_sessions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "telegram_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_group_settings: {
        Row: {
          added_at: string
          bot_username: string
          chat_id: number
          chat_title: string | null
          disabled_at: string | null
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
        }
        Insert: {
          added_at?: string
          bot_username?: string
          chat_id: number
          chat_title?: string | null
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
        }
        Update: {
          added_at?: string
          bot_username?: string
          chat_id?: number
          chat_title?: string | null
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
        }
        Relationships: []
      }
      user_embeddings: {
        Row: {
          bio_embedding: string | null
          bio_text: string | null
          combined_embedding: string | null
          created_at: string
          id: string
          interests_embedding: string | null
          interests_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_embedding?: string | null
          bio_text?: string | null
          combined_embedding?: string | null
          created_at?: string
          id?: string
          interests_embedding?: string | null
          interests_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_embedding?: string | null
          bio_text?: string | null
          combined_embedding?: string | null
          created_at?: string
          id?: string
          interests_embedding?: string | null
          interests_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          app_order: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_order?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_order?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
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
          role?: Database["public"]["Enums"]["app_role"]
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          headline: string | null
          id: string
          instagram_handle: string | null
          intentions: string | null
          interests_skills: string[] | null
          is_claimed: boolean | null
          name: string | null
          original_item_id: number | null
          phone_number: string | null
          phone_verified: boolean | null
          profile_picture_url: string | null
          source_url: string | null
          telegram_photo_url: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          twitter_handle: string | null
          universal_id: string
          updated_at: string
          username: string | null
          vibecoin_balance: number
          wallet_address: string | null
          wallet_connected_at: string | null
          wallet_provider: string | null
          world_id_nullifier_hash: string | null
          world_id_verified: boolean | null
          world_id_verified_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          headline?: string | null
          id?: string
          instagram_handle?: string | null
          intentions?: string | null
          interests_skills?: string[] | null
          is_claimed?: boolean | null
          name?: string | null
          original_item_id?: number | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_picture_url?: string | null
          source_url?: string | null
          telegram_photo_url?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          twitter_handle?: string | null
          universal_id: string
          updated_at?: string
          username?: string | null
          vibecoin_balance?: number
          wallet_address?: string | null
          wallet_connected_at?: string | null
          wallet_provider?: string | null
          world_id_nullifier_hash?: string | null
          world_id_verified?: boolean | null
          world_id_verified_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          headline?: string | null
          id?: string
          instagram_handle?: string | null
          intentions?: string | null
          interests_skills?: string[] | null
          is_claimed?: boolean | null
          name?: string | null
          original_item_id?: number | null
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_picture_url?: string | null
          source_url?: string | null
          telegram_photo_url?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          twitter_handle?: string | null
          universal_id?: string
          updated_at?: string
          username?: string | null
          vibecoin_balance?: number
          wallet_address?: string | null
          wallet_connected_at?: string | null
          wallet_provider?: string | null
          world_id_nullifier_hash?: string | null
          world_id_verified?: boolean | null
          world_id_verified_at?: string | null
        }
        Relationships: []
      }
      vibecoin_pickups: {
        Row: {
          collected_at: string | null
          collected_by: string | null
          community_id: string
          created_at: string
          id: string
          is_collected: boolean | null
          position_x: number
          position_y: number
          position_z: number
          respawn_at: string | null
          updated_at: string
        }
        Insert: {
          collected_at?: string | null
          collected_by?: string | null
          community_id: string
          created_at?: string
          id?: string
          is_collected?: boolean | null
          position_x: number
          position_y: number
          position_z: number
          respawn_at?: string | null
          updated_at?: string
        }
        Update: {
          collected_at?: string | null
          collected_by?: string | null
          community_id?: string
          created_at?: string
          id?: string
          is_collected?: boolean | null
          position_x?: number
          position_y?: number
          position_z?: number
          respawn_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibecoin_pickups_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibecoin_pickups_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      vibey_relationships: {
        Row: {
          agent_id: string
          community_id: string
          created_at: string
          display_name: string | null
          id: string
          interaction_count: number | null
          last_interaction_at: string | null
          last_scheduled_send_at: string | null
          relationship_notes: string | null
          schedule_cron: string | null
          schedule_enabled: boolean | null
          scheduled_message: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          community_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          last_scheduled_send_at?: string | null
          relationship_notes?: string | null
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          scheduled_message?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          community_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          last_scheduled_send_at?: string | null
          relationship_notes?: string | null
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          scheduled_message?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibey_relationships_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibey_relationships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      world_objects: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          id: string
          object_type: string
          position: Json
          properties: Json
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          object_type: string
          position?: Json
          properties?: Json
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          object_type?: string
          position?: Json
          properties?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_objects_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_objects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conversations: {
        Row: {
          chat_type: string | null
          community_id: string | null
          conversation_id: string | null
          last_message_at: string | null
          message_count: number | null
          participant_count: number | null
          started_at: string | null
          topic_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_join_community_as_admin: {
        Args: { target_community_id: string }
        Returns: boolean
      }
      can_view_community_user: {
        Args: { target_user_id: string; viewer_auth_id: string }
        Returns: boolean
      }
      check_community_membership: {
        Args: { _auth_user_id: string; _community_id: string }
        Returns: boolean
      }
      ensure_unique_universal_id: {
        Args: { table_name: string }
        Returns: string
      }
      generate_universal_id: { Args: never; Returns: string }
      get_communities_for_daily_message: {
        Args: never
        Returns: {
          community_id: string
          community_name: string
          daily_message_content: string
          telegram_bot_token: string
        }[]
      }
      get_communities_with_favorites: {
        Args: { limit_count?: number; user_auth_id?: string }
        Returns: {
          cover_image_url: string
          description: string
          game_design_sky_color: string
          id: string
          is_favorited: boolean
          name: string
        }[]
      }
      get_communities_with_member_count: {
        Args: {
          excluded_community_ids?: string[]
          limit_count?: number
          offset_count?: number
        }
        Returns: {
          cover_image_url: string
          description: string
          id: string
          invite_code: string
          member_count: number
          name: string
          privacy_level: string
        }[]
      }
      get_current_user_from_context: { Args: never; Returns: string }
      get_user_id_from_auth: { Args: { auth_user_id: string }; Returns: string }
      get_user_public_profile: {
        Args: { user_id_param: string }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          headline: string
          id: string
          interests_skills: string[]
          name: string
          profile_picture_url: string
          username: string
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_community_admin: {
        Args: { community_id_param: string; user_auth_id: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { community_id_param: string; user_id_param: string }
        Returns: boolean
      }
      semantic_search_users: {
        Args: {
          excluded_user_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          avatar_url: string
          bio: string
          interests_skills: string[]
          name: string
          similarity: number
          user_id: string
        }[]
      }
      verify_api_key: {
        Args: { key_hash: string; key_prefix: string }
        Returns: {
          app_id: string
          app_name: string
          is_valid: boolean
          rate_limit: number
          scopes: Database["public"]["Enums"]["api_scope"][]
        }[]
      }
    }
    Enums: {
      api_scope:
        | "read:users"
        | "write:users"
        | "read:profile"
        | "auth:login"
        | "auth:verify"
      app_role: "admin" | "moderator" | "member"
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
      api_scope: [
        "read:users",
        "write:users",
        "read:profile",
        "auth:login",
        "auth:verify",
      ],
      app_role: ["admin", "moderator", "member"],
    },
  },
} as const
