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
          first_name: string | null
          id: string
          last_name: string | null
          needs_survey_sent_at: string | null
          needs_survey_status: string
          needs_survey_token: string | null
          training_id: string
        }
        Insert: {
          added_at?: string
          company?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          needs_survey_sent_at?: string | null
          needs_survey_status?: string
          needs_survey_token?: string | null
          training_id: string
        }
        Update: {
          added_at?: string
          company?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          needs_survey_sent_at?: string | null
          needs_survey_status?: string
          needs_survey_token?: string | null
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
          format_formation: string | null
          id: string
          invoice_file_url: string | null
          location: string
          objectives: string[] | null
          prerequisites: string[] | null
          program_file_url: string | null
          sponsor_email: string | null
          sponsor_first_name: string | null
          sponsor_formal_address: boolean
          sponsor_last_name: string | null
          start_date: string
          supertilt_link: string | null
          supports_url: string | null
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
          format_formation?: string | null
          id?: string
          invoice_file_url?: string | null
          location: string
          objectives?: string[] | null
          prerequisites?: string[] | null
          program_file_url?: string | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_formal_address?: boolean
          sponsor_last_name?: string | null
          start_date: string
          supertilt_link?: string | null
          supports_url?: string | null
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
          format_formation?: string | null
          id?: string
          invoice_file_url?: string | null
          location?: string
          objectives?: string[] | null
          prerequisites?: string[] | null
          program_file_url?: string | null
          sponsor_email?: string | null
          sponsor_first_name?: string | null
          sponsor_formal_address?: boolean
          sponsor_last_name?: string | null
          start_date?: string
          supertilt_link?: string | null
          supports_url?: string | null
          trainer_name?: string
          training_name?: string
          updated_at?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
