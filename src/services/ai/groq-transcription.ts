import "server-only";
import { env } from "@/lib/env";
import { createWhisperTranscription } from "./whisper-http";

/**
 * Reconnaissance vocale via Groq.
 *
 * Groq sert Whisper large v3 derrière une route compatible OpenAI, avec un
 * palier gratuit généreux — de quoi faire tourner la dictée d'une entreprise
 * de terrain sans engager de dépense.
 *
 * Le modèle par défaut est `whisper-large-v3`, et non la variante « turbo »
 * qu'on choisit d'ordinaire pour la vitesse : sur une note française de
 * quinze secondes, turbo n'a rendu aucun texte exploitable quand la version
 * complète transcrivait correctement, pour trente millisecondes d'écart. La
 * distillation se paie sur les langues autres que l'anglais.
 *
 * `GROQ_TRANSCRIPTION_MODEL` reste là pour en changer sans toucher au code.
 */
export const groqTranscription = createWhisperTranscription({
  name: "groq",
  endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
  model: env.GROQ_TRANSCRIPTION_MODEL,
  apiKey: env.GROQ_API_KEY,
});
