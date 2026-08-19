import "server-only";
import { env } from "@/lib/env";
import { createWhisperTranscription } from "./whisper-http";

/**
 * Reconnaissance vocale via l'API d'OpenAI.
 *
 * Fournisseur tiers assumé : Anthropic ne fait pas de reconnaissance vocale.
 * Conservé à côté de Groq — même route, même contrat — pour qu'un changement
 * de fournisseur reste une ligne de configuration.
 */
export const openaiTranscription = createWhisperTranscription({
  name: "openai",
  endpoint: "https://api.openai.com/v1/audio/transcriptions",
  model: "whisper-1",
  apiKey: env.OPENAI_API_KEY,
});
