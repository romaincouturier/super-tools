import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Settings, Mail, Save, RotateCcw, Sparkles, Cog } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface EmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

type AddressMode = "tu" | "vous";

// Template configuration with timing info
interface TemplateConfig {
  name: string;
  timing: "before" | "after" | "manual";
  delayKey?: string; // Key in app_settings for delay
  subject: { tu: string; vous: string };
  content: { tu: string; vous: string };
  variables: string[];
}

const DEFAULT_TEMPLATES: Record<string, TemplateConfig> = {
  // BEFORE TRAINING
  needs_survey: {
    name: "Questionnaire de recueil des besoins",
    timing: "before",
    delayKey: "delay_needs_survey_days",
    subject: {
      tu: "Prépare ta formation \"{{training_name}}\"",
      vous: "Préparez votre formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu es inscrit(e) à la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je t'invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre tes attentes et d'adapter le contenu de la formation à tes besoins spécifiques.

Je te remercie de le compléter avant le {{deadline_date}}.

À très bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous êtes inscrit(e) à la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je vous invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre vos attentes et d'adapter le contenu de la formation à vos besoins spécifiques.

Je vous remercie de le compléter avant le {{deadline_date}}.

À très bientôt !`,
    },
    variables: ["first_name", "training_name", "training_date", "questionnaire_link", "deadline_date"],
  },
  needs_survey_reminder: {
    name: "Rappel questionnaire besoins",
    timing: "before",
    subject: {
      tu: "Rappel : Prépare ta formation \"{{training_name}}\"",
      vous: "Rappel : Préparez votre formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de te relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Ton retour m'est précieux pour adapter au mieux le contenu à tes besoins.

{{questionnaire_link}}

Merci d'avance pour ta participation !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de vous relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Votre retour m'est précieux pour adapter au mieux le contenu à vos besoins.

{{questionnaire_link}}

Merci d'avance pour votre participation !`,
    },
    variables: ["first_name", "training_name", "questionnaire_link"],
  },
  attendance_signature: {
    name: "Demande de signature d'émargement",
    timing: "before",
    subject: {
      tu: "Signature d'émargement - {{training_name}}",
      vous: "Signature d'émargement - {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer ta feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de ta présence à la formation.

Merci !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer votre feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de votre présence à la formation.

Merci !`,
    },
    variables: ["first_name", "training_name", "session_date", "signature_link"],
  },
  // AFTER TRAINING
  thank_you: {
    name: "Email de remerciement",
    timing: "after",
    delayKey: "delay_thank_you_days",
    subject: {
      tu: "Merci pour ta participation à la formation {{training_name}}",
      vous: "Merci pour votre participation à la formation {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ton énergie et ta participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que tu prennes quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Tu trouveras également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans tes présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment tu vas utiliser tout ce que nous avons vu ! N'hésite pas à me contacter si tu as des questions ou des besoins de compléments d'informations.

Je te souhaite une bonne journée`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée`,
    },
    variables: ["first_name", "training_name", "evaluation_link", "supports_url"],
  },
  google_review: {
    name: "Demande d'avis Google",
    timing: "after",
    delayKey: "delay_google_review_days",
    subject: {
      tu: "🌟 Ton avis sur la formation \"{{training_name}}\"",
      vous: "🌟 Votre avis sur la formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

J'espère que tout va bien pour toi !

Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, ton avis serait précieux en tant que commanditaire de la formation. Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Clique ici pour laisser ton avis : https://g.page/r/CWJ0W_P6C-BJEAE/review

Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos formations.

Merci infiniment pour ton soutien et pour avoir participé à notre formation !

À bientôt,`,
      vous: `Bonjour {{first_name}},

J'espère que tout va bien pour vous !

Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, votre avis serait précieux en tant que commanditaire de la formation. Pourriez-vous nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Cliquez ici pour laisser votre avis : https://g.page/r/CWJ0W_P6C-BJEAE/review

Votre retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos formations.

Merci infiniment pour votre soutien et pour avoir participé à notre formation !

À bientôt,`,
    },
    variables: ["first_name", "training_name"],
  },
  video_testimonial: {
    name: "Demande de témoignage vidéo",
    timing: "after",
    delayKey: "delay_video_testimonial_days",
    subject: {
      tu: "🎥 Partager ton expérience sur la formation \"{{training_name}}\"",
      vous: "🎥 Partager votre expérience sur la formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

Je me permets de te contacter pour te proposer de partager ton retour d'expérience sur la formation que nous avons organisée.

Ce témoignage pourrait être réalisé via une courte interview en visioconférence (10 minutes maximum) et serait précieux pour inspirer d'autres organisations et valoriser ton analyse.

Si tu es partant(e), il te suffit de cliquer sur le lien ci-dessous pour convenir d'un moment ensemble :

👉 Contacte-moi pour trouver un créneau : mailto:romain@supertilt.fr?subject=OK%20pour%20faire%20un%20t%C3%A9moignage%20Vid%C3%A9o&body=Salut%2C%0D%0A%0D%0AJe%20viens%20de%20recevoir%20ton%20mail%2C%20je%20suis%20partant%20pour%20faire%20un%20t%C3%A9moignage%20vid%C3%A9o%20%3A-)

Merci d'avance pour ton temps et ton retour ! Je reste à disposition pour toute question ou précision.

Bonne journée`,
      vous: `Bonjour {{first_name}},

Je me permets de vous contacter pour vous proposer de partager votre retour d'expérience sur la formation que nous avons organisée.

Ce témoignage pourrait être réalisé via une courte interview en visioconférence (10 minutes maximum) et serait précieux pour inspirer d'autres organisations et valoriser votre analyse.

Si vous êtes partant(e), il vous suffit de cliquer sur le lien ci-dessous pour convenir d'un moment ensemble :

👉 Contactez-moi pour trouver un créneau : mailto:romain@supertilt.fr?subject=OK%20pour%20faire%20un%20t%C3%A9moignage%20Vid%C3%A9o&body=Bonjour%2C%0D%0A%0D%0AJe%20viens%20de%20recevoir%20votre%20mail%2C%20je%20suis%20partant%20pour%20faire%20un%20t%C3%A9moignage%20vid%C3%A9o.

Merci d'avance pour votre temps et votre retour ! Je reste à disposition pour toute question ou précision.

Bonne journée`,
    },
    variables: ["first_name", "training_name"],
  },
  cold_evaluation: {
    name: "Évaluation à froid commanditaire",
    timing: "after",
    delayKey: "delay_cold_evaluation_days",
    subject: {
      tu: "💡 Évaluation à froid de la formation \"{{training_name}}\" 💡",
      vous: "💡 Évaluation à froid de la formation \"{{training_name}}\" 💡",
    },
    content: {
      tu: `Bonjour {{first_name}},

Comment vas-tu ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations.

Pourrais-tu prendre 2 minutes pour remplir ce questionnaire en ligne ?

👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6

Merci énormément pour ton soutien :-)

À bientôt

PS : on peut continuer à rester en contact sur LinkedIn (https://www.linkedin.com/in/romaincouturier/) et sur Instagram (https://www.instagram.com/supertilt.ledeclic/) pour d'autres contenus sur le sujet de la formation.`,
      vous: `Bonjour {{first_name}},

Comment allez-vous ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations.

Pourriez-vous prendre 2 minutes pour remplir ce questionnaire en ligne ?

👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6

Merci infiniment pour votre soutien.

À bientôt,

PS : nous pouvons continuer à rester en contact sur LinkedIn (https://www.linkedin.com/in/romaincouturier/) et sur Instagram (https://www.instagram.com/supertilt.ledeclic/) pour d'autres contenus sur le sujet de la formation.`,
    },
    variables: ["first_name", "training_name"],
  },
  training_documents: {
    name: "Envoi des documents de formation",
    timing: "manual",
    subject: {
      tu: "Documents de la formation \"{{training_name}}\"",
      vous: "Documents de la formation \"{{training_name}}\"",
    },
    content: {
      tu: `{{greeting}},

Voici les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.

{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}

N'hésite pas à me contacter si tu as des questions.

Bonne réception.`,
      vous: `{{greeting}},

Veuillez trouver ci-joint les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.

{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}

N'hésitez pas à me contacter si vous avez des questions.

Bonne réception.`,
    },
    variables: ["greeting", "training_name", "training_dates", "has_invoice", "has_sheets"],
  },
};

const Parametres = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [improving, setImproving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Record<AddressMode, EmailTemplate | null>>>({});
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Record<AddressMode, { subject: string; content: string }>>>({});
  const [activeMode, setActiveMode] = useState<Record<string, AddressMode>>({});
  
  // General settings
  const [bccEnabled, setBccEnabled] = useState(true);
  const [bccEmail, setBccEmail] = useState("romain@supertilt.fr");
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Email scheduling delays
  const [delayNeedsSurvey, setDelayNeedsSurvey] = useState("7");
  const [delayReminder, setDelayReminder] = useState("7");
  const [delayTrainerSummary, setDelayTrainerSummary] = useState("1");
  const [delayThankYou, setDelayThankYou] = useState("1");
  const [delayGoogleReview, setDelayGoogleReview] = useState("7");
  const [delayVideoTestimonial, setDelayVideoTestimonial] = useState("14");
  const [delayColdEvaluation, setDelayColdEvaluation] = useState("30");
  const [delayColdEvaluationFunder, setDelayColdEvaluationFunder] = useState("45");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await Promise.all([fetchTemplates(), fetchSettings()]);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "bcc_email", "bcc_enabled",
        "delay_needs_survey_days", "delay_reminder_days", "delay_trainer_summary_days",
        "delay_thank_you_days", "delay_google_review_days", "delay_video_testimonial_days", 
        "delay_cold_evaluation_days", "delay_cold_evaluation_funder_days"
      ]);
    
    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }
    
    data?.forEach((setting) => {
      switch (setting.setting_key) {
        case "bcc_email":
          setBccEmail(setting.setting_value || "");
          break;
        case "bcc_enabled":
          setBccEnabled(setting.setting_value === "true");
          break;
        case "delay_needs_survey_days":
          setDelayNeedsSurvey(setting.setting_value || "7");
          break;
        case "delay_reminder_days":
          setDelayReminder(setting.setting_value || "7");
          break;
        case "delay_trainer_summary_days":
          setDelayTrainerSummary(setting.setting_value || "1");
          break;
        case "delay_thank_you_days":
          setDelayThankYou(setting.setting_value || "1");
          break;
        case "delay_google_review_days":
          setDelayGoogleReview(setting.setting_value || "7");
          break;
        case "delay_video_testimonial_days":
          setDelayVideoTestimonial(setting.setting_value || "14");
          break;
        case "delay_cold_evaluation_days":
          setDelayColdEvaluation(setting.setting_value || "30");
          break;
        case "delay_cold_evaluation_funder_days":
          setDelayColdEvaluationFunder(setting.setting_value || "45");
          break;
      }
    });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const settingsToSave = [
        { setting_key: "bcc_email", setting_value: bccEmail, description: "Adresse email en copie cachée (BCC) pour tous les envois" },
        { setting_key: "bcc_enabled", setting_value: bccEnabled.toString(), description: "Activer ou désactiver l'envoi en copie cachée (BCC)" },
        { setting_key: "delay_needs_survey_days", setting_value: delayNeedsSurvey, description: "Délai avant formation pour envoyer le questionnaire de besoins (en jours)" },
        { setting_key: "delay_reminder_days", setting_value: delayReminder, description: "Délai avant formation pour envoyer le rappel logistique (en jours)" },
        { setting_key: "delay_trainer_summary_days", setting_value: delayTrainerSummary, description: "Délai avant formation pour envoyer la synthèse au formateur (en jours)" },
        { setting_key: "delay_thank_you_days", setting_value: delayThankYou, description: "Délai après formation pour envoyer le mail de remerciement (en jours)" },
        { setting_key: "delay_google_review_days", setting_value: delayGoogleReview, description: "Délai après formation pour demander un avis Google (en jours)" },
        { setting_key: "delay_video_testimonial_days", setting_value: delayVideoTestimonial, description: "Délai après formation pour demander un témoignage vidéo (en jours)" },
        { setting_key: "delay_cold_evaluation_days", setting_value: delayColdEvaluation, description: "Délai après formation pour envoyer l'évaluation à froid (en jours)" },
        { setting_key: "delay_cold_evaluation_funder_days", setting_value: delayColdEvaluationFunder, description: "Délai après formation pour rappeler de contacter le financeur (en jours)" },
      ];

      for (const setting of settingsToSave) {
        await supabase
          .from("app_settings")
          .upsert(setting, { onConflict: "setting_key" });
      }

      toast({
        title: "Paramètres enregistrés",
        description: "Les paramètres généraux ont été mis à jour.",
      });
    } catch (error) {
      console.error("Save settings error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*");

    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }

    const templatesMap: Record<string, Record<AddressMode, EmailTemplate | null>> = {};
    const editedMap: Record<string, Record<AddressMode, { subject: string; content: string }>> = {};
    const modeMap: Record<string, AddressMode> = {};
    
    // Group templates by base type and mode
    data?.forEach((t) => {
      const isVous = t.template_type.endsWith("_vous");
      const isTu = t.template_type.endsWith("_tu");
      const mode: AddressMode = isVous ? "vous" : isTu ? "tu" : "vous";
      const baseType = isVous ? t.template_type.replace("_vous", "") : isTu ? t.template_type.replace("_tu", "") : t.template_type;
      
      if (!templatesMap[baseType]) {
        templatesMap[baseType] = { tu: null, vous: null };
      }
      if (!editedMap[baseType]) {
        editedMap[baseType] = {
          tu: { subject: "", content: "" },
          vous: { subject: "", content: "" },
        };
      }
      
      templatesMap[baseType][mode] = t;
      editedMap[baseType][mode] = { subject: t.subject, content: t.html_content };
    });

    // Initialize with defaults for any missing templates
    Object.keys(DEFAULT_TEMPLATES).forEach((type) => {
      if (!templatesMap[type]) {
        templatesMap[type] = { tu: null, vous: null };
      }
      if (!editedMap[type]) {
        editedMap[type] = {
          tu: { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu },
          vous: { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous },
        };
      } else {
        // Fill in missing modes with defaults
        if (!editedMap[type].tu.subject) {
          editedMap[type].tu = { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu };
        }
        if (!editedMap[type].vous.subject) {
          editedMap[type].vous = { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous };
        }
      }
      modeMap[type] = "vous"; // Default to vous
    });

    setTemplates(templatesMap);
    setEditedTemplates(editedMap);
    setActiveMode(modeMap);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSaveTemplate = async (templateType: string, mode: AddressMode) => {
    const saveKey = `${templateType}_${mode}`;
    setSaving(saveKey);
    
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const existing = templates[templateType]?.[mode];
      const templateTypeWithMode = `${templateType}_${mode}`;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("email_templates")
          .update({
            subject: edited.subject,
            html_content: edited.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("email_templates")
          .insert({
            template_type: templateTypeWithMode,
            template_name: `${DEFAULT_TEMPLATES[templateType].name} (${mode === "tu" ? "tutoiement" : "vouvoiement"})`,
            subject: edited.subject,
            html_content: edited.content,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        setTemplates((prev) => ({
          ...prev,
          [templateType]: {
            ...prev[templateType],
            [mode]: data,
          },
        }));
      }

      toast({
        title: "Template enregistré",
        description: `Le modèle d'email (${mode === "tu" ? "tutoiement" : "vouvoiement"}) a été mis à jour avec succès.`,
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le template.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleResetTemplate = (templateType: string, mode: AddressMode) => {
    const defaultTemplate = DEFAULT_TEMPLATES[templateType];
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: {
          subject: defaultTemplate.subject[mode],
          content: defaultTemplate.content[mode],
        },
      },
    }));
    
    toast({
      title: "Template réinitialisé",
      description: "Les valeurs par défaut ont été restaurées. N'oubliez pas d'enregistrer.",
    });
  };

  const updateTemplate = (templateType: string, mode: AddressMode, field: "subject" | "content", value: string) => {
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: {
          ...prev[templateType]?.[mode],
          [field]: value,
        },
      },
    }));
  };

  const handleImproveWithAI = async (templateType: string, mode: AddressMode) => {
    const improveKey = `${templateType}_${mode}`;
    setImproving(improveKey);
    
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const templateName = DEFAULT_TEMPLATES[templateType].name;

      const { data, error } = await supabase.functions.invoke("improve-email-content", {
        body: {
          subject: edited.subject,
          content: edited.content,
          templateType,
          templateName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setEditedTemplates((prev) => ({
        ...prev,
        [templateType]: {
          ...prev[templateType],
          [mode]: {
            subject: data.subject,
            content: data.content,
          },
        },
      }));

      toast({
        title: "Contenu amélioré",
        description: "L'IA a proposé des améliorations. Vérifiez et enregistrez si satisfait.",
      });
    } catch (error: any) {
      console.error("AI improvement error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'améliorer le contenu avec l'IA.",
        variant: "destructive",
      });
    } finally {
      setImproving(null);
    }
  };

  const renderTemplateEditor = (type: string, defaultTemplate: TemplateConfig, currentMode: AddressMode, saveKey: string) => (
    <>
      {/* Tu/Vous tabs */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Version :</span>
        <Tabs
          value={currentMode}
          onValueChange={(v) => setActiveMode((prev) => ({ ...prev, [type]: v as AddressMode }))}
        >
          <TabsList className="h-8">
            <TabsTrigger value="tu" className="text-xs px-3 h-7">
              Tutoiement
            </TabsTrigger>
            <TabsTrigger value="vous" className="text-xs px-3 h-7">
              Vouvoiement
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label>Objet de l'email</Label>
        <Input
          value={editedTemplates[type]?.[currentMode]?.subject || ""}
          onChange={(e) => updateTemplate(type, currentMode, "subject", e.target.value)}
          placeholder="Objet du mail..."
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label>Contenu de l'email</Label>
        <Textarea
          value={editedTemplates[type]?.[currentMode]?.content || ""}
          onChange={(e) => updateTemplate(type, currentMode, "content", e.target.value)}
          placeholder="Contenu du mail..."
          className="min-h-[200px] font-mono text-sm"
        />
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <Label className="text-muted-foreground">Variables disponibles</Label>
        <div className="flex flex-wrap gap-2">
          {defaultTemplate.variables.map((variable) => (
            <code
              key={variable}
              className="px-2 py-1 bg-muted rounded text-xs"
            >
              {`{{${variable}}}`}
            </code>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          onClick={() => handleSaveTemplate(type, currentMode)}
          disabled={saving === saveKey || improving === saveKey}
        >
          {saving === saveKey ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleImproveWithAI(type, currentMode)}
          disabled={improving === saveKey || saving === saveKey}
        >
          {improving === saveKey ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Améliorer avec l'IA
        </Button>
        <Button
          variant="outline"
          onClick={() => handleResetTemplate(type, currentMode)}
          disabled={saving === saveKey || improving === saveKey}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Réinitialiser
        </Button>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} onLogout={handleLogout} />

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Paramètres</h1>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Cog className="h-4 w-4" />
              Général
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Modèles d'emails
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres généraux</CardTitle>
                <CardDescription>
                  Configuration globale de l'application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* BCC Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Copie cachée des emails</h3>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="bcc-toggle" className="text-base">Activer le BCC</Label>
                      <p className="text-sm text-muted-foreground">
                        Ajouter automatiquement un destinataire en copie cachée sur tous les emails envoyés.
                      </p>
                    </div>
                    <Switch
                      id="bcc-toggle"
                      checked={bccEnabled}
                      onCheckedChange={setBccEnabled}
                    />
                  </div>
                  
                  {bccEnabled && (
                    <div className="space-y-2 pl-0 pt-2">
                      <Label htmlFor="bcc-email">Adresse email BCC</Label>
                      <Input
                        id="bcc-email"
                        type="email"
                        value={bccEmail}
                        onChange={(e) => setBccEmail(e.target.value)}
                        placeholder="email@exemple.com"
                        className="max-w-md"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Email scheduling delays - Before training */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Délais des emails avant formation</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez les délais d'envoi des emails automatiques avant la date de formation (J-X).
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay-needs-survey">Questionnaire de besoins</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J -</span>
                        <Input
                          id="delay-needs-survey"
                          type="number"
                          min="1"
                          max="30"
                          value={delayNeedsSurvey}
                          onChange={(e) => setDelayNeedsSurvey(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-reminder">Rappel logistique</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J -</span>
                        <Input
                          id="delay-reminder"
                          type="number"
                          min="1"
                          max="30"
                          value={delayReminder}
                          onChange={(e) => setDelayReminder(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-trainer-summary">Synthèse formateur</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J -</span>
                        <Input
                          id="delay-trainer-summary"
                          type="number"
                          min="1"
                          max="30"
                          value={delayTrainerSummary}
                          onChange={(e) => setDelayTrainerSummary(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email scheduling delays - After training */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Délais des emails après formation</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez les délais d'envoi des emails automatiques après la date de fin de formation (J+X).
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay-thank-you">Remerciement</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-thank-you"
                          type="number"
                          min="0"
                          max="30"
                          value={delayThankYou}
                          onChange={(e) => setDelayThankYou(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-google-review">Avis Google</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-google-review"
                          type="number"
                          min="1"
                          max="60"
                          value={delayGoogleReview}
                          onChange={(e) => setDelayGoogleReview(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-video-testimonial">Témoignage vidéo</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-video-testimonial"
                          type="number"
                          min="1"
                          max="60"
                          value={delayVideoTestimonial}
                          onChange={(e) => setDelayVideoTestimonial(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-cold-evaluation">Évaluation à froid commanditaire</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-cold-evaluation"
                          type="number"
                          min="1"
                          max="90"
                          value={delayColdEvaluation}
                          onChange={(e) => setDelayColdEvaluation(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-cold-evaluation-funder">Rappel financeur</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-cold-evaluation-funder"
                          type="number"
                          min="1"
                          max="120"
                          value={delayColdEvaluationFunder}
                          onChange={(e) => setDelayColdEvaluationFunder(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uniquement si le financeur est différent du commanditaire
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails">
            <Card>
              <CardHeader>
                <CardTitle>Personnalisation des emails</CardTitle>
                <CardDescription>
                  Modifiez le contenu des emails automatiques envoyés par l'application.
                  Utilisez les variables entre doubles accolades (ex: {"{{first_name}}"}) pour insérer des données dynamiques.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Before Training Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    📅 Avant la formation
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "before")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        const delayValue = defaultTemplate.delayKey === "delay_needs_survey_days" ? delayNeedsSurvey : null;
                        const timingLabel = delayValue ? `J-${delayValue}` : null;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {timingLabel && (
                                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-medium">
                                    {timingLabel}
                                  </span>
                                )}
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>

                <Separator />

                {/* After Training Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    ✅ Après la formation
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "after")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        const delayValue = defaultTemplate.delayKey === "delay_thank_you_days" ? delayThankYou : null;
                        const timingLabel = delayValue ? `J+${delayValue}` : null;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {timingLabel && (
                                  <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded font-medium">
                                    {timingLabel}
                                  </span>
                                )}
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>

                <Separator />

                {/* Manual Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    ✋ Envoi manuel
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "manual")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Parametres;
