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
          created_at: string
          email_opened_at: string | null
          email_sent_at: string | null
          id: string
          ip_address: string | null
          participant_id: string
          period: string
          schedule_date: string
          signature_data: string | null
          signed_at: string | null
          token: string
          training_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          id?: string
          ip_address?: string | null
          participant_id: string
          period: string
          schedule_date: string
          signature_data?: string | null
          signed_at?: string | null
          token: string
          training_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_opened_at?: string | null
          email_sent_at?: string | null
          id?: string
          ip_address?: string | null
          participant_id?: string
          period?: string
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
      content_cards: {
        Row: {
          column_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          tags: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          column_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          column_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
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
        ]
      }
      content_columns: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_system?: boolean
          name: string
        }
        Update: {
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
          created_at: string
          id: string
          message: string
          read_at: string | null
          reference_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          reference_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
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
          id: string
          reminder_sent_at: string | null
          reviewer_id: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          card_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          reminder_sent_at?: string | null
          reviewer_id: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          card_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          reminder_sent_at?: string | null
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
      email_templates: {
        Row: {
          created_at: string
          html_content: string
          id: string
          is_default: boolean
          subject: string
          template_name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          html_content: string
          id?: string
          is_default?: boolean
          subject: string
          template_name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          is_default?: boolean
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
      formation_configs: {
        Row: {
          created_at: string
          display_order: number
          duree_heures: number
          formation_name: string
          id: string
          is_default: boolean
          prix: number
          programme_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          duree_heures?: number
          formation_name: string
          id?: string
          is_default?: boolean
          prix?: number
          programme_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          duree_heures?: number
          formation_name?: string
          id?: string
          is_default?: boolean
          prix?: number
          programme_url?: string | null
          updated_at?: string
        }
        Relationships: []
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
      google_drive_tokens: {
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
      improvements: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          source_analysis_id: string | null
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
          description: string
          id?: string
          source_analysis_id?: string | null
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
          description?: string
          id?: string
          source_analysis_id?: string | null
          status?: string
          title?: string
          training_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "improvements_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          lecture_programme: string | null
          lien_mission: string | null
          modalites_preferences: Json | null
          necessite_amenagement: boolean | null
          necessite_validation_formateur: boolean | null
          niveau_actuel: number | null
          niveau_motivation: number | null
          nom: string | null
          participant_id: string
          prenom: string | null
          prerequis_details: string | null
          prerequis_validation: string | null
          societe: string | null
          token: string
          training_id: string
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
          lecture_programme?: string | null
          lien_mission?: string | null
          modalites_preferences?: Json | null
          necessite_amenagement?: boolean | null
          necessite_validation_formateur?: boolean | null
          niveau_actuel?: number | null
          niveau_motivation?: number | null
          nom?: string | null
          participant_id: string
          prenom?: string | null
          prerequis_details?: string | null
          prerequis_validation?: string | null
          societe?: string | null
          token: string
          training_id: string
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
          lecture_programme?: string | null
          lien_mission?: string | null
          modalites_preferences?: Json | null
          necessite_amenagement?: boolean | null
          necessite_validation_formateur?: boolean | null
          niveau_actuel?: number | null
          niveau_motivation?: number | null
          nom?: string | null
          participant_id?: string
          prenom?: string | null
          prerequis_details?: string | null
          prerequis_validation?: string | null
          societe?: string | null
          token?: string
          training_id?: string
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
      review_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          resolved_at: string | null
          review_id: string
          status: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          review_id: string
          status?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          review_id?: string
          status?: string | null
        }
        Relationships: [
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
      trainers: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          is_default: boolean | null
          last_name: string
          linkedin_url: string | null
          phone: string | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_default?: boolean | null
          last_name: string
          linkedin_url?: string | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
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
      training_evaluations: {
        Row: {
          amelioration_suggeree: string | null
          appreciation_generale: number | null
          appreciations_prises_en_compte: string | null
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
          message_recommandation: string | null
          objectif_prioritaire: string | null
          objectifs_evaluation: Json | null
          participant_id: string
          qualification_intervenant_adequate: boolean | null
          recommandation: string | null
          remarques_libres: string | null
          rythme: string | null
          token: string
          training_id: string
          updated_at: string
        }
        Insert: {
          amelioration_suggeree?: string | null
          appreciation_generale?: number | null
          appreciations_prises_en_compte?: string | null
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
          message_recommandation?: string | null
          objectif_prioritaire?: string | null
          objectifs_evaluation?: Json | null
          participant_id: string
          qualification_intervenant_adequate?: boolean | null
          recommandation?: string | null
          remarques_libres?: string | null
          rythme?: string | null
          token: string
          training_id: string
          updated_at?: string
        }
        Update: {
          amelioration_suggeree?: string | null
          appreciation_generale?: number | null
          appreciations_prises_en_compte?: string | null
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
          message_recommandation?: string | null
          objectif_prioritaire?: string | null
          objectifs_evaluation?: Json | null
          participant_id?: string
          qualification_intervenant_adequate?: boolean | null
          recommandation?: string | null
          remarques_libres?: string | null
          rythme?: string | null
          token?: string
          training_id?: string
          updated_at?: string
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
      training_participants: {
        Row: {
          added_at: string
          company: string | null
          email: string
          financeur_name: string | null
          financeur_same_as_sponsor: boolean | null
          financeur_url: string | null
          first_name: string | null
          id: string
          invoice_file_url: string | null
          last_name: string | null
          needs_survey_sent_at: string | null
          needs_survey_status: string
          needs_survey_token: string | null
          sponsor_email: string | null
          sponsor_first_name: string | null
          sponsor_last_name: string | null
          training_id: string
        }
        Insert: {
          added_at?: string
          company?: string | null
          email: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean | null
          financeur_url?: string | null
          first_name?: string | null
          id?: string
          invoice_file_url?: string | null
          last_name?: string | null
          needs_survey_sent_at?: string | null
          needs_survey_status?: string
          needs_survey_token?: string | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_last_name?: string | null
          training_id: string
        }
        Update: {
          added_at?: string
          company?: string | null
          email?: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean | null
          financeur_url?: string | null
          first_name?: string | null
          id?: string
          invoice_file_url?: string | null
          last_name?: string | null
          needs_survey_sent_at?: string | null
          needs_survey_status?: string
          needs_survey_token?: string | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_last_name?: string | null
          training_id?: string
        }
        Relationships: [
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
      trainings: {
        Row: {
          attendance_sheets_urls: string[] | null
          client_name: string
          created_at: string
          created_by: string
          end_date: string | null
          evaluation_link: string
          financeur_name: string | null
          financeur_same_as_sponsor: boolean
          financeur_url: string | null
          format_formation: string | null
          hotel_booked: boolean | null
          id: string
          invoice_file_url: string | null
          location: string
          objectives: string[] | null
          participants_formal_address: boolean
          prerequisites: string[] | null
          program_file_url: string | null
          restaurant_booked: boolean | null
          sponsor_email: string | null
          sponsor_first_name: string | null
          sponsor_formal_address: boolean
          sponsor_last_name: string | null
          start_date: string
          supertilt_link: string | null
          supports_url: string | null
          train_booked: boolean | null
          trainer_id: string | null
          trainer_name: string
          training_name: string
          updated_at: string
        }
        Insert: {
          attendance_sheets_urls?: string[] | null
          client_name: string
          created_at?: string
          created_by: string
          end_date?: string | null
          evaluation_link: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean
          financeur_url?: string | null
          format_formation?: string | null
          hotel_booked?: boolean | null
          id?: string
          invoice_file_url?: string | null
          location: string
          objectives?: string[] | null
          participants_formal_address?: boolean
          prerequisites?: string[] | null
          program_file_url?: string | null
          restaurant_booked?: boolean | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_formal_address?: boolean
          sponsor_last_name?: string | null
          start_date: string
          supertilt_link?: string | null
          supports_url?: string | null
          train_booked?: boolean | null
          trainer_id?: string | null
          trainer_name?: string
          training_name: string
          updated_at?: string
        }
        Update: {
          attendance_sheets_urls?: string[] | null
          client_name?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          evaluation_link?: string
          financeur_name?: string | null
          financeur_same_as_sponsor?: boolean
          financeur_url?: string | null
          format_formation?: string | null
          hotel_booked?: boolean | null
          id?: string
          invoice_file_url?: string | null
          location?: string
          objectives?: string[] | null
          participants_formal_address?: boolean
          prerequisites?: string[] | null
          program_file_url?: string | null
          restaurant_booked?: boolean | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_formal_address?: boolean
          sponsor_last_name?: string | null
          start_date?: string
          supertilt_link?: string | null
          supports_url?: string | null
          train_booked?: boolean | null
          trainer_id?: string | null
          trainer_name?: string
          training_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_module_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      upsert_profile: {
        Args: { p_display_name?: string; p_email: string; p_user_id: string }
        Returns: undefined
      }
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
