import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { AppError } from "@/core/errors";
import { REPORT_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ReportContext, ReportGeneration, ReportGenerator } from "./types";

/**
 * Rédaction assistée par Claude.
 *
 * Sorties structurées plutôt que « réponds en JSON » dans le prompt : le
 * schéma est contraint côté API, donc le parsage ne peut pas échouer sur un
 * modèle qui aurait ajouté une phrase d'introduction.
 *
 * Pensée adaptative : la tâche demande de trier des notes décousues, de
 * distinguer ce qui a été fait de ce qui a été constaté, et de refuser
 * d'inventer le reste. Ce n'est pas de la reformulation à plat.
 */
const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const anthropicGenerator: ReportGenerator = {
  name: "anthropic",
  configured: Boolean(env.ANTHROPIC_API_KEY),

  async generate(context: ReportContext): Promise<ReportGeneration> {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: REPORT_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [{ role: "user", content: buildUserPrompt(context) }],
    });

    // Un refus arrive en HTTP 200 avec un contenu vide : lire content[0]
    // sans vérifier `stop_reason` planterait sur un cas parfaitement normal.
    if (response.stop_reason === "refusal") {
      throw new AppError(
        "La génération a été refusée pour ce contenu. Rédigez le compte-rendu manuellement.",
        "AI_REFUSAL",
        422,
      );
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!text) {
      throw new AppError(
        "Le modèle n'a rien renvoyé. Réessayez ou rédigez manuellement.",
        "AI_EMPTY",
        502,
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AppError(
        "Réponse illisible du service de rédaction.",
        "AI_PARSE",
        502,
      );
    }

    const section = (key: string) =>
      typeof parsed[key] === "string" ? (parsed[key] as string).trim() : "";

    return {
      summary: section("summary"),
      workDone: section("workDone"),
      equipmentState: section("equipmentState"),
      anomaliesSummary: section("anomaliesSummary"),
      recommendations: section("recommendations"),
      futureWork: section("futureWork"),
      provider: "anthropic",
      model: MODEL,
    };
  },
};
