import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPER_TOOLS_API_KEY = process.env.SUPER_TOOLS_API_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variable d'environnement requise : ${name}`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callEdgeFunction(
  functionName: string,
  body: unknown,
  options?: { useApiKey?: boolean },
): Promise<unknown> {
  const url = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };

  if (options?.useApiKey) {
    const apiKey = requireEnv("SUPER_TOOLS_API_KEY", SUPER_TOOLS_API_KEY);
    headers["x-api-key"] = apiKey;
  }

  const res = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = (data as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(`Edge function ${functionName} a échoué : ${message}`);
  }

  return data;
}

async function supabaseInsert(
  table: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const url = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });

  const result = await res.json();

  if (!res.ok) {
    const message = (result as { message?: string }).message || `HTTP ${res.status}`;
    throw new Error(`Insert dans ${table} a échoué : ${message}`);
  }

  return Array.isArray(result) ? result[0] : result;
}

async function supabaseQuery(
  table: string,
  params: Record<string, string>,
): Promise<unknown[]> {
  const url = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

  const queryParams = new URLSearchParams(params);
  const res = await fetch(`${url}/rest/v1/${table}?${queryParams}`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Query ${table} a échoué : HTTP ${res.status}`);
  }

  return (await res.json()) as unknown[];
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "super-tools",
  version: "1.0.0",
});

// ── Tool 1 : create_training ────────────────────────────────────────────────

server.tool(
  "create_training",
  "Crée une nouvelle formation dans Super Tools. Champs requis : training_name, client_name, start_date, end_date, location.",
  {
    training_name: z.string().describe("Nom de la formation"),
    client_name: z.string().describe("Nom du client"),
    start_date: z.string().describe("Date de début (YYYY-MM-DD)"),
    end_date: z.string().describe("Date de fin (YYYY-MM-DD)"),
    location: z.string().describe("Lieu de la formation"),
    format_formation: z
      .enum(["intra-entreprise", "inter-entreprises", "e-learning"])
      .optional()
      .describe("Format de la formation"),
    sponsor_email: z.string().optional().describe("Email du commanditaire"),
    sponsor_first_name: z.string().optional().describe("Prénom du commanditaire"),
    sponsor_last_name: z.string().optional().describe("Nom du commanditaire"),
    notes: z.string().optional().describe("Notes libres"),
    participants: z
      .array(
        z.object({
          email: z.string(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          company: z.string().optional(),
        }),
      )
      .optional()
      .describe("Liste des participants"),
    schedules: z
      .array(
        z.object({
          day_date: z.string(),
          start_time: z.string(),
          end_time: z.string(),
        }),
      )
      .optional()
      .describe("Horaires jour par jour (HH:MM)"),
  },
  async (args) => {
    const result = await callEdgeFunction("zapier-create-training", args, {
      useApiKey: true,
    });
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// ── Tool 2 : create_opportunity ─────────────────────────────────────────────

server.tool(
  "create_opportunity",
  "Crée une opportunité CRM (carte dans le pipeline). Champs requis : column_id, title.",
  {
    column_id: z.string().describe("ID de la colonne CRM cible"),
    title: z.string().describe("Titre de l'opportunité"),
    first_name: z.string().optional().describe("Prénom du contact"),
    last_name: z.string().optional().describe("Nom du contact"),
    email: z.string().optional().describe("Email du contact"),
    phone: z.string().optional().describe("Téléphone"),
    company: z.string().optional().describe("Entreprise"),
    linkedin_url: z.string().optional().describe("URL LinkedIn"),
    service_type: z
      .enum(["formation", "mission"])
      .optional()
      .describe("Type de prestation"),
    acquisition_source: z
      .enum([
        "recommandation",
        "linkedin",
        "site_web",
        "salon_evenement",
        "prospection",
        "ancien_client",
        "partenaire",
        "appel_entrant",
        "email_entrant",
        "reseaux_sociaux",
        "bouche_a_oreille",
        "formation_inter",
        "autre",
      ])
      .optional()
      .describe("Source d'acquisition"),
    estimated_value: z.number().optional().describe("Valeur estimée en euros"),
    description_html: z.string().optional().describe("Description HTML"),
  },
  async (args) => {
    // Calculer la position max
    const existingCards = (await supabaseQuery("crm_cards", {
      select: "position",
      column_id: `eq.${args.column_id}`,
      order: "position.desc",
      limit: "1",
    })) as { position: number }[];

    const maxPos = existingCards[0]?.position ?? -1;

    const capitalize = (s?: string) =>
      s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;

    const insertData = {
      column_id: args.column_id,
      title: args.title,
      description_html: args.description_html || null,
      status_operational: "TODAY",
      sales_status: "OPEN",
      estimated_value: args.estimated_value ?? 0,
      position: maxPos + 1,
      first_name: capitalize(args.first_name),
      last_name: capitalize(args.last_name),
      phone: args.phone || null,
      company: args.company || null,
      email: args.email?.toLowerCase().trim() || null,
      linkedin_url: args.linkedin_url || null,
      service_type: args.service_type || null,
      acquisition_source: args.acquisition_source || null,
    };

    const card = await supabaseInsert("crm_cards", insertData);

    // Log activité CRM
    const cardId = (card as { id: string }).id;
    await supabaseInsert("crm_activity_logs", {
      card_id: cardId,
      action: "card_created",
      actor_email: "mcp-server",
      new_value: args.title,
    });

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(card, null, 2) },
      ],
    };
  },
);

// ── Tool 3 : slack_notify ───────────────────────────────────────────────────

server.tool(
  "slack_notify",
  "Envoie une notification Slack CRM (nouvelle opportunité ou opportunité gagnée).",
  {
    type: z
      .enum(["opportunity_created", "opportunity_won"])
      .describe("Type de notification"),
    title: z.string().describe("Titre de l'opportunité"),
    company: z.string().optional().describe("Entreprise"),
    first_name: z.string().optional().describe("Prénom du contact"),
    last_name: z.string().optional().describe("Nom du contact"),
    service_type: z.string().optional().describe("Type de prestation"),
    estimated_value: z.number().optional().describe("Valeur estimée"),
    email: z.string().optional().describe("Email du contact"),
    actor_email: z.string().optional().describe("Email de l'auteur de l'action"),
  },
  async (args) => {
    const { type, actor_email, ...cardFields } = args;
    const result = await callEdgeFunction("crm-slack-notify", {
      type,
      card: cardFields,
      actor_email,
    });
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// ── Tool 4 : woocommerce_generate_coupon ────────────────────────────────────

server.tool(
  "woocommerce_generate_coupon",
  "Génère un coupon WooCommerce 100% pour donner l'accès e-learning à un participant.",
  {
    participant_id: z.string().describe("UUID du participant"),
    training_id: z.string().describe("UUID de la formation"),
  },
  async (args) => {
    const result = await callEdgeFunction("generate-woocommerce-coupon", {
      participantId: args.participant_id,
      trainingId: args.training_id,
    });
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// ── Tool 5 : list_crm_columns ───────────────────────────────────────────────

server.tool(
  "list_crm_columns",
  "Liste les colonnes du pipeline CRM (utile pour obtenir le column_id avant de créer une opportunité).",
  {},
  async () => {
    const columns = await supabaseQuery("crm_columns", {
      select: "id,title,position",
      order: "position.asc",
    });
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(columns, null, 2) },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Erreur fatale :", error);
  process.exit(1);
});
