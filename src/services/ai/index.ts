import "server-only";
import { env } from "@/lib/env";
import { mockGenerator, mockTranscription } from "./mock";
import type { ReportGenerator, TranscriptionProvider } from "./types";

/**
 * Sélection des fournisseurs, d'après la configuration.
 *
 * Import différé des adaptateurs réels : sans clé, ni le SDK Anthropic ni le
 * code d'appel OpenAI n'entrent dans le bundle serveur.
 */

let generator: ReportGenerator | null = null;
let transcriber: TranscriptionProvider | null = null;

export async function getReportGenerator(): Promise<ReportGenerator> {
  if (generator) return generator;

  if (env.AI_PROVIDER === "groq") {
    const { groqGenerator } = await import("./groq-generator");
    generator = groqGenerator;
  } else if (env.AI_PROVIDER === "anthropic") {
    const { anthropicGenerator } = await import("./anthropic");
    generator = anthropicGenerator;
  } else {
    generator = mockGenerator;
  }
  return generator;
}

export async function getTranscriptionProvider(): Promise<TranscriptionProvider> {
  if (transcriber) return transcriber;

  if (env.TRANSCRIPTION_PROVIDER === "groq") {
    const { groqTranscription } = await import("./groq-transcription");
    transcriber = groqTranscription;
  } else if (env.TRANSCRIPTION_PROVIDER === "openai") {
    const { openaiTranscription } = await import("./openai-transcription");
    transcriber = openaiTranscription;
  } else {
    transcriber = mockTranscription;
  }
  return transcriber;
}

/** Vrai quand un vrai modèle est branché — l'interface le signale. */
export const aiIsLive = env.AI_PROVIDER !== "mock";
export const transcriptionIsLive = env.TRANSCRIPTION_PROVIDER !== "mock";

export type {
  ReportContext,
  ReportGeneration,
  ReportGenerator,
  ReportSections,
  TranscriptionProvider,
} from "./types";
