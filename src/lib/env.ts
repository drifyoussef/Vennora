import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement validées au démarrage.
 *
 * Une clé manquante doit faire échouer le boot, pas produire un `undefined`
 * qui remonte trois couches plus loin sous forme de 500 incompréhensible.
 * Ce module est `server-only` : aucune de ces valeurs ne doit fuiter dans le
 * bundle client. Les seules variables exposées au navigateur sont les
 * `NEXT_PUBLIC_*`, déclarées à part.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),

  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET doit faire au moins 32 caractères (openssl rand -base64 32)"),
  AUTH_URL: z.string().url().optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("eu-west-3"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  TRANSCRIPTION_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),

  MAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  MAIL_FROM: z.string().default("Vennora <ne-pas-repondre@vennora.app>"),
  RESEND_API_KEY: z.string().optional(),
});

function load() {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")} — ${i.message}`)
      .join("\n");
    throw new Error(
      `Configuration d'environnement invalide :\n${details}\n\nVoir .env.example.`,
    );
  }

  const env = parsed.data;

  // Cohérences inter-variables : mieux vaut échouer au boot qu'au premier
  // upload en production.
  if (env.STORAGE_DRIVER === "s3") {
    const missing = (
      ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const
    ).filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(
        `STORAGE_DRIVER=s3 mais ${missing.join(", ")} manquant(e)(s).`,
      );
    }
  }
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    throw new Error("AI_PROVIDER=anthropic mais ANTHROPIC_API_KEY manquant.");
  }
  if (env.TRANSCRIPTION_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    throw new Error("TRANSCRIPTION_PROVIDER=openai mais OPENAI_API_KEY manquant.");
  }
  if (env.MAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
    throw new Error("MAIL_DRIVER=resend mais RESEND_API_KEY manquant.");
  }

  return env;
}

export const env = load();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
