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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          recipient_email: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          recipient_email: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          recipient_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string | null
          total_input_tokens: number
          total_output_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          total_input_tokens?: number
          total_output_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          total_input_tokens?: number
          total_output_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_embedding_cache: {
        Row: {
          created_at: string
          embedding: Json
          query_hash: string
          query_text: string
        }
        Insert: {
          created_at?: string
          embedding: Json
          query_hash: string
          query_text: string
        }
        Update: {
          created_at?: string
          embedding?: Json
          query_hash?: string
          query_text?: string
        }
        Relationships: []
      }
      agent_feedback: {
        Row: {
          assistant_response: string
          conversation_id: string | null
          created_at: string
          id: string
          rating: string
          user_id: string
          user_prompt: string
        }
        Insert: {
          assistant_response: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          rating: string
          user_id: string
          user_prompt: string
        }
        Update: {
          assistant_response?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          rating?: string
          user_id?: string
          user_prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_query_audit_log: {
        Row: {
          created_at: string
          error_message: string | null
          execution_ms: number | null
          explanation: string | null
          id: string
          query_text: string
          row_count: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_ms?: number | null
          explanation?: string | null
          id?: string
          query_text: string
          row_count?: number | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_ms?: number | null
          explanation?: string | null
          id?: string
          query_text?: string
          row_count?: number | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      agent_schema_registry: {
        Row: {
          columns: Json
          created_at: string
          description: string | null
          display_order: number
          hidden_columns: string[]
          id: string
          is_queryable: boolean
          table_name: string
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          hidden_columns?: string[]
          id?: string
          is_queryable?: boolean
          table_name: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          hidden_columns?: string[]
          id?: string
          is_queryable?: boolean
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_brand_settings: {
        Row: {
          content: string
          id: string
          setting_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          setting_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          setting_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          permissions: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          permissions?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          request_body: Json | null
          response_body: Json | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          request_body?: Json | null
          response_body?: Json | null
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
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance_signatures: {
        Row: {
          audit_metadata: Json | null
          created_at: string
          email_opened_at: string | null
          email_sent_at: string | null
          id: string
          ip_address: string | null
          journey_events: Json | null
          participant_id: string
          period: string
          proof_file_url: string | null
          proof_hash: string | null
          schedule_date: string
          signature_data: string | null
          signed_at: string | null
          token: string
          training_id: string
          user_agent: string | null
        }
        Insert: {
          audit_metadata?: Json | null
          created_at?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          id?: string
          ip_address?: string | null
          journey_events?: Json | null
          participant_id: string
          period: string
          proof_file_url?: string | null
          proof_hash?: string | null
          schedule_date: string
          signature_data?: string | null
          signed_at?: string | null
          token: string
          training_id: string
          user_agent?: string | null
        }
        Update: {
          audit_metadata?: Json | null
          created_at?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          id?: string
          ip_address?: string | null
          journey_events?: Json | null
          participant_id?: string
          period?: string
          proof_file_url?: string | null
          proof_hash?: string | null
          schedule_date?: string
          signature_data?: string | null
          signed_at?: string | null
          token?: string
          training_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_signatures_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_signatures_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          created_at: string
          currency: string
          display_order: number
          features: Json
          id: string
          is_active: boolean
          max_emails_per_month: number | null
          max_participants: number | null
          max_storage_mb: number | null
          max_trainings: number | null
          name: string
          price_monthly: number
          price_yearly: number | null
          slug: string
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_emails_per_month?: number | null
          max_participants?: number | null
          max_storage_mb?: number | null
          max_trainings?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number | null
          slug: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_emails_per_month?: number | null
          max_participants?: number | null
          max_storage_mb?: number | null
          max_trainings?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          slug?: string
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chatbot_conversations: {
        Row: {
          answer: string
          created_at: string | null
          feedback: string | null
          id: string
          question: string
          sources: string[] | null
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          question: string
          sources?: string[] | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          question?: string
          sources?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      chatbot_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          priority: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          priority?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          priority?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coaching_bookings: {
        Row: {
          confirmed_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          instructor_notes: string | null
          learner_notes: string | null
          meeting_url: string | null
          participant_id: string
          requested_date: string
          status: string
          training_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instructor_notes?: string | null
          learner_notes?: string | null
          meeting_url?: string | null
          participant_id: string
          requested_date: string
          status?: string
          training_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instructor_notes?: string | null
          learner_notes?: string | null
          meeting_url?: string | null
          participant_id?: string
          requested_date?: string
          status?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_bookings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_bookings_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_summaries: {
        Row: {
          action_items: Json | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          generated_by: string | null
          id: string
          key_topics: Json | null
          participant_id: string | null
          summary_text: string
          training_id: string
        }
        Insert: {
          action_items?: Json | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string | null
          id?: string
          key_topics?: Json | null
          participant_id?: string | null
          summary_text: string
          training_id: string
        }
        Update: {
          action_items?: Json | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string | null
          id?: string
          key_topics?: Json | null
          participant_id?: string | null
          summary_text?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_summaries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "coaching_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_summaries_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_summaries_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_coach_contexts: {
        Row: {
          content: string
          context_type: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
          year: number
        }
        Insert: {
          content?: string
          context_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          year: number
        }
        Update: {
          content?: string
          context_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      content_cards: {
        Row: {
          card_type: string
          column_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          display_order: number
          emoji: string | null
          id: string
          image_url: string | null
          org_id: string | null
          tags: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          card_type?: string
          column_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          image_url?: string | null
          org_id?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          card_type?: string
          column_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          image_url?: string | null
          org_id?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "content_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_columns: {
        Row: {
          assigned_user_ids: string[]
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          assigned_user_ids?: string[]
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
          assigned_user_ids?: string[]
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      content_notifications: {
        Row: {
          card_id: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          reference_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          reference_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          reference_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      content_reviews: {
        Row: {
          card_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          external_url: string | null
          general_opinion: string | null
          id: string
          reminder_sent_at: string | null
          reviewer_email: string | null
          reviewer_id: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          card_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          general_opinion?: string | null
          id?: string
          reminder_sent_at?: string | null
          reviewer_email?: string | null
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          card_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          general_opinion?: string | null
          id?: string
          reminder_sent_at?: string | null
          reviewer_email?: string | null
          reviewer_id?: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "content_reviews_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "content_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      convention_signatures: {
        Row: {
          audit_metadata: Json | null
          client_name: string
          confirmation_email_sent_at: string | null
          created_at: string
          email_opened_at: string | null
          email_sent_at: string | null
          expires_at: string | null
          formation_name: string
          id: string
          ip_address: string | null
          journey_events: Json | null
          pdf_hash: string | null
          pdf_url: string
          proof_file_url: string | null
          proof_hash: string | null
          recipient_email: string
          recipient_name: string | null
          signature_data: string | null
          signed_at: string | null
          signed_pdf_url: string | null
          status: string
          token: string
          training_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          audit_metadata?: Json | null
          client_name: string
          confirmation_email_sent_at?: string | null
          created_at?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          formation_name: string
          id?: string
          ip_address?: string | null
          journey_events?: Json | null
          pdf_hash?: string | null
          pdf_url: string
          proof_file_url?: string | null
          proof_hash?: string | null
          recipient_email: string
          recipient_name?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          status?: string
          token: string
          training_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          audit_metadata?: Json | null
          client_name?: string
          confirmation_email_sent_at?: string | null
          created_at?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          formation_name?: string
          id?: string
          ip_address?: string | null
          journey_events?: Json | null
          pdf_hash?: string | null
          pdf_url?: string
          proof_file_url?: string | null
          proof_hash?: string | null
          recipient_email?: string
          recipient_name?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_pdf_url?: string | null
          status?: string
          token?: string
          training_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convention_signatures_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_log: {
        Row: {
          action_type: string
          actor_email: string
          card_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action_type: string
          actor_email: string
          card_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action_type?: string
          actor_email?: string
          card_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_log_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_attachments: {
        Row: {
          card_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_card_emails: {
        Row: {
          attachment_names: string[] | null
          attachment_paths: string[] | null
          body_html: string
          card_id: string
          id: string
          recipient_email: string
          sender_email: string
          sent_at: string
          subject: string
        }
        Insert: {
          attachment_names?: string[] | null
          attachment_paths?: string[] | null
          body_html: string
          card_id: string
          id?: string
          recipient_email: string
          sender_email: string
          sent_at?: string
          subject: string
        }
        Update: {
          attachment_names?: string[] | null
          attachment_paths?: string[] | null
          body_html?: string
          card_id?: string
          id?: string
          recipient_email?: string
          sender_email?: string
          sent_at?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_card_emails_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_card_tags: {
        Row: {
          card_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_card_tags_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_card_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cards: {
        Row: {
          acquisition_source: string | null
          address: string | null
          assigned_to: string | null
          brief_questions: Json | null
          city: string | null
          column_id: string
          company: string | null
          confidence_score: number | null
          country: string | null
          created_at: string
          description_html: string | null
          email: string | null
          emoji: string | null
          estimated_value: number | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          linked_mission_id: string | null
          linkedin_url: string | null
          loss_reason: string | null
          loss_reason_detail: string | null
          lost_at: string | null
          next_action_done: boolean | null
          next_action_text: string | null
          next_action_type: string | null
          org_id: string | null
          phone: string | null
          position: number
          postal_code: string | null
          quote_url: string | null
          raw_input: string | null
          sales_status: string
          service_type: string | null
          siren: string | null
          status_operational: string
          title: string
          updated_at: string
          waiting_next_action_date: string | null
          waiting_next_action_text: string | null
          website_url: string | null
          won_at: string | null
        }
        Insert: {
          acquisition_source?: string | null
          address?: string | null
          assigned_to?: string | null
          brief_questions?: Json | null
          city?: string | null
          column_id: string
          company?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          description_html?: string | null
          email?: string | null
          emoji?: string | null
          estimated_value?: number | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          linked_mission_id?: string | null
          linkedin_url?: string | null
          loss_reason?: string | null
          loss_reason_detail?: string | null
          lost_at?: string | null
          next_action_done?: boolean | null
          next_action_text?: string | null
          next_action_type?: string | null
          org_id?: string | null
          phone?: string | null
          position?: number
          postal_code?: string | null
          quote_url?: string | null
          raw_input?: string | null
          sales_status?: string
          service_type?: string | null
          siren?: string | null
          status_operational?: string
          title: string
          updated_at?: string
          waiting_next_action_date?: string | null
          waiting_next_action_text?: string | null
          website_url?: string | null
          won_at?: string | null
        }
        Update: {
          acquisition_source?: string | null
          address?: string | null
          assigned_to?: string | null
          brief_questions?: Json | null
          city?: string | null
          column_id?: string
          company?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          description_html?: string | null
          email?: string | null
          emoji?: string | null
          estimated_value?: number | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          linked_mission_id?: string | null
          linkedin_url?: string | null
          loss_reason?: string | null
          loss_reason_detail?: string | null
          lost_at?: string | null
          next_action_done?: boolean | null
          next_action_text?: string | null
          next_action_type?: string | null
          org_id?: string | null
          phone?: string | null
          position?: number
          postal_code?: string | null
          quote_url?: string | null
          raw_input?: string | null
          sales_status?: string
          service_type?: string | null
          siren?: string | null
          status_operational?: string
          title?: string
          updated_at?: string
          waiting_next_action_date?: string | null
          waiting_next_action_text?: string | null
          website_url?: string | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "crm_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_columns: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_comments: {
        Row: {
          author_email: string
          card_id: string
          content: string
          created_at: string
          id: string
          is_deleted: boolean
        }
        Insert: {
          author_email: string
          card_id: string
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
        }
        Update: {
          author_email?: string
          card_id?: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_revenue_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          period_start: string
          period_type: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_start: string
          period_type: string
          target_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          period_start?: string
          period_type?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_tags: {
        Row: {
          category: string | null
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      daily_action_analytics: {
        Row: {
          action_date: string
          auto_completed_count: number
          category_stats: Json | null
          completed_count: number
          created_at: string
          id: string
          manual_completed_count: number
          total_actions: number
          user_id: string
        }
        Insert: {
          action_date: string
          auto_completed_count?: number
          category_stats?: Json | null
          completed_count?: number
          created_at?: string
          id?: string
          manual_completed_count?: number
          total_actions?: number
          user_id: string
        }
        Update: {
          action_date?: string
          auto_completed_count?: number
          category_stats?: Json | null
          completed_count?: number
          created_at?: string
          id?: string
          manual_completed_count?: number
          total_actions?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_actions: {
        Row: {
          action_date: string
          auto_completed: boolean
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_completed: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_date?: string
          auto_completed?: boolean
          category: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_completed?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_date?: string
          auto_completed?: boolean
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_completed?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      db_size_snapshots: {
        Row: {
          created_at: string
          id: string
          snapshot_date: string
          table_sizes: Json | null
          total_size_bytes: number
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot_date?: string
          table_sizes?: Json | null
          total_size_bytes: number
        }
        Update: {
          created_at?: string
          id?: string
          snapshot_date?: string
          table_sizes?: Json | null
          total_size_bytes?: number
        }
        Relationships: []
      }
      devis_signatures: {
        Row: {
          activity_log_id: string
          audit_metadata: Json | null
          client_name: string
          created_at: string
          devis_type: string
          email_opened_at: string | null
          email_sent_at: string | null
          expires_at: string | null
          formation_name: string
          id: string
          ip_address: string | null
          journey_events: Json | null
          pdf_url: string
          proof_file_url: string | null
          proof_hash: string | null
          recipient_email: string
          recipient_name: string | null
          signature_data: string | null
          signed_at: string | null
          status: string
          token: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          activity_log_id: string
          audit_metadata?: Json | null
          client_name: string
          created_at?: string
          devis_type: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          formation_name: string
          id?: string
          ip_address?: string | null
          journey_events?: Json | null
          pdf_url: string
          proof_file_url?: string | null
          proof_hash?: string | null
          recipient_email: string
          recipient_name?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          token: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          activity_log_id?: string
          audit_metadata?: Json | null
          client_name?: string
          created_at?: string
          devis_type?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          formation_name?: string
          id?: string
          ip_address?: string | null
          journey_events?: Json | null
          pdf_url?: string
          proof_file_url?: string | null
          proof_hash?: string | null
          recipient_email?: string
          recipient_name?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devis_signatures_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          source_date: string | null
          source_id: string
          source_title: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_date?: string | null
          source_id: string
          source_title?: string | null
          source_type: string
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          source_date?: string | null
          source_id?: string
          source_title?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      edge_function_health: {
        Row: {
          checked_at: string
          function_name: string
          id: string
          response_time_ms: number
          status: string
        }
        Insert: {
          checked_at?: string
          function_name: string
          id?: string
          response_time_ms?: number
          status?: string
        }
        Update: {
          checked_at?: string
          function_name?: string
          id?: string
          response_time_ms?: number
          status?: string
        }
        Relationships: []
      }
      email_snippets: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          name: string
          position: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          name: string
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          name?: string
          position?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          html_content: string
          id: string
          improvement_count: number
          is_default: boolean
          last_improved_at: string | null
          subject: string
          template_name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          html_content: string
          id?: string
          improvement_count?: number
          is_default?: boolean
          last_improved_at?: string | null
          subject: string
          template_name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          improvement_count?: number
          is_default?: boolean
          last_improved_at?: string | null
          subject?: string
          template_name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_analyses: {
        Row: {
          created_at: string
          created_by: string | null
          evaluations_count: number
          id: string
          recommendations: Json
          strengths: Json
          summary: string | null
          training_id: string
          weaknesses: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          evaluations_count?: number
          id?: string
          recommendations?: Json
          strengths?: Json
          summary?: string | null
          training_id: string
          weaknesses?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          evaluations_count?: number
          id?: string
          recommendations?: Json
          strengths?: Json
          summary?: string | null
          training_id?: string
          weaknesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_analyses_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          mime_type: string | null
          position: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          mime_type?: string | null
          position?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shares: {
        Row: {
          event_id: string
          id: string
          recipient_email: string
          recipient_name: string | null
          shared_at: string
          shared_by: string | null
        }
        Insert: {
          event_id: string
          id?: string
          recipient_email: string
          recipient_name?: string | null
          shared_at?: string
          shared_by?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          shared_at?: string
          shared_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_shares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          assigned_to: string | null
          cancellation_reason: string | null
          cfp_deadline: string | null
          cfp_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          event_type: string
          event_url: string | null
          hotel_booked: boolean | null
          id: string
          location: string | null
          location_type: string
          notes: string | null
          org_id: string | null
          private_group_url: string | null
          restaurant_booked: boolean | null
          room_rental_booked: boolean | null
          status: string
          summary_notes: string | null
          title: string
          train_booked: boolean | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          cfp_deadline?: string | null
          cfp_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string
          event_url?: string | null
          hotel_booked?: boolean | null
          id?: string
          location?: string | null
          location_type?: string
          notes?: string | null
          org_id?: string | null
          private_group_url?: string | null
          restaurant_booked?: boolean | null
          room_rental_booked?: boolean | null
          status?: string
          summary_notes?: string | null
          title: string
          train_booked?: boolean | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          cfp_deadline?: string | null
          cfp_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string
          event_url?: string | null
          hotel_booked?: boolean | null
          id?: string
          location?: string | null
          location_type?: string
          notes?: string | null
          org_id?: string | null
          private_group_url?: string | null
          restaurant_booked?: boolean | null
          room_rental_booked?: boolean | null
          status?: string
          summary_notes?: string | null
          title?: string
          train_booked?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_emails: {
        Row: {
          created_at: string | null
          email_type: string | null
          error_message: string | null
          html_content: string
          id: string
          last_retry_at: string | null
          original_sent_at: string | null
          participant_id: string | null
          recipient_email: string
          retry_count: number | null
          status: string | null
          subject: string
          training_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_type?: string | null
          error_message?: string | null
          html_content: string
          id?: string
          last_retry_at?: string | null
          original_sent_at?: string | null
          participant_id?: string | null
          recipient_email: string
          retry_count?: number | null
          status?: string | null
          subject: string
          training_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string | null
          error_message?: string | null
          html_content?: string
          id?: string
          last_retry_at?: string | null
          original_sent_at?: string | null
          participant_id?: string | null
          recipient_email?: string
          retry_count?: number | null
          status?: string | null
          subject?: string
          training_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_emails_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_emails_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage: {
        Row: {
          created_at: string
          feature_category: string
          feature_name: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feature_category: string
          feature_name: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feature_category?: string
          feature_name?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      formation_configs: {
        Row: {
          available_formulas: string[] | null
          created_at: string
          description: string | null
          display_order: number
          duree_heures: number
          elearning_access_email_content: string | null
          elearning_duration: number | null
          format_formation: string | null
          formation_name: string
          id: string
          is_active: boolean
          is_default: boolean
          learndash_course_id: number | null
          objectives: string[] | null
          org_id: string | null
          prerequisites: string[] | null
          prix: number
          programme_url: string | null
          required_equipment: string | null
          supertilt_link: string | null
          supports_url: string | null
          updated_at: string
          woocommerce_product_id: number | null
        }
        Insert: {
          available_formulas?: string[] | null
          created_at?: string
          description?: string | null
          display_order?: number
          duree_heures?: number
          elearning_access_email_content?: string | null
          elearning_duration?: number | null
          format_formation?: string | null
          formation_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          learndash_course_id?: number | null
          objectives?: string[] | null
          org_id?: string | null
          prerequisites?: string[] | null
          prix?: number
          programme_url?: string | null
          required_equipment?: string | null
          supertilt_link?: string | null
          supports_url?: string | null
          updated_at?: string
          woocommerce_product_id?: number | null
        }
        Update: {
          available_formulas?: string[] | null
          created_at?: string
          description?: string | null
          display_order?: number
          duree_heures?: number
          elearning_access_email_content?: string | null
          elearning_duration?: number | null
          format_formation?: string | null
          formation_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          learndash_course_id?: number | null
          objectives?: string[] | null
          org_id?: string | null
          prerequisites?: string[] | null
          prix?: number
          programme_url?: string | null
          required_equipment?: string | null
          supertilt_link?: string | null
          supports_url?: string | null
          updated_at?: string
          woocommerce_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formation_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_dates: {
        Row: {
          created_at: string
          date_label: string
          id: string
          is_default: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_label: string
          id?: string
          is_default?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_label?: string
          id?: string
          is_default?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      formation_formulas: {
        Row: {
          coaching_sessions_count: number
          created_at: string
          display_order: number
          duree_heures: number | null
          elearning_access_email_content: string | null
          formation_config_id: string
          id: string
          learndash_course_id: number | null
          name: string
          prix: number | null
          supports_url: string | null
          updated_at: string
          woocommerce_product_id: number | null
        }
        Insert: {
          coaching_sessions_count?: number
          created_at?: string
          display_order?: number
          duree_heures?: number | null
          elearning_access_email_content?: string | null
          formation_config_id: string
          id?: string
          learndash_course_id?: number | null
          name: string
          prix?: number | null
          supports_url?: string | null
          updated_at?: string
          woocommerce_product_id?: number | null
        }
        Update: {
          coaching_sessions_count?: number
          created_at?: string
          display_order?: number
          duree_heures?: number | null
          elearning_access_email_content?: string | null
          formation_config_id?: string
          id?: string
          learndash_course_id?: number | null
          name?: string
          prix?: number | null
          supports_url?: string | null
          updated_at?: string
          woocommerce_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formation_formulas_formation_config_id_fkey"
            columns: ["formation_config_id"]
            isOneToOne: false
            referencedRelation: "formation_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      formulaire_rate_limits: {
        Row: {
          id: string
          ip_address: string
          requested_at: string
        }
        Insert: {
          id?: string
          ip_address: string
          requested_at?: string
        }
        Update: {
          id?: string
          ip_address?: string
          requested_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_drive_tokens: {
        Row: {
          access_token: string
          access_token_encrypted: string | null
          created_at: string
          id: string
          refresh_token: string
          refresh_token_encrypted: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          refresh_token_encrypted?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          refresh_token_encrypted?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      improvements: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string
          id: string
          org_id: string | null
          priority: string | null
          responsible: string | null
          source_analysis_id: string | null
          source_description: string | null
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          training_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description: string
          id?: string
          org_id?: string | null
          priority?: string | null
          responsible?: string | null
          source_analysis_id?: string | null
          source_description?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          training_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          id?: string
          org_id?: string | null
          priority?: string | null
          responsible?: string | null
          source_analysis_id?: string | null
          source_description?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          training_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "improvements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "improvements_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_emails: {
        Row: {
          attachments: Json | null
          bcc: string[] | null
          cc: string[] | null
          created_at: string | null
          from_email: string
          from_name: string | null
          headers: Json | null
          html_body: string | null
          id: string
          linked_participant_id: string | null
          linked_training_id: string | null
          message_id: string | null
          notes: string | null
          processed_at: string | null
          received_at: string | null
          reply_to: string | null
          status: string | null
          subject: string | null
          text_body: string | null
          to_email: string
        }
        Insert: {
          attachments?: Json | null
          bcc?: string[] | null
          cc?: string[] | null
          created_at?: string | null
          from_email: string
          from_name?: string | null
          headers?: Json | null
          html_body?: string | null
          id?: string
          linked_participant_id?: string | null
          linked_training_id?: string | null
          message_id?: string | null
          notes?: string | null
          processed_at?: string | null
          received_at?: string | null
          reply_to?: string | null
          status?: string | null
          subject?: string | null
          text_body?: string | null
          to_email: string
        }
        Update: {
          attachments?: Json | null
          bcc?: string[] | null
          cc?: string[] | null
          created_at?: string | null
          from_email?: string
          from_name?: string | null
          headers?: Json | null
          html_body?: string | null
          id?: string
          linked_participant_id?: string | null
          linked_training_id?: string | null
          message_id?: string | null
          notes?: string | null
          processed_at?: string | null
          received_at?: string | null
          reply_to?: string | null
          status?: string | null
          subject?: string | null
          text_body?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_linked_participant_id_fkey"
            columns: ["linked_participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_linked_training_id_fkey"
            columns: ["linked_training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      indexation_queue: {
        Row: {
          created_at: string
          id: string
          operation: string
          processed_at: string | null
          source_id: string
          source_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation?: string
          processed_at?: string | null
          source_id: string
          source_type: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          processed_at?: string | null
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      learner_magic_links: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      lms_assignment_submissions: {
        Row: {
          comment: string | null
          feedback: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          learner_email: string
          lesson_id: string
          score: number | null
          status: string
          submitted_at: string
        }
        Insert: {
          comment?: string | null
          feedback?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          learner_email: string
          lesson_id: string
          score?: number | null
          status?: string
          submitted_at?: string
        }
        Update: {
          comment?: string | null
          feedback?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          learner_email?: string
          lesson_id?: string
          score?: number | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_assignment_submissions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_assignments: {
        Row: {
          allow_late_submission: boolean | null
          allowed_file_types: string[] | null
          course_id: string
          created_at: string
          due_after_days: number | null
          id: string
          instructions_html: string | null
          max_file_size_mb: number | null
          max_score: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean | null
          allowed_file_types?: string[] | null
          course_id: string
          created_at?: string
          due_after_days?: number | null
          id?: string
          instructions_html?: string | null
          max_file_size_mb?: number | null
          max_score?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean | null
          allowed_file_types?: string[] | null
          course_id?: string
          created_at?: string
          due_after_days?: number | null
          id?: string
          instructions_html?: string | null
          max_file_size_mb?: number | null
          max_score?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_badge_awards: {
        Row: {
          awarded_at: string
          badge_icon: string | null
          badge_id: string | null
          badge_name: string
          badge_type: string
          course_id: string
          id: string
          learner_email: string
          metadata: Json | null
        }
        Insert: {
          awarded_at?: string
          badge_icon?: string | null
          badge_id?: string | null
          badge_name: string
          badge_type?: string
          course_id: string
          id?: string
          learner_email: string
          metadata?: Json | null
        }
        Update: {
          awarded_at?: string
          badge_icon?: string | null
          badge_id?: string | null
          badge_name?: string
          badge_type?: string
          course_id?: string
          id?: string
          learner_email?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_badge_awards_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "lms_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_badge_awards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_badges: {
        Row: {
          badge_type: string
          created_at: string
          criteria: Json | null
          description: string | null
          icon_url: string | null
          id: string
          name: string
        }
        Insert: {
          badge_type?: string
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
        }
        Update: {
          badge_type?: string
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      lms_courses: {
        Row: {
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration_minutes: number | null
          formation_config_id: string | null
          id: string
          org_id: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          formation_config_id?: string | null
          id?: string
          org_id?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          formation_config_id?: string | null
          id?: string
          org_id?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_courses_formation_config_id_fkey"
            columns: ["formation_config_id"]
            isOneToOne: false
            referencedRelation: "formation_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_courses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_deposit_comments: {
        Row: {
          author_email: string
          content: string
          created_at: string
          deposit_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_email: string
          content: string
          created_at?: string
          deposit_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_email?: string
          content?: string
          created_at?: string
          deposit_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_deposit_comments_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "lms_work_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_deposit_feedback: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          deposit_id: string
          email_sent: boolean
          id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          deposit_id: string
          email_sent?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          deposit_id?: string
          email_sent?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_deposit_feedback_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "lms_work_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_enrollments: {
        Row: {
          completed_at: string | null
          completion_percentage: number | null
          course_id: string
          enrolled_at: string
          id: string
          learner_email: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          completion_percentage?: number | null
          course_id: string
          enrolled_at?: string
          id?: string
          learner_email: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          completion_percentage?: number | null
          course_id?: string
          enrolled_at?: string
          id?: string
          learner_email?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_forum_posts: {
        Row: {
          author_email: string
          content_html: string
          created_at: string
          forum_id: string
          id: string
          is_deleted: boolean | null
          is_pinned: boolean | null
          parent_post_id: string | null
          updated_at: string
        }
        Insert: {
          author_email: string
          content_html: string
          created_at?: string
          forum_id: string
          id?: string
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          parent_post_id?: string | null
          updated_at?: string
        }
        Update: {
          author_email?: string
          content_html?: string
          created_at?: string
          forum_id?: string
          id?: string
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          parent_post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_forum_posts_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "lms_forums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_forum_posts_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "lms_forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_forums: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_locked: boolean | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_forums_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_lesson_comments: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          learner_email: string
          learner_name: string | null
          lesson_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          id?: string
          learner_email: string
          learner_name?: string | null
          lesson_id: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          learner_email?: string
          learner_name?: string | null
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_lesson_comments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lesson_comments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_lessons: {
        Row: {
          assignment_id: string | null
          content_html: string | null
          created_at: string
          estimated_minutes: number | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          image_url: string | null
          is_mandatory: boolean | null
          lesson_type: string
          module_id: string
          position: number
          quiz_id: string | null
          title: string
          updated_at: string
          video_duration_seconds: number | null
          video_url: string | null
          work_deposit_config: Json
          work_deposit_enabled: boolean
        }
        Insert: {
          assignment_id?: string | null
          content_html?: string | null
          created_at?: string
          estimated_minutes?: number | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_mandatory?: boolean | null
          lesson_type?: string
          module_id: string
          position?: number
          quiz_id?: string | null
          title: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_url?: string | null
          work_deposit_config?: Json
          work_deposit_enabled?: boolean
        }
        Update: {
          assignment_id?: string | null
          content_html?: string | null
          created_at?: string
          estimated_minutes?: number | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_mandatory?: boolean | null
          lesson_type?: string
          module_id?: string
          position?: number
          quiz_id?: string | null
          title?: string
          updated_at?: string
          video_duration_seconds?: number | null
          video_url?: string | null
          work_deposit_config?: Json
          work_deposit_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lms_lessons_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "lms_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_lessons_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lms_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_prerequisite_gated: boolean | null
          position: number
          prerequisite_module_id: string | null
          title: string
          unlock_after_days: number | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_prerequisite_gated?: boolean | null
          position?: number
          prerequisite_module_id?: string | null
          title: string
          unlock_after_days?: number | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_prerequisite_gated?: boolean | null
          position?: number
          prerequisite_module_id?: string | null
          title?: string
          unlock_after_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_modules_prerequisite_module_id_fkey"
            columns: ["prerequisite_module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_page_views: {
        Row: {
          course_id: string
          id: string
          learner_email: string
          lesson_id: string
          viewed_at: string
        }
        Insert: {
          course_id: string
          id?: string
          learner_email: string
          lesson_id: string
          viewed_at?: string
        }
        Update: {
          course_id?: string
          id?: string
          learner_email?: string
          lesson_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_page_views_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_page_views_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          last_position: string | null
          learner_email: string
          lesson_id: string
          status: string
          time_spent_seconds: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          last_position?: string | null
          learner_email: string
          lesson_id: string
          status?: string
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          last_position?: string | null
          learner_email?: string
          lesson_id?: string
          status?: string
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_quiz_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          id: string
          learner_email: string
          max_score: number | null
          passed: boolean | null
          percentage: number | null
          quiz_id: string
          score: number | null
          started_at: string
          time_spent_seconds: number | null
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          learner_email: string
          max_score?: number | null
          passed?: boolean | null
          percentage?: number | null
          quiz_id: string
          score?: number | null
          started_at?: string
          time_spent_seconds?: number | null
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          learner_email?: string
          max_score?: number | null
          passed?: boolean | null
          percentage?: number | null
          quiz_id?: string
          score?: number | null
          started_at?: string
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lms_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_quiz_questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          explanation: string | null
          id: string
          media_url: string | null
          options: Json | null
          points: number | null
          position: number
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          media_url?: string | null
          options?: Json | null
          points?: number | null
          position?: number
          question_text: string
          question_type?: string
          quiz_id: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          media_url?: string | null
          options?: Json | null
          points?: number | null
          position?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "lms_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_quizzes: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          max_attempts: number | null
          passing_score: number | null
          show_correct_answers: boolean | null
          shuffle_questions: boolean | null
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          max_attempts?: number | null
          passing_score?: number | null
          show_correct_answers?: boolean | null
          shuffle_questions?: boolean | null
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          max_attempts?: number | null
          passing_score?: number | null
          show_correct_answers?: boolean | null
          shuffle_questions?: boolean | null
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_submissions: {
        Row: {
          assignment_id: string
          comment: string | null
          feedback_html: string | null
          file_name: string | null
          file_url: string | null
          id: string
          learner_email: string
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          feedback_html?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          learner_email: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          feedback_html?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          learner_email?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "lms_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          learner_email: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          learner_email: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          learner_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "lms_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_work_deposits: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          file_mime: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          learner_email: string
          lesson_id: string
          module_id: string | null
          pedagogical_status: string
          publication_status: string
          updated_at: string
          visibility: string
          visibility_changed_at: string | null
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          learner_email: string
          lesson_id: string
          module_id?: string | null
          pedagogical_status?: string
          publication_status?: string
          updated_at?: string
          visibility?: string
          visibility_changed_at?: string | null
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          learner_email?: string
          lesson_id?: string
          module_id?: string | null
          pedagogical_status?: string
          publication_status?: string
          updated_at?: string
          visibility?: string
          visibility_changed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_work_deposits_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_work_deposits_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lms_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_work_deposits_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_deliverable: boolean
          mime_type: string | null
          org_id: string | null
          position: number
          source_id: string
          source_type: string
          tags: string[] | null
          transcript: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          is_deliverable?: boolean
          mime_type?: string | null
          org_id?: string | null
          position?: number
          source_id: string
          source_type: string
          tags?: string[] | null
          transcript?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_deliverable?: boolean
          mime_type?: string | null
          org_id?: string | null
          position?: number
          source_id?: string
          source_type?: string
          tags?: string[] | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_actions: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          position: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          position?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          position?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_actions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_activities: {
        Row: {
          activity_date: string
          billable_amount: number | null
          created_at: string | null
          description: string
          duration: number
          duration_type: string
          google_event_id: string | null
          google_event_link: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          is_billed: boolean | null
          mission_id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          activity_date: string
          billable_amount?: number | null
          created_at?: string | null
          description: string
          duration?: number
          duration_type?: string
          google_event_id?: string | null
          google_event_link?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          is_billed?: boolean | null
          mission_id: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_date?: string
          billable_amount?: number | null
          created_at?: string | null
          description?: string
          duration?: number
          duration_type?: string
          google_event_id?: string | null
          google_event_link?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          is_billed?: boolean | null
          mission_id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_activities_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_primary: boolean
          language: string
          last_name: string | null
          mission_id: string
          phone: string | null
          position: number
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          language?: string
          last_name?: string | null
          mission_id: string
          phone?: string | null
          position?: number
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          language?: string
          last_name?: string | null
          mission_id?: string
          phone?: string | null
          position?: number
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_contacts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_deliverable: boolean
          mission_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_deliverable?: boolean
          mission_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_deliverable?: boolean
          mission_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_documents_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_email_drafts: {
        Row: {
          contact_email: string
          contact_name: string | null
          created_at: string
          email_type: string
          html_content: string
          id: string
          mission_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          contact_email: string
          contact_name?: string | null
          created_at?: string
          email_type: string
          html_content: string
          id?: string
          mission_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          email_type?: string
          html_content?: string
          id?: string
          mission_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_email_drafts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_media: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          mime_type: string | null
          mission_id: string
          position: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          mime_type?: string | null
          mission_id: string
          position?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          mission_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_media_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_page_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          position: number | null
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mission_pages: {
        Row: {
          activity_id: string | null
          content: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_expanded: boolean | null
          mission_id: string
          parent_page_id: string | null
          position: number
          title: string
          updated_at: string | null
        }
        Insert: {
          activity_id?: string | null
          content?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_expanded?: boolean | null
          mission_id: string
          parent_page_id?: string | null
          position?: number
          title?: string
          updated_at?: string | null
        }
        Update: {
          activity_id?: string | null
          content?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_expanded?: boolean | null
          mission_id?: string
          parent_page_id?: string | null
          position?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_pages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "mission_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_pages_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_pages_parent_page_id_fkey"
            columns: ["parent_page_id"]
            isOneToOne: false
            referencedRelation: "mission_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          assigned_to: string | null
          billed_amount: number | null
          client_contact: string | null
          client_name: string | null
          color: string | null
          consumed_amount: number | null
          created_at: string | null
          created_by: string | null
          daily_rate: number | null
          description: string | null
          emoji: string | null
          end_date: string | null
          hotel_booked: boolean | null
          id: string
          initial_amount: number | null
          language: string | null
          location: string | null
          org_id: string | null
          position: number
          start_date: string | null
          status: string
          tags: string[] | null
          testimonial_last_sent_at: string | null
          testimonial_status: string | null
          title: string
          total_amount: number | null
          total_days: number | null
          train_booked: boolean | null
          updated_at: string | null
          waiting_next_action_date: string | null
          waiting_next_action_text: string | null
        }
        Insert: {
          assigned_to?: string | null
          billed_amount?: number | null
          client_contact?: string | null
          client_name?: string | null
          color?: string | null
          consumed_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          daily_rate?: number | null
          description?: string | null
          emoji?: string | null
          end_date?: string | null
          hotel_booked?: boolean | null
          id?: string
          initial_amount?: number | null
          language?: string | null
          location?: string | null
          org_id?: string | null
          position?: number
          start_date?: string | null
          status?: string
          tags?: string[] | null
          testimonial_last_sent_at?: string | null
          testimonial_status?: string | null
          title: string
          total_amount?: number | null
          total_days?: number | null
          train_booked?: boolean | null
          updated_at?: string | null
          waiting_next_action_date?: string | null
          waiting_next_action_text?: string | null
        }
        Update: {
          assigned_to?: string | null
          billed_amount?: number | null
          client_contact?: string | null
          client_name?: string | null
          color?: string | null
          consumed_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          daily_rate?: number | null
          description?: string | null
          emoji?: string | null
          end_date?: string | null
          hotel_booked?: boolean | null
          id?: string
          initial_amount?: number | null
          language?: string | null
          location?: string | null
          org_id?: string | null
          position?: number
          start_date?: string | null
          status?: string
          tags?: string[] | null
          testimonial_last_sent_at?: string | null
          testimonial_status?: string | null
          title?: string
          total_amount?: number | null
          total_days?: number | null
          train_booked?: boolean | null
          updated_at?: string | null
          waiting_next_action_date?: string | null
          waiting_next_action_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      network_actions: {
        Row: {
          action_type: string
          contact_id: string
          created_at: string
          done_at: string | null
          id: string
          message_draft: string | null
          result: string | null
          scheduled_week: string | null
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          contact_id: string
          created_at?: string
          done_at?: string | null
          id?: string
          message_draft?: string | null
          result?: string | null
          scheduled_week?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          contact_id?: string
          created_at?: string
          done_at?: string | null
          id?: string
          message_draft?: string | null
          result?: string | null
          scheduled_week?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_actions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "network_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      network_contacts: {
        Row: {
          context: string | null
          created_at: string
          id: string
          last_contact_date: string | null
          linkedin_url: string | null
          name: string
          notes: string | null
          user_id: string
          warmth: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          last_contact_date?: string | null
          linkedin_url?: string | null
          name: string
          notes?: string | null
          user_id: string
          warmth?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          last_contact_date?: string | null
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          user_id?: string
          warmth?: string
        }
        Relationships: []
      }
      network_conversation: {
        Row: {
          content: string
          created_at: string
          id: string
          phase: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phase: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phase?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      network_interactions: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          interaction_type: string
          notes: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          interaction_type: string
          notes?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          interaction_type?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "network_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_cards: {
        Row: {
          card_id: string
          created_at: string
          display_order: number
          id: string
          newsletter_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          display_order?: number
          id?: string
          newsletter_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          display_order?: number
          id?: string
          newsletter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "content_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_cards_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          created_at: string
          id: string
          scheduled_date: string
          sent_at: string | null
          status: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          scheduled_date: string
          sent_at?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          scheduled_date?: string
          sent_at?: string | null
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      okr_check_ins: {
        Row: {
          action_items: string | null
          agenda: string | null
          check_in_date: string
          created_at: string
          created_by_email: string | null
          id: string
          new_confidence: number | null
          new_progress: number | null
          notes: string | null
          objective_id: string
          previous_confidence: number | null
          previous_progress: number | null
        }
        Insert: {
          action_items?: string | null
          agenda?: string | null
          check_in_date?: string
          created_at?: string
          created_by_email?: string | null
          id?: string
          new_confidence?: number | null
          new_progress?: number | null
          notes?: string | null
          objective_id: string
          previous_confidence?: number | null
          previous_progress?: number | null
        }
        Update: {
          action_items?: string | null
          agenda?: string | null
          check_in_date?: string
          created_at?: string
          created_by_email?: string | null
          id?: string
          new_confidence?: number | null
          new_progress?: number | null
          notes?: string | null
          objective_id?: string
          previous_confidence?: number | null
          previous_progress?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_check_ins_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_initiatives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key_result_id: string
          linked_mission_id: string | null
          linked_training_id: string | null
          position: number
          progress_percentage: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key_result_id: string
          linked_mission_id?: string | null
          linked_training_id?: string | null
          position?: number
          progress_percentage?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key_result_id?: string
          linked_mission_id?: string | null
          linked_training_id?: string | null
          position?: number
          progress_percentage?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_initiatives_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "okr_key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_key_results: {
        Row: {
          confidence_level: number
          created_at: string
          current_value: number
          description: string | null
          id: string
          objective_id: string
          position: number
          progress_percentage: number
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          objective_id: string
          position?: number
          progress_percentage?: number
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          objective_id?: string
          position?: number
          progress_percentage?: number
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_objectives: {
        Row: {
          cadence: string
          color: string
          confidence_level: number
          created_at: string
          created_by: string | null
          description: string | null
          favorite_position: number | null
          id: string
          is_favorite: boolean
          next_review_agenda: string | null
          next_review_date: string | null
          owner_email: string | null
          position: number
          progress_percentage: number
          status: string
          target_year: number
          time_target: string
          title: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          color?: string
          confidence_level?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          favorite_position?: number | null
          id?: string
          is_favorite?: boolean
          next_review_agenda?: string | null
          next_review_date?: string | null
          owner_email?: string | null
          position?: number
          progress_percentage?: number
          status?: string
          target_year?: number
          time_target?: string
          title: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          color?: string
          confidence_level?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          favorite_position?: number | null
          id?: string
          is_favorite?: boolean
          next_review_agenda?: string | null
          next_review_date?: string | null
          owner_email?: string | null
          position?: number
          progress_percentage?: number
          status?: string
          target_year?: number
          time_target?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      okr_participants: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          objective_id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          objective_id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          objective_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_participants_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okr_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          logo_url: string | null
          max_active_trainings: number | null
          max_participants: number | null
          name: string
          plan: string | null
          settings: Json | null
          slug: string
          storage_limit_mb: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          max_active_trainings?: number | null
          max_participants?: number | null
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
          storage_limit_mb?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          max_active_trainings?: number | null
          max_participants?: number | null
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
          storage_limit_mb?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      participant_files: {
        Row: {
          file_name: string
          file_url: string
          id: string
          participant_id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          participant_id: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          participant_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_files_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_evaluation_emails: {
        Row: {
          catalog_id: string | null
          created_at: string
          html_content: string
          id: string
          is_active: boolean
          subject: string
          updated_at: string
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          html_content: string
          id?: string
          is_active?: boolean
          subject: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          html_content?: string
          id?: string
          is_active?: boolean
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_evaluation_emails_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "formation_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          is_admin: boolean
          job_title: string | null
          last_name: string | null
          org_id: string | null
          updated_at: string
          user_id: string
          voice_description: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_admin?: boolean
          job_title?: string | null
          last_name?: string | null
          org_id?: string | null
          updated_at?: string
          user_id: string
          voice_description?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean
          job_title?: string | null
          last_name?: string | null
          org_id?: string | null
          updated_at?: string
          user_id?: string
          voice_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      program_files: {
        Row: {
          file_name: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      questionnaire_besoins: {
        Row: {
          besoins_accessibilite: string | null
          commentaires_libres: string | null
          competences_actuelles: string | null
          competences_visees: string | null
          consentement_rgpd: boolean
          contraintes_orga: string | null
          created_at: string
          date_consentement_rgpd: string | null
          date_derniere_sauvegarde: string | null
          date_envoi: string | null
          date_premiere_ouverture: string | null
          date_soumission: string | null
          date_validation_formateur: string | null
          email: string | null
          etat: string
          experience_details: string | null
          experience_sujet: string | null
          fonction: string | null
          id: string
          learndash_course_id: number | null
          lecture_programme: string | null
          lien_mission: string | null
          modalites_preferences: Json | null
          necessite_amenagement: boolean | null
          necessite_validation_formateur: boolean | null
          niveau_actuel: number | null
          niveau_motivation: number | null
          nom: string | null
          participant_id: string | null
          prenom: string | null
          prerequis_details: string | null
          prerequis_validation: string | null
          societe: string | null
          token: string
          training_id: string | null
          updated_at: string
        }
        Insert: {
          besoins_accessibilite?: string | null
          commentaires_libres?: string | null
          competences_actuelles?: string | null
          competences_visees?: string | null
          consentement_rgpd?: boolean
          contraintes_orga?: string | null
          created_at?: string
          date_consentement_rgpd?: string | null
          date_derniere_sauvegarde?: string | null
          date_envoi?: string | null
          date_premiere_ouverture?: string | null
          date_soumission?: string | null
          date_validation_formateur?: string | null
          email?: string | null
          etat?: string
          experience_details?: string | null
          experience_sujet?: string | null
          fonction?: string | null
          id?: string
          learndash_course_id?: number | null
          lecture_programme?: string | null
          lien_mission?: string | null
          modalites_preferences?: Json | null
          necessite_amenagement?: boolean | null
          necessite_validation_formateur?: boolean | null
          niveau_actuel?: number | null
          niveau_motivation?: number | null
          nom?: string | null
          participant_id?: string | null
          prenom?: string | null
          prerequis_details?: string | null
          prerequis_validation?: string | null
          societe?: string | null
          token: string
          training_id?: string | null
          updated_at?: string
        }
        Update: {
          besoins_accessibilite?: string | null
          commentaires_libres?: string | null
          competences_actuelles?: string | null
          competences_visees?: string | null
          consentement_rgpd?: boolean
          contraintes_orga?: string | null
          created_at?: string
          date_consentement_rgpd?: string | null
          date_derniere_sauvegarde?: string | null
          date_envoi?: string | null
          date_premiere_ouverture?: string | null
          date_soumission?: string | null
          date_validation_formateur?: string | null
          email?: string | null
          etat?: string
          experience_details?: string | null
          experience_sujet?: string | null
          fonction?: string | null
          id?: string
          learndash_course_id?: number | null
          lecture_programme?: string | null
          lien_mission?: string | null
          modalites_preferences?: Json | null
          necessite_amenagement?: boolean | null
          necessite_validation_formateur?: boolean | null
          niveau_actuel?: number | null
          niveau_motivation?: number | null
          nom?: string | null
          participant_id?: string | null
          prenom?: string | null
          prerequis_details?: string | null
          prerequis_validation?: string | null
          societe?: string | null
          token?: string
          training_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_besoins_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_besoins_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          questionnaire_id: string
          type_evenement: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          questionnaire_id: string
          type_evenement: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          questionnaire_id?: string
          type_evenement?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_events_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_besoins"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_settings: {
        Row: {
          ape_code: string
          bank_bic: string
          bank_iban: string
          bank_name: string
          company_address: string
          company_city: string
          company_email: string
          company_logo_url: string | null
          company_name: string
          company_phone: string
          company_zip: string
          created_at: string
          default_sale_type: string
          default_unit: string
          default_validity_days: number
          default_vat_rate: number
          early_payment_discount: string
          id: string
          insurance_coverage_zone: string
          insurance_name: string
          insurance_policy_number: string
          late_penalty_text: string
          legal_form: string
          next_sequence_number: number
          payment_methods: string
          payment_terms_days: number
          payment_terms_text: string
          quote_prefix: string
          rcs_city: string
          rcs_number: string
          recovery_indemnity_amount: number
          rights_transfer_clause: string
          rights_transfer_enabled: boolean
          rights_transfer_rate: number
          share_capital: string
          siren: string
          training_declaration_number: string
          updated_at: string
          vat_exempt: boolean
          vat_exempt_text: string
          vat_number: string
        }
        Insert: {
          ape_code?: string
          bank_bic?: string
          bank_iban?: string
          bank_name?: string
          company_address?: string
          company_city?: string
          company_email?: string
          company_logo_url?: string | null
          company_name?: string
          company_phone?: string
          company_zip?: string
          created_at?: string
          default_sale_type?: string
          default_unit?: string
          default_validity_days?: number
          default_vat_rate?: number
          early_payment_discount?: string
          id?: string
          insurance_coverage_zone?: string
          insurance_name?: string
          insurance_policy_number?: string
          late_penalty_text?: string
          legal_form?: string
          next_sequence_number?: number
          payment_methods?: string
          payment_terms_days?: number
          payment_terms_text?: string
          quote_prefix?: string
          rcs_city?: string
          rcs_number?: string
          recovery_indemnity_amount?: number
          rights_transfer_clause?: string
          rights_transfer_enabled?: boolean
          rights_transfer_rate?: number
          share_capital?: string
          siren?: string
          training_declaration_number?: string
          updated_at?: string
          vat_exempt?: boolean
          vat_exempt_text?: string
          vat_number?: string
        }
        Update: {
          ape_code?: string
          bank_bic?: string
          bank_iban?: string
          bank_name?: string
          company_address?: string
          company_city?: string
          company_email?: string
          company_logo_url?: string | null
          company_name?: string
          company_phone?: string
          company_zip?: string
          created_at?: string
          default_sale_type?: string
          default_unit?: string
          default_validity_days?: number
          default_vat_rate?: number
          early_payment_discount?: string
          id?: string
          insurance_coverage_zone?: string
          insurance_name?: string
          insurance_policy_number?: string
          late_penalty_text?: string
          legal_form?: string
          next_sequence_number?: number
          payment_methods?: string
          payment_terms_days?: number
          payment_terms_text?: string
          quote_prefix?: string
          rcs_city?: string
          rcs_number?: string
          recovery_indemnity_amount?: number
          rights_transfer_clause?: string
          rights_transfer_enabled?: boolean
          rights_transfer_rate?: number
          share_capital?: string
          siren?: string
          training_declaration_number?: string
          updated_at?: string
          vat_exempt?: boolean
          vat_exempt_text?: string
          vat_number?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          challenge_html: string | null
          client_address: string
          client_city: string
          client_company: string
          client_email: string | null
          client_signature_data: string | null
          client_signature_date: string | null
          client_signature_name: string | null
          client_siren: string | null
          client_vat_number: string | null
          client_zip: string
          created_at: string
          crm_card_id: string
          email_body: string | null
          email_sent_at: string | null
          email_subject: string | null
          expiry_date: string
          id: string
          instructions: string | null
          issue_date: string
          line_items: Json
          loom_script: string | null
          loom_url: string | null
          pdf_path: string | null
          quote_number: string
          rights_transfer_amount: number | null
          rights_transfer_enabled: boolean
          rights_transfer_rate: number | null
          sale_type: string
          status: string
          synthesis: string | null
          total_ht: number
          total_ttc: number
          total_vat: number
          travel_data: Json | null
          updated_at: string
          workflow_step: number | null
        }
        Insert: {
          challenge_html?: string | null
          client_address?: string
          client_city?: string
          client_company?: string
          client_email?: string | null
          client_signature_data?: string | null
          client_signature_date?: string | null
          client_signature_name?: string | null
          client_siren?: string | null
          client_vat_number?: string | null
          client_zip?: string
          created_at?: string
          crm_card_id: string
          email_body?: string | null
          email_sent_at?: string | null
          email_subject?: string | null
          expiry_date: string
          id?: string
          instructions?: string | null
          issue_date?: string
          line_items?: Json
          loom_script?: string | null
          loom_url?: string | null
          pdf_path?: string | null
          quote_number: string
          rights_transfer_amount?: number | null
          rights_transfer_enabled?: boolean
          rights_transfer_rate?: number | null
          sale_type?: string
          status?: string
          synthesis?: string | null
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          travel_data?: Json | null
          updated_at?: string
          workflow_step?: number | null
        }
        Update: {
          challenge_html?: string | null
          client_address?: string
          client_city?: string
          client_company?: string
          client_email?: string | null
          client_signature_data?: string | null
          client_signature_date?: string | null
          client_signature_name?: string | null
          client_siren?: string | null
          client_vat_number?: string | null
          client_zip?: string
          created_at?: string
          crm_card_id?: string
          email_body?: string | null
          email_sent_at?: string | null
          email_subject?: string | null
          expiry_date?: string
          id?: string
          instructions?: string | null
          issue_date?: string
          line_items?: Json
          loom_script?: string | null
          loom_url?: string | null
          pdf_path?: string | null
          quote_number?: string
          rights_transfer_amount?: number | null
          rights_transfer_enabled?: boolean
          rights_transfer_rate?: number | null
          sale_type?: string
          status?: string
          synthesis?: string | null
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          travel_data?: Json | null
          updated_at?: string
          workflow_step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_crm_card_id_fkey"
            columns: ["crm_card_id"]
            isOneToOne: false
            referencedRelation: "crm_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamations: {
        Row: {
          actions_decided: string | null
          ai_analysis: string | null
          ai_response_draft: string | null
          canal: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          date_reclamation: string | null
          description: string | null
          id: string
          mission_id: string | null
          problem_type: string | null
          qualiopi_summary: string | null
          response_date: string | null
          response_sent: string | null
          severity: string | null
          status: string
          token: string
          training_id: string | null
          updated_at: string
        }
        Insert: {
          actions_decided?: string | null
          ai_analysis?: string | null
          ai_response_draft?: string | null
          canal?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          date_reclamation?: string | null
          description?: string | null
          id?: string
          mission_id?: string | null
          problem_type?: string | null
          qualiopi_summary?: string | null
          response_date?: string | null
          response_sent?: string | null
          severity?: string | null
          status?: string
          token: string
          training_id?: string | null
          updated_at?: string
        }
        Update: {
          actions_decided?: string | null
          ai_analysis?: string | null
          ai_response_draft?: string | null
          canal?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          date_reclamation?: string | null
          description?: string | null
          id?: string
          mission_id?: string | null
          problem_type?: string | null
          qualiopi_summary?: string | null
          response_date?: string | null
          response_sent?: string | null
          severity?: string | null
          status?: string
          token?: string
          training_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamations_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reclamations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          assigned_to: string | null
          author_id: string
          card_id: string | null
          comment_type: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          mentioned_user_ids: string[] | null
          parent_comment_id: string | null
          proposed_correction: string | null
          resolved_at: string | null
          review_id: string | null
          status: string | null
        }
        Insert: {
          assigned_to?: string | null
          author_id: string
          card_id?: string | null
          comment_type?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          proposed_correction?: string | null
          resolved_at?: string | null
          review_id?: string | null
          status?: string | null
        }
        Update: {
          assigned_to?: string | null
          author_id?: string
          card_id?: string | null
          comment_type?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          mentioned_user_ids?: string[] | null
          parent_comment_id?: string | null
          proposed_correction?: string | null
          resolved_at?: string | null
          review_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "content_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "content_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          participant_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          training_id: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          participant_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          training_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          participant_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails_log: {
        Row: {
          cc_emails: string[] | null
          email_type: string | null
          html_content: string
          id: string
          participant_id: string | null
          recipient_email: string
          resend_email_id: string | null
          sent_at: string
          subject: string
          training_id: string | null
        }
        Insert: {
          cc_emails?: string[] | null
          email_type?: string | null
          html_content: string
          id?: string
          participant_id?: string | null
          recipient_email: string
          resend_email_id?: string | null
          sent_at?: string
          subject: string
          training_id?: string | null
        }
        Update: {
          cc_emails?: string[] | null
          email_type?: string | null
          html_content?: string
          id?: string
          participant_id?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          sent_at?: string
          subject?: string
          training_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_log_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_emails_log_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_start_notifications: {
        Row: {
          created_at: string
          id: string
          participants_count: number | null
          period: string
          signature_sent_at: string | null
          trainer_notified_at: string | null
          training_schedule_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participants_count?: number | null
          period: string
          signature_sent_at?: string | null
          trainer_notified_at?: string | null
          training_schedule_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participants_count?: number | null
          period?: string
          signature_sent_at?: string | null
          trainer_notified_at?: string | null
          training_schedule_id?: string
        }
        Relationships: []
      }
      sponsor_cold_evaluations: {
        Row: {
          attentes_satisfaites: string | null
          axes_amelioration: string | null
          commentaires_libres: string | null
          communication_satisfaisante: boolean | null
          company: string | null
          consent_publication: boolean | null
          created_at: string | null
          date_envoi: string | null
          date_premiere_ouverture: string | null
          date_soumission: string | null
          description_impact: string | null
          etat: string
          id: string
          impact_competences: string | null
          message_recommandation: string | null
          objectifs_atteints: string | null
          organisation_satisfaisante: boolean | null
          participant_id: string | null
          points_forts: string | null
          recommandation: string | null
          satisfaction_globale: number | null
          sponsor_email: string | null
          sponsor_name: string | null
          token: string
          training_end_date: string | null
          training_id: string
          training_name: string | null
          training_start_date: string | null
          updated_at: string | null
        }
        Insert: {
          attentes_satisfaites?: string | null
          axes_amelioration?: string | null
          commentaires_libres?: string | null
          communication_satisfaisante?: boolean | null
          company?: string | null
          consent_publication?: boolean | null
          created_at?: string | null
          date_envoi?: string | null
          date_premiere_ouverture?: string | null
          date_soumission?: string | null
          description_impact?: string | null
          etat?: string
          id?: string
          impact_competences?: string | null
          message_recommandation?: string | null
          objectifs_atteints?: string | null
          organisation_satisfaisante?: boolean | null
          participant_id?: string | null
          points_forts?: string | null
          recommandation?: string | null
          satisfaction_globale?: number | null
          sponsor_email?: string | null
          sponsor_name?: string | null
          token: string
          training_end_date?: string | null
          training_id: string
          training_name?: string | null
          training_start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          attentes_satisfaites?: string | null
          axes_amelioration?: string | null
          commentaires_libres?: string | null
          communication_satisfaisante?: boolean | null
          company?: string | null
          consent_publication?: boolean | null
          created_at?: string | null
          date_envoi?: string | null
          date_premiere_ouverture?: string | null
          date_soumission?: string | null
          description_impact?: string | null
          etat?: string
          id?: string
          impact_competences?: string | null
          message_recommandation?: string | null
          objectifs_atteints?: string | null
          organisation_satisfaisante?: boolean | null
          participant_id?: string | null
          points_forts?: string | null
          recommandation?: string | null
          satisfaction_globale?: number | null
          sponsor_email?: string | null
          sponsor_name?: string | null
          token?: string
          training_end_date?: string | null
          training_id?: string
          training_name?: string | null
          training_start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_cold_evaluations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_cold_evaluations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_appreciations: {
        Row: {
          axes_amelioration: string | null
          commentaires: string | null
          created_at: string
          created_by: string | null
          date_envoi: string | null
          date_reception: string | null
          id: string
          points_forts: string | null
          satisfaction_globale: number | null
          stakeholder_email: string | null
          stakeholder_name: string
          stakeholder_type: string
          status: string
          token: string
          training_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          axes_amelioration?: string | null
          commentaires?: string | null
          created_at?: string
          created_by?: string | null
          date_envoi?: string | null
          date_reception?: string | null
          id?: string
          points_forts?: string | null
          satisfaction_globale?: number | null
          stakeholder_email?: string | null
          stakeholder_name: string
          stakeholder_type: string
          status?: string
          token: string
          training_id?: string | null
          updated_at?: string
          year?: number
        }
        Update: {
          axes_amelioration?: string | null
          commentaires?: string | null
          created_at?: string
          created_by?: string | null
          date_envoi?: string | null
          date_reception?: string | null
          id?: string
          points_forts?: string | null
          satisfaction_globale?: number | null
          stakeholder_email?: string | null
          stakeholder_name?: string
          stakeholder_type?: string
          status?: string
          token?: string
          training_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_appreciations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      supertilt_actions: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          is_completed: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_analysis: Json | null
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          page_url: string | null
          position: number
          priority: string
          resolution_notes: string | null
          resolved_at: string | null
          screenshot_url: string | null
          status: string
          submitted_by: string | null
          submitted_by_email: string | null
          ticket_number: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          position?: number
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_email?: string | null
          ticket_number: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          position?: number
          priority?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_email?: string | null
          ticket_number?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      trainer_attendance_signatures: {
        Row: {
          created_at: string | null
          id: string
          period: string
          schedule_date: string
          signature_data: string | null
          signed_at: string | null
          trainer_name: string | null
          training_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          period: string
          schedule_date: string
          signature_data?: string | null
          signed_at?: string | null
          trainer_name?: string | null
          training_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          period?: string
          schedule_date?: string
          signature_data?: string | null
          signed_at?: string | null
          trainer_name?: string | null
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_attendance_signatures_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          file_url: string
          id?: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_documents_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_evaluations: {
        Row: {
          axes_amelioration: string | null
          commentaires: string | null
          created_at: string
          created_by: string | null
          date_submitted: string | null
          email_sent_at: string | null
          id: string
          points_forts: string | null
          satisfaction_globale: number | null
          status: string
          token: string
          trainer_email: string | null
          trainer_name: string
          training_id: string
          updated_at: string
        }
        Insert: {
          axes_amelioration?: string | null
          commentaires?: string | null
          created_at?: string
          created_by?: string | null
          date_submitted?: string | null
          email_sent_at?: string | null
          id?: string
          points_forts?: string | null
          satisfaction_globale?: number | null
          status?: string
          token: string
          trainer_email?: string | null
          trainer_name: string
          training_id: string
          updated_at?: string
        }
        Update: {
          axes_amelioration?: string | null
          commentaires?: string | null
          created_at?: string
          created_by?: string | null
          date_submitted?: string | null
          email_sent_at?: string | null
          id?: string
          points_forts?: string | null
          satisfaction_globale?: number | null
          status?: string
          token?: string
          trainer_email?: string | null
          trainer_name?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_evaluations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_training_adequacy: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          trainer_id: string
          training_id: string
          validated_at: string
          validated_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          trainer_id: string
          training_id: string
          validated_at?: string
          validated_by: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          trainer_id?: string
          training_id?: string
          validated_at?: string
          validated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_training_adequacy_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_training_adequacy_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          competences: string[] | null
          created_at: string
          cv_url: string | null
          diplomes_certifications: string | null
          email: string
          first_name: string
          formations_suivies: Json | null
          id: string
          is_default: boolean | null
          last_name: string
          linkedin_url: string | null
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          competences?: string[] | null
          created_at?: string
          cv_url?: string | null
          diplomes_certifications?: string | null
          email: string
          first_name: string
          formations_suivies?: Json | null
          id?: string
          is_default?: boolean | null
          last_name: string
          linkedin_url?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          competences?: string[] | null
          created_at?: string
          cv_url?: string | null
          diplomes_certifications?: string | null
          email?: string
          first_name?: string
          formations_suivies?: Json | null
          id?: string
          is_default?: boolean | null
          last_name?: string
          linkedin_url?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      training_actions: {
        Row: {
          assigned_user_email: string
          assigned_user_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          reminder_sent_at: string | null
          status: string
          training_id: string
        }
        Insert: {
          assigned_user_email: string
          assigned_user_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          reminder_sent_at?: string | null
          status?: string
          training_id: string
        }
        Update: {
          assigned_user_email?: string
          assigned_user_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          reminder_sent_at?: string | null
          status?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_actions_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_coaching_slots: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          meeting_url: string | null
          notes: string | null
          participant_id: string | null
          scheduled_at: string
          status: string
          training_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          notes?: string | null
          participant_id?: string | null
          scheduled_at: string
          status?: string
          training_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          notes?: string | null
          participant_id?: string | null
          scheduled_at?: string
          status?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_coaching_slots_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_coaching_slots_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          training_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          training_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          training_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_documents_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_evaluations: {
        Row: {
          amelioration_suggeree: string | null
          appreciation_generale: number | null
          appreciations_prises_en_compte: string | null
          certificate_url: string | null
          company: string | null
          conditions_info_satisfaisantes: boolean | null
          consent_publication: boolean | null
          created_at: string
          date_envoi: string | null
          date_premiere_ouverture: string | null
          date_soumission: string | null
          delai_application: string | null
          email: string | null
          equilibre_theorie_pratique: string | null
          etat: string
          first_name: string | null
          formation_adaptee_public: boolean | null
          freins_application: string | null
          id: string
          last_name: string | null
          learndash_course_id: number | null
          message_recommandation: string | null
          objectif_prioritaire: string | null
          objectifs_evaluation: Json | null
          participant_id: string | null
          qualification_intervenant_adequate: boolean | null
          recommandation: string | null
          remarques_libres: string | null
          rythme: string | null
          token: string
          training_id: string | null
          updated_at: string
          woocommerce_product_id: number | null
        }
        Insert: {
          amelioration_suggeree?: string | null
          appreciation_generale?: number | null
          appreciations_prises_en_compte?: string | null
          certificate_url?: string | null
          company?: string | null
          conditions_info_satisfaisantes?: boolean | null
          consent_publication?: boolean | null
          created_at?: string
          date_envoi?: string | null
          date_premiere_ouverture?: string | null
          date_soumission?: string | null
          delai_application?: string | null
          email?: string | null
          equilibre_theorie_pratique?: string | null
          etat?: string
          first_name?: string | null
          formation_adaptee_public?: boolean | null
          freins_application?: string | null
          id?: string
          last_name?: string | null
          learndash_course_id?: number | null
          message_recommandation?: string | null
          objectif_prioritaire?: string | null
          objectifs_evaluation?: Json | null
          participant_id?: string | null
          qualification_intervenant_adequate?: boolean | null
          recommandation?: string | null
          remarques_libres?: string | null
          rythme?: string | null
          token: string
          training_id?: string | null
          updated_at?: string
          woocommerce_product_id?: number | null
        }
        Update: {
          amelioration_suggeree?: string | null
          appreciation_generale?: number | null
          appreciations_prises_en_compte?: string | null
          certificate_url?: string | null
          company?: string | null
          conditions_info_satisfaisantes?: boolean | null
          consent_publication?: boolean | null
          created_at?: string
          date_envoi?: string | null
          date_premiere_ouverture?: string | null
          date_soumission?: string | null
          delai_application?: string | null
          email?: string | null
          equilibre_theorie_pratique?: string | null
          etat?: string
          first_name?: string | null
          formation_adaptee_public?: boolean | null
          freins_application?: string | null
          id?: string
          last_name?: string | null
          learndash_course_id?: number | null
          message_recommandation?: string | null
          objectif_prioritaire?: string | null
          objectifs_evaluation?: Json | null
          participant_id?: string | null
          qualification_intervenant_adequate?: boolean | null
          recommandation?: string | null
          remarques_libres?: string | null
          rythme?: string | null
          token?: string
          training_id?: string | null
          updated_at?: string
          woocommerce_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_evaluations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_evaluations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_live_meetings: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          email_content: string | null
          id: string
          meeting_url: string | null
          run_notes: string | null
          scheduled_at: string
          status: string
          title: string
          training_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          email_content?: string | null
          id?: string
          meeting_url?: string | null
          run_notes?: string | null
          scheduled_at: string
          status?: string
          title: string
          training_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          email_content?: string | null
          id?: string
          meeting_url?: string | null
          run_notes?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_live_meetings_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_media: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          mime_type: string | null
          position: number
          training_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          mime_type?: string | null
          position?: number
          training_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          position?: number
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_media_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_participants: {
        Row: {
          added_at: string
          coaching_deadline: string | null
          coaching_sessions_completed: number
          coaching_sessions_total: number
          company: string | null
          convention_document_id: string | null
          convention_file_url: string | null
          elearning_duration: number | null
          email: string
          financeur_name: string | null
          financeur_same_as_sponsor: boolean | null
          financeur_url: string | null
          first_name: string | null
          formula: string | null
          formula_id: string | null
          id: string
          invoice_file_url: string | null
          last_name: string | null
          needs_survey_sent_at: string | null
          needs_survey_status: string
          needs_survey_token: string | null
          notes: string | null
          payment_mode: string
          signed_convention_url: string | null
          sold_price_ht: number | null
          sponsor_email: string | null
          sponsor_first_name: string | null
          sponsor_last_name: string | null
          training_id: string
        }
        Insert: {
          added_at?: string
          coaching_deadline?: string | null
          coaching_sessions_completed?: number
          coaching_sessions_total?: number
          company?: string | null
          convention_document_id?: string | null
          convention_file_url?: string | null
          elearning_duration?: number | null
          email: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean | null
          financeur_url?: string | null
          first_name?: string | null
          formula?: string | null
          formula_id?: string | null
          id?: string
          invoice_file_url?: string | null
          last_name?: string | null
          needs_survey_sent_at?: string | null
          needs_survey_status?: string
          needs_survey_token?: string | null
          notes?: string | null
          payment_mode?: string
          signed_convention_url?: string | null
          sold_price_ht?: number | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_last_name?: string | null
          training_id: string
        }
        Update: {
          added_at?: string
          coaching_deadline?: string | null
          coaching_sessions_completed?: number
          coaching_sessions_total?: number
          company?: string | null
          convention_document_id?: string | null
          convention_file_url?: string | null
          elearning_duration?: number | null
          email?: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean | null
          financeur_url?: string | null
          first_name?: string | null
          formula?: string | null
          formula_id?: string | null
          id?: string
          invoice_file_url?: string | null
          last_name?: string | null
          needs_survey_sent_at?: string | null
          needs_survey_status?: string
          needs_survey_token?: string | null
          notes?: string | null
          payment_mode?: string
          signed_convention_url?: string | null
          sold_price_ht?: number | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_last_name?: string | null
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_participants_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formation_formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_participants_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_schedules: {
        Row: {
          created_at: string
          day_date: string
          end_time: string
          id: string
          start_time: string
          training_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          end_time: string
          id?: string
          start_time: string
          training_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          end_time?: string
          id?: string
          start_time?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_schedules_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      training_support_imports: {
        Row: {
          assigned_section_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          mime_type: string | null
          support_id: string
        }
        Insert: {
          assigned_section_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          mime_type?: string | null
          support_id: string
        }
        Update: {
          assigned_section_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          support_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_support_imports_assigned_section_id_fkey"
            columns: ["assigned_section_id"]
            isOneToOne: false
            referencedRelation: "training_support_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_support_imports_support_id_fkey"
            columns: ["support_id"]
            isOneToOne: false
            referencedRelation: "training_supports"
            referencedColumns: ["id"]
          },
        ]
      }
      training_support_media: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          mime_type: string | null
          position: number
          section_id: string
          support_id: string
          transcript: string | null
          transcript_summary: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          mime_type?: string | null
          position?: number
          section_id: string
          support_id: string
          transcript?: string | null
          transcript_summary?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          position?: number
          section_id?: string
          support_id?: string
          transcript?: string | null
          transcript_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_support_media_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "training_support_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_support_media_support_id_fkey"
            columns: ["support_id"]
            isOneToOne: false
            referencedRelation: "training_supports"
            referencedColumns: ["id"]
          },
        ]
      }
      training_support_sections: {
        Row: {
          content: string
          created_at: string
          id: string
          is_resources: boolean
          position: number
          support_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_resources?: boolean
          position?: number
          support_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_resources?: boolean
          position?: number
          support_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_support_sections_support_id_fkey"
            columns: ["support_id"]
            isOneToOne: false
            referencedRelation: "training_supports"
            referencedColumns: ["id"]
          },
        ]
      }
      training_support_template_sections: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          template_id: string
          title: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          template_id: string
          title?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_support_template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "training_support_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      training_support_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_supports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          template_id: string | null
          title: string
          training_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          template_id?: string | null
          title?: string
          training_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          template_id?: string | null
          title?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_supports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "training_support_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_supports_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: true
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          assigned_to: string | null
          attendance_sheets_urls: string[] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          catalog_id: string | null
          client_address: string | null
          client_name: string
          convention_file_url: string | null
          created_at: string
          created_by: string
          elearning_access_email_content: string | null
          elearning_duration: number | null
          end_date: string | null
          equipment_ready: boolean
          evaluation_link: string
          financeur_name: string | null
          financeur_same_as_sponsor: boolean
          financeur_url: string | null
          format_formation: string | null
          funder_appreciation: string | null
          funder_appreciation_date: string | null
          hotel_booked: boolean | null
          id: string
          invoice_file_url: string | null
          is_cancelled: boolean | null
          location: string
          logistics_email_sent_at: string | null
          logistics_email_sent_to: string | null
          max_participants: number | null
          notes: string | null
          objectives: string[] | null
          org_id: string | null
          participants_formal_address: boolean
          prerequisites: string[] | null
          private_group_url: string | null
          program_file_url: string | null
          restaurant_booked: boolean | null
          room_rental_booked: boolean | null
          session_format: string | null
          session_type: string | null
          signed_convention_urls: string[] | null
          sold_price_ht: number | null
          sponsor_email: string | null
          sponsor_first_name: string | null
          sponsor_formal_address: boolean
          sponsor_last_name: string | null
          start_date: string | null
          supertilt_link: string | null
          supports_file_name: string | null
          supports_lms_course_id: string | null
          supports_type: string
          supports_url: string | null
          train_booked: boolean | null
          trainer_id: string | null
          trainer_name: string
          training_name: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attendance_sheets_urls?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          catalog_id?: string | null
          client_address?: string | null
          client_name?: string
          convention_file_url?: string | null
          created_at?: string
          created_by: string
          elearning_access_email_content?: string | null
          elearning_duration?: number | null
          end_date?: string | null
          equipment_ready?: boolean
          evaluation_link: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean
          financeur_url?: string | null
          format_formation?: string | null
          funder_appreciation?: string | null
          funder_appreciation_date?: string | null
          hotel_booked?: boolean | null
          id?: string
          invoice_file_url?: string | null
          is_cancelled?: boolean | null
          location: string
          logistics_email_sent_at?: string | null
          logistics_email_sent_to?: string | null
          max_participants?: number | null
          notes?: string | null
          objectives?: string[] | null
          org_id?: string | null
          participants_formal_address?: boolean
          prerequisites?: string[] | null
          private_group_url?: string | null
          program_file_url?: string | null
          restaurant_booked?: boolean | null
          room_rental_booked?: boolean | null
          session_format?: string | null
          session_type?: string | null
          signed_convention_urls?: string[] | null
          sold_price_ht?: number | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_formal_address?: boolean
          sponsor_last_name?: string | null
          start_date?: string | null
          supertilt_link?: string | null
          supports_file_name?: string | null
          supports_lms_course_id?: string | null
          supports_type?: string
          supports_url?: string | null
          train_booked?: boolean | null
          trainer_id?: string | null
          trainer_name?: string
          training_name: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attendance_sheets_urls?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          catalog_id?: string | null
          client_address?: string | null
          client_name?: string
          convention_file_url?: string | null
          created_at?: string
          created_by?: string
          elearning_access_email_content?: string | null
          elearning_duration?: number | null
          end_date?: string | null
          equipment_ready?: boolean
          evaluation_link?: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean
          financeur_url?: string | null
          format_formation?: string | null
          funder_appreciation?: string | null
          funder_appreciation_date?: string | null
          hotel_booked?: boolean | null
          id?: string
          invoice_file_url?: string | null
          is_cancelled?: boolean | null
          location?: string
          logistics_email_sent_at?: string | null
          logistics_email_sent_to?: string | null
          max_participants?: number | null
          notes?: string | null
          objectives?: string[] | null
          org_id?: string | null
          participants_formal_address?: boolean
          prerequisites?: string[] | null
          private_group_url?: string | null
          program_file_url?: string | null
          restaurant_booked?: boolean | null
          room_rental_booked?: boolean | null
          session_format?: string | null
          session_type?: string | null
          signed_convention_urls?: string[] | null
          sold_price_ht?: number | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_formal_address?: boolean
          sponsor_last_name?: string | null
          start_date?: string | null
          supertilt_link?: string | null
          supports_file_name?: string | null
          supports_lms_course_id?: string | null
          supports_type?: string
          supports_url?: string | null
          train_booked?: boolean | null
          trainer_id?: string | null
          trainer_name?: string
          training_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "formation_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_supports_lms_course_id_fkey"
            columns: ["supports_lms_course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          created_at: string
          emails_sent: number
          id: string
          org_id: string
          participants_count: number
          period_start: string
          storage_used_mb: number
          trainings_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emails_sent?: number
          id?: string
          org_id: string
          participants_count?: number
          period_start: string
          storage_used_mb?: number
          trainings_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emails_sent?: number
          id?: string
          org_id?: string
          participants_count?: number
          period_start?: string
          storage_used_mb?: number
          trainings_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      user_positioning: {
        Row: {
          cooling_thresholds: Json | null
          id: string
          key_skills: string[] | null
          onboarding_completed_at: string | null
          pitch_one_liner: string | null
          target_client: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cooling_thresholds?: Json | null
          id?: string
          key_skills?: string[] | null
          onboarding_completed_at?: string | null
          pitch_one_liner?: string | null
          target_client?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cooling_thresholds?: Json | null
          id?: string
          key_skills?: string[] | null
          onboarding_completed_at?: string | null
          pitch_one_liner?: string | null
          target_client?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_security_metadata: {
        Row: {
          created_at: string
          id: string
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_clusters: {
        Row: {
          created_at: string
          id: string
          slack_posted_at: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slack_posted_at?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slack_posted_at?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      watch_digests: {
        Row: {
          created_at: string
          id: string
          item_ids: string[]
          slack_posted_at: string | null
          summary: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_ids?: string[]
          slack_posted_at?: string | null
          summary?: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          item_ids?: string[]
          slack_posted_at?: string | null
          summary?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      watch_items: {
        Row: {
          assigned_user_ids: string[]
          body: string
          cluster_id: string | null
          content_type: string
          created_at: string
          created_by: string | null
          duplicate_of: string | null
          embedding: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_duplicate: boolean
          is_shared: boolean
          mime_type: string | null
          relevance_score: number
          source_url: string | null
          tags: string[]
          title: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_ids?: string[]
          body?: string
          cluster_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          duplicate_of?: string | null
          embedding?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_duplicate?: boolean
          is_shared?: boolean
          mime_type?: string | null
          relevance_score?: number
          source_url?: string | null
          tags?: string[]
          title?: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_ids?: string[]
          body?: string
          cluster_id?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          duplicate_of?: string | null
          embedding?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_duplicate?: boolean
          is_shared?: boolean
          mime_type?: string | null
          relevance_score?: number
          source_url?: string | null
          tags?: string[]
          title?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_watch_items_cluster"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "watch_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_items_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "watch_items"
            referencedColumns: ["id"]
          },
        ]
      }
      woocommerce_coupons: {
        Row: {
          amount: number | null
          catalog_id: string | null
          coupon_code: string
          created_at: string | null
          discount_type: string | null
          email_restriction: string | null
          error_message: string | null
          expiry_date: string | null
          id: string
          participant_id: string
          status: string | null
          training_id: string
          usage_limit: number | null
          woocommerce_coupon_id: number | null
          woocommerce_product_id: number | null
        }
        Insert: {
          amount?: number | null
          catalog_id?: string | null
          coupon_code: string
          created_at?: string | null
          discount_type?: string | null
          email_restriction?: string | null
          error_message?: string | null
          expiry_date?: string | null
          id?: string
          participant_id: string
          status?: string | null
          training_id: string
          usage_limit?: number | null
          woocommerce_coupon_id?: number | null
          woocommerce_product_id?: number | null
        }
        Update: {
          amount?: number | null
          catalog_id?: string | null
          coupon_code?: string
          created_at?: string | null
          discount_type?: string | null
          email_restriction?: string | null
          error_message?: string | null
          expiry_date?: string | null
          id?: string
          participant_id?: string
          status?: string | null
          training_id?: string
          usage_limit?: number | null
          woocommerce_coupon_id?: number | null
          woocommerce_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_coupons_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "training_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "woocommerce_coupons_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_cron_timezones: { Args: never; Returns: Json }
      agent_sql_query:
        | { Args: { query_text: string }; Returns: Json }
        | {
            Args: {
              p_explanation?: string
              p_user_id?: string
              query_text: string
            }
            Returns: Json
          }
      check_formulaire_rate_limit: {
        Args: {
          p_ip_address: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      cleanup_agent_embedding_cache: { Args: never; Returns: number }
      decay_watch_relevance: { Args: never; Returns: undefined }
      decrypt_token: {
        Args: { encrypted_token: string; encryption_key: string }
        Returns: string
      }
      encrypt_token: {
        Args: { encryption_key: string; plain_token: string }
        Returns: string
      }
      get_agent_allowed_tables: { Args: never; Returns: string[] }
      get_agent_schema_prompt: { Args: never; Returns: string }
      get_app_setting_public: { Args: { p_key: string }; Returns: string }
      get_attendance_by_token: { Args: { p_token: string }; Returns: Json }
      get_convention_signature_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_cron_status: { Args: never; Returns: Json }
      get_db_size: { Args: never; Returns: Json }
      get_devis_signature_by_token: { Args: { p_token: string }; Returns: Json }
      get_evaluation_by_token: {
        Args: { p_token: string }
        Returns: {
          amelioration_suggeree: string | null
          appreciation_generale: number | null
          appreciations_prises_en_compte: string | null
          certificate_url: string | null
          company: string | null
          conditions_info_satisfaisantes: boolean | null
          consent_publication: boolean | null
          created_at: string
          date_envoi: string | null
          date_premiere_ouverture: string | null
          date_soumission: string | null
          delai_application: string | null
          email: string | null
          equilibre_theorie_pratique: string | null
          etat: string
          first_name: string | null
          formation_adaptee_public: boolean | null
          freins_application: string | null
          id: string
          last_name: string | null
          learndash_course_id: number | null
          message_recommandation: string | null
          objectif_prioritaire: string | null
          objectifs_evaluation: Json | null
          participant_id: string | null
          qualification_intervenant_adequate: boolean | null
          recommandation: string | null
          remarques_libres: string | null
          rythme: string | null
          token: string
          training_id: string | null
          updated_at: string
          woocommerce_product_id: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "training_evaluations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_learner_email: { Args: never; Returns: string }
      get_learner_portal_data: { Args: { p_email: string }; Returns: Json }
      get_mission_actions_public: {
        Args: { p_mission_id: string }
        Returns: Json
      }
      get_mission_activities_public: {
        Args: { p_mission_id: string }
        Returns: Json
      }
      get_mission_documents_public: {
        Args: { p_mission_id: string }
        Returns: Json
      }
      get_mission_media_public: {
        Args: { p_mission_id: string }
        Returns: Json
      }
      get_mission_public_summary: {
        Args: { p_mission_id: string }
        Returns: Json
      }
      get_participant_public_info: {
        Args: { p_participant_id: string }
        Returns: Json
      }
      get_previous_trainer_evaluations: {
        Args: { p_exclude_id: string; p_trainer_email: string }
        Returns: Json
      }
      get_public_contact: {
        Args: never
        Returns: {
          email: string
          name: string
        }[]
      }
      get_questionnaire_by_token: {
        Args: { p_token: string }
        Returns: {
          besoins_accessibilite: string | null
          commentaires_libres: string | null
          competences_actuelles: string | null
          competences_visees: string | null
          consentement_rgpd: boolean
          contraintes_orga: string | null
          created_at: string
          date_consentement_rgpd: string | null
          date_derniere_sauvegarde: string | null
          date_envoi: string | null
          date_premiere_ouverture: string | null
          date_soumission: string | null
          date_validation_formateur: string | null
          email: string | null
          etat: string
          experience_details: string | null
          experience_sujet: string | null
          fonction: string | null
          id: string
          learndash_course_id: number | null
          lecture_programme: string | null
          lien_mission: string | null
          modalites_preferences: Json | null
          necessite_amenagement: boolean | null
          necessite_validation_formateur: boolean | null
          niveau_actuel: number | null
          niveau_motivation: number | null
          nom: string | null
          participant_id: string | null
          prenom: string | null
          prerequis_details: string | null
          prerequis_validation: string | null
          societe: string | null
          token: string
          training_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "questionnaire_besoins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_reclamation_by_token: { Args: { p_token: string }; Returns: Json }
      get_sponsor_evaluation_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_stakeholder_appreciation_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_trainer_evaluation_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_trainer_public: { Args: { p_trainer_id: string }; Returns: Json }
      get_training_participants_list: {
        Args: { p_training_id: string }
        Returns: Json
      }
      get_training_public_info: {
        Args: { p_training_id: string }
        Returns: Json
      }
      get_training_schedule_for_date: {
        Args: { p_day_date: string; p_training_id: string }
        Returns: Json
      }
      get_training_schedules_public: {
        Args: { p_training_id: string }
        Returns: Json
      }
      get_training_summary_info: {
        Args: { p_training_id: string }
        Returns: Json
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_crm_access: { Args: { _user_id: string }; Returns: boolean }
      has_module_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      increment_agent_tokens: {
        Args: {
          p_conversation_id: string
          p_input_tokens: number
          p_messages: Json
          p_output_tokens: number
        }
        Returns: undefined
      }
      insert_questionnaire_event: {
        Args: {
          p_metadata?: Json
          p_questionnaire_id: string
          p_type_evenement: string
        }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_feature_enabled: { Args: { _flag: string }; Returns: boolean }
      is_signup_allowed: { Args: { p_email: string }; Returns: boolean }
      lms_learner_is_enrolled: {
        Args: { _course_id: string }
        Returns: boolean
      }
      mark_attendance_opened: {
        Args: { p_timestamp: string; p_token: string }
        Returns: undefined
      }
      mark_convention_opened: {
        Args: { p_timestamp: string; p_token: string }
        Returns: undefined
      }
      mark_devis_opened: {
        Args: { p_timestamp: string; p_token: string }
        Returns: undefined
      }
      match_documents: {
        Args: {
          filter_source_types?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          metadata: Json
          similarity: number
          source_date: string
          source_id: string
          source_title: string
          source_type: string
        }[]
      }
      match_watch_items: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
          title: string
        }[]
      }
      monitor_cron_failures: { Args: never; Returns: Json }
      monitor_missing_evaluation_reminders: { Args: never; Returns: Json }
      recompute_opportunity_estimated_value: {
        Args: { p_card_id: string }
        Returns: number
      }
      register_formulaire_orphan: {
        Args: {
          p_course_id: number
          p_email: string
          p_first_name: string
          p_form_type: string
          p_last_name: string
        }
        Returns: Json
      }
      resolve_formulaire_token: {
        Args: { p_course_id: number; p_email: string; p_form_type: string }
        Returns: Json
      }
      update_api_key_last_used: { Args: { key_id: string }; Returns: undefined }
      update_evaluation_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: undefined
      }
      update_participant_after_questionnaire: {
        Args: { p_company?: string; p_token: string }
        Returns: undefined
      }
      update_questionnaire_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: undefined
      }
      update_reclamation_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: undefined
      }
      update_sponsor_evaluation_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: undefined
      }
      update_stakeholder_appreciation_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: undefined
      }
      update_trainer_evaluation_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: undefined
      }
      upsert_profile: {
        Args: { p_display_name?: string; p_email: string; p_user_id: string }
        Returns: undefined
      }
      validate_learner_token: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      app_module:
        | "micro_devis"
        | "formations"
        | "evaluations"
        | "certificates"
        | "ameliorations"
        | "historique"
        | "contenu"
        | "besoins"
        | "parametres"
        | "events"
        | "emails"
        | "statistiques"
        | "crm"
        | "missions"
        | "okr"
        | "medias"
        | "monitoring"
        | "arena"
        | "reclamations"
        | "appreciations"
        | "lms"
        | "reseau"
        | "screenshots"
        | "veille"
        | "web_analytics"
        | "supertilt"
        | "support"
        | "catalogue"
      notification_type:
        | "review_requested"
        | "comment_added"
        | "review_status_changed"
      review_status: "pending" | "in_review" | "approved" | "changes_requested"
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
      app_module: [
        "micro_devis",
        "formations",
        "evaluations",
        "certificates",
        "ameliorations",
        "historique",
        "contenu",
        "besoins",
        "parametres",
        "events",
        "emails",
        "statistiques",
        "crm",
        "missions",
        "okr",
        "medias",
        "monitoring",
        "arena",
        "reclamations",
        "appreciations",
        "lms",
        "reseau",
        "screenshots",
        "veille",
        "web_analytics",
        "supertilt",
        "support",
        "catalogue",
      ],
      notification_type: [
        "review_requested",
        "comment_added",
        "review_status_changed",
      ],
      review_status: ["pending", "in_review", "approved", "changes_requested"],
    },
  },
} as const
