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
  const serviceKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

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
    const message =
      (data as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(`${functionName} a échoué : ${message}`);
  }

  return data;
}

async function supabaseInsert(
  table: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const url = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

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
    const message =
      (result as { message?: string }).message || `HTTP ${res.status}`;
    throw new Error(`Insert dans ${table} a échoué : ${message}`);
  }

  return Array.isArray(result) ? result[0] : result;
}

async function supabaseQuery(
  table: string,
  params: Record<string, string>,
): Promise<unknown[]> {
  const url = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    SUPABASE_SERVICE_ROLE_KEY,
  );

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

/** Récupère la première colonne du pipeline CRM (position la plus basse). */
async function getDefaultColumnId(): Promise<string> {
  const columns = (await supabaseQuery("crm_columns", {
    select: "id",
    order: "position.asc",
    limit: "1",
  })) as { id: string }[];

  if (!columns[0]) {
    throw new Error("Aucune colonne CRM trouvée dans le pipeline");
  }

  return columns[0].id;
}

/** Notifie Slack qu'une opportunité a été créée (fire-and-forget). */
async function notifySlackOpportunityCreated(
  card: Record<string, unknown>,
): Promise<void> {
  try {
    await callEdgeFunction("crm-slack-notify", {
      type: "opportunity_created",
      card: {
        title: card.title,
        company: card.company,
        first_name: card.first_name,
        last_name: card.last_name,
        service_type: card.service_type,
        estimated_value: card.estimated_value,
        email: card.email,
      },
      actor_email: "mcp-server",
    });
  } catch (e) {
    // Slack est best-effort, on ne fait pas échouer la création
    console.warn("Notification Slack échouée :", e);
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "super-tools",
  version: "1.0.0",
});

// ── create_training ─────────────────────────────────────────────────────────

server.tool(
  "create_training",
  "Crée une nouvelle formation. Exemples : « Crée une formation React pour Acme du 15 au 17 avril à Paris ».",
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
    sponsor_first_name: z
      .string()
      .optional()
      .describe("Prénom du commanditaire"),
    sponsor_last_name: z
      .string()
      .optional()
      .describe("Nom du commanditaire"),
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

// ── create_opportunity ──────────────────────────────────────────────────────

server.tool(
  "create_opportunity",
  "Crée une nouvelle opportunité commerciale. Exemples : « Nouvelle opportunité formation pour Marie Dupont chez Sanofi, venue de LinkedIn, estimée à 5000€ ».",
  {
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
      .describe("Comment le contact est arrivé"),
    estimated_value: z
      .number()
      .optional()
      .describe("Valeur estimée en euros"),
    description_html: z.string().optional().describe("Description libre"),
  },
  async (args) => {
    // Résoudre automatiquement la première colonne du pipeline
    const columnId = await getDefaultColumnId();

    // Calculer la position max dans cette colonne
    const existingCards = (await supabaseQuery("crm_cards", {
      select: "position",
      column_id: `eq.${columnId}`,
      order: "position.desc",
      limit: "1",
    })) as { position: number }[];

    const maxPos = existingCards[0]?.position ?? -1;

    const capitalize = (s?: string) =>
      s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;

    const insertData = {
      column_id: columnId,
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

    const card = (await supabaseInsert(
      "crm_cards",
      insertData,
    )) as Record<string, unknown>;

    // Log activité CRM
    await supabaseInsert("crm_activity_logs", {
      card_id: card.id,
      action: "card_created",
      actor_email: "mcp-server",
      new_value: args.title,
    });

    // Notification Slack automatique (best-effort)
    await notifySlackOpportunityCreated(card);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(card, null, 2) },
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
