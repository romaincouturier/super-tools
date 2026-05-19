import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { CLAUDE_ADVANCED } from "../_shared/claude-models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REPO = "romaincouturier/super-tools";
const GITHUB_API = "https://api.github.com";
const RESPONSE_BUDGET_MS = 115_000;
const GITHUB_FETCH_TIMEOUT_MS = 12_000;
const AI_FETCH_TIMEOUT_MS = 25_000;
const AI_CHUNK_SIZE = 6;
const AI_CONCURRENCY = 2;

interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  html_url: string;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: Array<{ name: string }>;
}

interface ProposedEntry {
  entry_date: string;
  duration_minutes: number;
  description: string;
  github_pr_number: number;
  github_pr_url: string;
}

function remainingBudget(deadline: number): number {
  return deadline - Date.now();
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fallbackEstimate(pr: GitHubPR): number {
  const churn = pr.additions + pr.deletions;
  if (pr.changed_files > 15 || churn > 500 || pr.commits > 8) return 360;
  if (pr.changed_files > 5 || churn > 200 || pr.commits > 3) return 180;
  if (pr.changed_files > 2 || churn > 50) return 90;
  return 60;
}

function fallbackDescription(pr: GitHubPR): string {
  const labels = pr.labels.map((l) => l.name).filter(Boolean).join(", ");
  const details = `${pr.changed_files} fichier${pr.changed_files > 1 ? "s" : ""} modifié${pr.changed_files > 1 ? "s" : ""}, ${pr.commits} commit${pr.commits > 1 ? "s" : ""}, +${pr.additions}/-${pr.deletions} lignes`;
  return `Travail réalisé sur ${pr.title}. Analyse, développement et validation de la PR #${pr.number} (${details}${labels ? `, labels : ${labels}` : ""}).`;
}

async function fetchAllMergedPRs(token: string, since: string, until: string, deadline: number): Promise<GitHubPR[]> {
  const prs: GitHubPR[] = [];
  let page = 1;

  while (true) {
    if (remainingBudget(deadline) < 20_000) {
      console.warn("Stopping GitHub fetch early: response budget nearly exhausted");
      break;
    }

    const url = `${GITHUB_API}/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`;
    const resp = await fetchWithTimeout(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SuperTools-TimeTracker",
      },
    }, GITHUB_FETCH_TIMEOUT_MS);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`GitHub API error ${resp.status}: ${err}`);
    }

    const items = await resp.json();
    if (!Array.isArray(items) || items.length === 0) break;

    // Filter PRs in window first
    const candidates: any[] = [];
    let pastWindow = false;
    for (const pr of items) {
      if (!pr.merged_at) continue;
      const mergedDate = pr.merged_at as string;
      if (mergedDate < since) {
        if (mergedDate < since.slice(0, 7) + "-01") { pastWindow = true; break; }
        continue;
      }
      if (mergedDate > until) continue;
      candidates.push(pr);
    }

    // Fetch PR details in parallel batches of 10 to avoid timeout
    const BATCH_SIZE = 10;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      if (remainingBudget(deadline) < 20_000) {
        console.warn(`Skipping GitHub PR detail calls for ${candidates.length - i} PRs: response budget nearly exhausted`);
        for (const pr of candidates.slice(i)) {
          prs.push({
            number: pr.number,
            title: pr.title,
            body: pr.body || "",
            merged_at: pr.merged_at,
            html_url: pr.html_url,
            commits: 1,
            additions: 0,
            deletions: 0,
            changed_files: 0,
            labels: pr.labels || [],
          });
        }
        break;
      }
      const results = await Promise.all(batch.map(async (pr) => {
        let detail: any = {};
        try {
          const detailResp = await fetchWithTimeout(`${GITHUB_API}/repos/${REPO}/pulls/${pr.number}`, {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "SuperTools-TimeTracker",
            },
          }, GITHUB_FETCH_TIMEOUT_MS);
          if (detailResp.ok) detail = await detailResp.json();
        } catch (err) {
          console.warn(`GitHub PR detail timeout/failure for #${pr.number}:`, err instanceof Error ? err.message : err);
        }
        return {
          number: pr.number,
          title: pr.title,
          body: pr.body || "",
          merged_at: pr.merged_at,
          html_url: pr.html_url,
          commits: detail.commits || 1,
          additions: detail.additions || 0,
          deletions: detail.deletions || 0,
          changed_files: detail.changed_files || 0,
          labels: pr.labels || [],
        } as GitHubPR;
      }));
      for (const r of results) if (r) prs.push(r);
    }

    if (pastWindow) break;


    if (items.length < 100) break;
    page++;
  }

  return prs;
}

async function generateEntriesForBatch(prs: GitHubPR[], deadline: number): Promise<Array<{ pr_number: number; duration_minutes: number; description: string }>> {
  if (remainingBudget(deadline) < AI_FETCH_TIMEOUT_MS + 5_000) {
    console.warn(`Skipping AI batch (${prs.length} PRs): response budget nearly exhausted`);
    return [];
  }

  const prSummaries = prs.map((pr) => {
    const labelNames = pr.labels.map((l) => l.name).join(", ");
    const body = (pr.body || "").slice(0, 400);
    return `PR #${pr.number} — "${pr.title}"
  Mergé le: ${pr.merged_at?.slice(0, 10)}
  Commits: ${pr.commits} | Fichiers modifiés: ${pr.changed_files} | +${pr.additions}/-${pr.deletions} lignes
  Labels: ${labelNames || "aucun"}
  Description: ${body || "(aucune)"}`;
  }).join("\n\n---\n\n");

  const systemPrompt = `Tu es un assistant qui aide un développeur indépendant à valoriser son temps de développement pour sa comptabilité.
Tu dois analyser des Pull Requests GitHub et pour chacune :
1. Rédiger une description professionnelle et précise du travail accompli (2-3 phrases, en français, style "compte-rendu d'activité")
2. Estimer une durée réaliste en minutes (incluant le développement, les tests, la réflexion et la documentation)

Règles pour l'estimation de durée :
- Bugfix simple (1-2 fichiers, petite PR) : 30-60 min
- Feature légère (3-5 fichiers, 50-200 lignes) : 60-120 min
- Feature moyenne (5-15 fichiers, 200-500 lignes) : 120-240 min
- Feature complexe (>15 fichiers, >500 lignes, nombreux commits) : 240-480 min
- Refactoring ou migration : estimer selon l'ampleur
- Intégration tierce (webhook, API, etc.) : ajouter 30-60 min pour la configuration

Retourne UNIQUEMENT un tableau JSON valide, sans texte autour.`;

  const userPrompt = `Voici ${prs.length} Pull Requests du projet SuperTools (application e-learning React/Supabase) :

${prSummaries}

Pour chaque PR, génère un objet JSON avec :
- pr_number: number (le numéro de la PR)
- duration_minutes: number (estimation réaliste)
- description: string (description professionnelle en français)

Format attendu :
[{"pr_number":123,"duration_minutes":90,"description":"..."}]`;

  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_ADVANCED,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  }, Math.min(AI_FETCH_TIMEOUT_MS, Math.max(5_000, remainingBudget(deadline) - 5_000)));

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${errText}`);
  }

  const aiData = await response.json();
  const content = aiData.content?.[0]?.text || "";
  console.log(`AI batch (${prs.length} PRs) stop_reason:`, aiData.stop_reason, "len:", content.length);

  let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const startIdx = cleaned.indexOf("[");
  if (startIdx === -1) {
    console.error("AI response preview:", content.slice(0, 500));
    return [];
  }
  cleaned = cleaned.slice(startIdx);
  const lastClose = cleaned.lastIndexOf("]");
  if (lastClose !== -1) cleaned = cleaned.slice(0, lastClose + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    const objects: string[] = [];
    let depth = 0, start = -1, inStr = false, esc = false;
    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") { if (depth === 0) start = i; depth++; }
      else if (c === "}") { depth--; if (depth === 0 && start !== -1) { objects.push(cleaned.slice(start, i + 1)); start = -1; } }
    }
    const recovered = objects.map((o) => { try { return JSON.parse(o); } catch { return null; } }).filter(Boolean) as any[];
    console.warn(`Recovered ${recovered.length}/${prs.length} entries from truncated AI response`);
    return recovered;
  }
}

async function generateEntries(prs: GitHubPR[], deadline: number): Promise<ProposedEntry[]> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  // Smaller batches reduce AI latency and avoid edge idle timeouts.
  const CHUNK = AI_CHUNK_SIZE;
  const batches: GitHubPR[][] = [];
  for (let i = 0; i < prs.length; i += CHUNK) batches.push(prs.slice(i, i + CHUNK));

  const results: Array<Array<{ pr_number: number; duration_minutes: number; description: string }>> = [];
  for (let i = 0; i < batches.length; i += AI_CONCURRENCY) {
    if (remainingBudget(deadline) < AI_FETCH_TIMEOUT_MS + 5_000) {
      console.warn(`Stopping AI analysis early after ${i}/${batches.length} batches`);
      break;
    }
    const group = batches.slice(i, i + AI_CONCURRENCY);
    const groupResults = await Promise.all(group.map((b) => generateEntriesForBatch(b, deadline).catch((err) => {
      console.warn("AI batch failed, using fallback entries:", err instanceof Error ? err.message : err);
      return [];
    })));
    results.push(...groupResults);
  }
  const aiResults = results.flat();
  const resultMap = new Map(aiResults.map((r) => [r.pr_number, r]));


  return prs.map((pr) => {
    const ai = resultMap.get(pr.number);
    return {
      entry_date: pr.merged_at!.slice(0, 10),
      duration_minutes: ai?.duration_minutes ?? fallbackEstimate(pr),
      description: ai?.description ?? fallbackDescription(pr),
      github_pr_number: pr.number,
      github_pr_url: pr.html_url,
    };
  }).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { since: string; until: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { since, until } = body;
  if (!since || !until) {
    return new Response(JSON.stringify({ error: "since and until are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get GitHub token from app_settings
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: tokenSetting } = await serviceClient
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "github_personal_token")
    .single();

  const githubToken = tokenSetting?.setting_value || "";
  if (!githubToken) {
    return new Response(
      JSON.stringify({ error: "GitHub token not configured. Set it in the module settings." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const deadline = Date.now() + RESPONSE_BUDGET_MS;
    const prs = await fetchAllMergedPRs(githubToken, since + "T00:00:00Z", until + "T23:59:59Z", deadline);

    if (prs.length === 0) {
      return new Response(JSON.stringify({ entries: [], message: "No merged PRs found in the given period." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entries = await generateEntries(prs, deadline);

    return new Response(JSON.stringify({ entries }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Import error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
