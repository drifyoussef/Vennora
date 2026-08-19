import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/core/errors";
import { REPORT_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ReportContext, ReportGeneration, ReportGenerator } from "./types";

/**
 * Rédaction assistée par un modèle ouvert servi par Groq.
 *
 * Même contrat que l'adaptateur Anthropic : le schéma des six sections est
 * imposé côté API — `json_schema` en mode strict, vérifié disponible sur ce
 * modèle — plutôt que demandé dans le prompt. Le parsage ne peut donc pas
 * échouer sur un modèle qui aurait ajouté une phrase d'introduction.
 *
 * Le modèle raisonne avant de répondre ; Groq place cette réflexion dans un
 * champ séparé, `reasoning`, et laisse le contenu propre. On ne le lit pas :
 * ce qui compte est le compte-rendu, et il n'a rien à faire dans un document
 * remis à un client.
 *
 * Le raisonnement est conservé, et il coûte cher : mesuré sur une note de
 * chantier, onze secondes contre une seule avec `reasoning_effort: "none"`.
 * Il les vaut, pour une raison qui compte ici plus qu'ailleurs — la fidélité
 * aux notes. Sans réflexion, le modèle comble les trous : il écrit « tirage
 * conforme aux normes » là où la note dit seulement « tirage conforme », et
 * ajoute des conseils d'entretien que personne n'a donnés. Avec, il écrit
 * « l'étanchéité n'a pas été contrôlée lors de cette intervention » et
 * « aucun travail supplémentaire n'est documenté par les notes ». Sur une
 * pièce remise au client, dire ce qu'on n'a pas fait vaut mieux que meubler.
 *
 * D'où le budget de sortie : la réflexion consomme à elle seule plusieurs
 * milliers de jetons. À 4 000, elle épuisait le budget avant d'écrire la
 * moindre ligne, et l'API rejetait la réponse vide au motif qu'elle ne
 * respectait pas le schéma — une erreur incompréhensible pour qui n'a pas
 * mesuré.
 */
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface ChatResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
  }>;
}

export const groqGenerator: ReportGenerator = {
  name: "groq",
  configured: Boolean(env.GROQ_API_KEY),

  async generate(context: ReportContext): Promise<ReportGeneration> {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        // Le palier gratuit de Groq plafonne à 8 000 jetons par minute pour
        // ce modèle, **budget de sortie demandé compris** : réclamer 10 000
        // fait rejeter la requête avant même qu'elle soit traitée. 6 000
        // laisse la place au prompt tout en couvrant largement la réflexion,
        // mesurée autour de 4 400 jetons sur une note de chantier.
        max_completion_tokens: 6000,
        // Un compte-rendu d'intervention n'est pas un exercice de style : on
        // veut la même sortie pour les mêmes notes, deux fois de suite.
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(context) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "compte_rendu",
            strict: true,
            schema: REPORT_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const corps = await response.text().catch(() => "");
      console.error("[vennora] échec de rédaction (groq)", response.status, corps);

      // Réponse vide ou hors schéma : l'API la rejette avec un message qui
      // parle de prompt, alors que la cause est presque toujours un budget de
      // sortie épuisé par la réflexion du modèle.
      if (corps.includes("json_validate_failed")) {
        throw new AppError(
          "Le modèle n'a pas produit de compte-rendu exploitable. Réessayez, ou rédigez-le à la main.",
          "AI_INVALID_OUTPUT",
          502,
        );
      }
      // Le plafond par minute remonte en 429 comme en 413 selon qu'il est
      // atteint ou dépassé d'emblée : même cause, même message.
      if (
        response.status === 429 ||
        corps.includes("rate_limit_exceeded")
      ) {
        throw new AppError(
          "Le quota de rédaction assistée est atteint. Réessayez dans une minute, ou rédigez le compte-rendu à la main.",
          "AI_QUOTA",
          429,
        );
      }
      throw new AppError(
        "Le service de rédaction n'a pas répondu. Réessayez ou rédigez manuellement.",
        "AI_UNAVAILABLE",
        502,
      );
    }

    const data = (await response.json()) as ChatResponse;
    const choix = data.choices?.[0];
    const text = choix?.message?.content ?? "";

    // Une réponse tronquée est un JSON invalide : le dire clairement plutôt
    // que de laisser échouer le parsage sur une accolade manquante.
    if (choix?.finish_reason === "length") {
      throw new AppError(
        "Le compte-rendu généré a été tronqué. Réduisez les notes ou rédigez manuellement.",
        "AI_TRUNCATED",
        502,
      );
    }
    if (!text.trim()) {
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
      provider: "groq",
      model: env.GROQ_MODEL,
    };
  },
};
