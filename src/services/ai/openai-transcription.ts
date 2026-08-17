import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/core/errors";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

/**
 * Reconnaissance vocale via l'API de transcription d'OpenAI.
 *
 * Fournisseur tiers assumé : Anthropic ne fait pas de speech-to-text. Appel
 * HTTP direct plutôt que le SDK OpenAI — une seule requête multipart, ce
 * n'est pas la peine d'embarquer une dépendance complète pour ça.
 *
 * La clé ne quitte jamais le serveur : l'audio est téléversé par le
 * navigateur vers Vennora, et c'est Vennora qui appelle le service.
 */
const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const MODEL = "whisper-1";

function extensionFor(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

export const openaiTranscription: TranscriptionProvider = {
  name: "openai",
  configured: Boolean(env.OPENAI_API_KEY),

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      `note.${extensionFor(input.mimeType)}`,
    );
    form.append("model", MODEL);
    form.append("language", input.language ?? "fr");
    form.append("response_format", "json");

    // Le vocabulaire métier — « débistrage », « boisseau », les marques —
    // n'est pas dans le vocabulaire courant d'un modèle généraliste.
    if (input.vocabulary && input.vocabulary.length > 0) {
      form.append("prompt", input.vocabulary.join(", "));
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });

    if (!response.ok) {
      // Le corps de la réponse peut contenir des détails de compte : on
      // journalise côté serveur et on renvoie un message neutre.
      console.error(
        "[vennora] échec de transcription",
        response.status,
        await response.text().catch(() => ""),
      );
      throw new AppError(
        "La transcription a échoué. Réessayez ou saisissez le texte à la main.",
        "TRANSCRIPTION_FAILED",
        502,
      );
    }

    const data = (await response.json()) as { text?: string };
    return { text: (data.text ?? "").trim(), provider: "openai" };
  },
};
