import type { SessionConfig, Message } from "./types";

export function buildSystemPrompt(agent: SessionConfig["agents"][0], config: SessionConfig): string {
  const modeInstr = {
    exploration: "Discussion ouverte et exploratoire.",
    decision: `Debat contradictoire. ${agent.stance === "pour" ? "Tu DEFENDS la position." : agent.stance === "contre" ? "Tu ATTAQUES la position." : "Tu es NEUTRE et analyses les deux cotes."}`,
    deliverable: "Discussion orientee vers la production d'un livrable concret. Concentre-toi sur les contributions constructives.",
  };

  // Rich expert context
  const expertContext: string[] = [];
  if (agent.frameworks && agent.frameworks.length > 0) {
    expertContext.push(`Tes frameworks et references : ${agent.frameworks.join(", ")}`);
  }
  if (agent.biases) {
    expertContext.push(`Tes biais connus (sois-en conscient) : ${agent.biases}`);
  }
  if (agent.style) {
    expertContext.push(`Ton style de communication : ${agent.style}`);
  }

  // Context files
  const filesContext = agent.contextFiles && agent.contextFiles.length > 0
    ? `\n\nDocuments de reference que tu as lu :\n${agent.contextFiles.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 8000)}`).join("\n\n")}`
    : "";

  return `Tu participes a une discussion de groupe sur le sujet suivant :
${config.topic}

${config.additionalContext ? `Contexte additionnel : ${config.additionalContext}` : ""}

Mode : ${modeInstr[config.mode]}

Ton role : ${agent.role || "Participant"}
Ta personnalite : ${agent.personality || "Neutre et constructif"}
${agent.stance ? `Ta position initiale : ${agent.stance}` : ""}
${expertContext.length > 0 ? `\n${expertContext.join("\n")}` : ""}

Regles de la discussion :
- LONGUEUR : Vise 250 a 400 mots maximum par intervention. Sois dense et percutant, pas exhaustif.
- TERMINE TOUJOURS tes idees -- mieux vaut 2 arguments complets que 5 inacheves. Conclus toujours proprement.
- REAGIS aux interventions precedentes : cite les noms des autres participants, dis si tu es d'accord ou non, et POURQUOI.
- NE REPETE PAS ce qui a ete dit. Si un point a deja ete fait, dis "comme l'a dit [nom]" et ajoute de la valeur.
- RELIE toujours tes points au SUJET CENTRAL de la discussion. Ne pars pas dans des tangentes.
- Structure ta reponse : commence par ta position claire, puis developpe 2-3 arguments cles. Pas de listes interminables.
- Adresse-toi directement aux autres participants par leur nom.
- Utilise tes frameworks de reference quand c'est pertinent, sans les forcer.
- Langue : ${config.rules.language === "fr" ? "francais" : "anglais"}${filesContext}`;
}

export function computeTokensPerAgent(messages: Message[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const msg of messages) {
    if (!msg.isUser && !msg.isSynthesis && !msg.isDeliverable && msg.tokenCount) {
      result[msg.agentId] = (result[msg.agentId] || 0) + msg.tokenCount;
    }
  }
  return result;
}
