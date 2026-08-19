import "server-only";
import { AppError } from "@/core/errors";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

/**
 * Transcription par une API compatible Whisper d'OpenAI.
 *
 * OpenAI et Groq exposent la même route multipart, les mêmes champs et la
 * même réponse : seuls l'hôte, le modèle et la clé changent. Une fabrique
 * plutôt que deux fichiers presque identiques — la correction d'un cas limite
 * profite alors aux deux.
 *
 * Appel HTTP direct : une requête multipart ne justifie pas d'embarquer un
 * SDK. La clé ne quitte jamais le serveur ; l'audio monte du navigateur vers
 * Vennora, et c'est Vennora qui appelle le service.
 */
function extensionFor(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export function createWhisperTranscription(config: {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string | undefined;
}): TranscriptionProvider {
  return {
    name: config.name,
    configured: Boolean(config.apiKey),

    async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
        `note.${extensionFor(input.mimeType)}`,
      );
      form.append("model", config.model);
      // La langue est connue d'avance : l'indiquer gagne en précision et en
      // latence, le modèle n'ayant plus à la deviner sur les premières
      // secondes — souvent du bruit de chantier.
      form.append("language", input.language ?? "fr");
      form.append("response_format", "json");

      // Le vocabulaire métier — « débistrage », « boisseau », les marques —
      // n'est pas dans le vocabulaire courant d'un modèle généraliste.
      if (input.vocabulary && input.vocabulary.length > 0) {
        form.append("prompt", input.vocabulary.join(", "));
      }

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
      });

      if (!response.ok) {
        // Le corps peut contenir des détails de compte : il reste dans les
        // journaux du serveur, l'utilisateur reçoit un message neutre.
        console.error(
          `[vennora] échec de transcription (${config.name})`,
          response.status,
          await response.text().catch(() => ""),
        );

        // Deux cas méritent un message qui dit quoi faire, plutôt que
        // « réessayez » : le quota d'un palier gratuit et la note trop longue.
        if (response.status === 429) {
          throw new AppError(
            "Le quota de transcription est atteint pour le moment. Réessayez plus tard ou saisissez le texte à la main.",
            "TRANSCRIPTION_QUOTA",
            429,
          );
        }
        if (response.status === 413) {
          throw new AppError(
            "Cette note vocale est trop longue pour être transcrite. Découpez-la en plusieurs notes.",
            "TRANSCRIPTION_TOO_LARGE",
            413,
          );
        }

        throw new AppError(
          "La transcription a échoué. Réessayez ou saisissez le texte à la main.",
          "TRANSCRIPTION_FAILED",
          502,
        );
      }

      const data = (await response.json()) as { text?: string };
      return { text: (data.text ?? "").trim(), provider: config.name };
    },
  };
}
