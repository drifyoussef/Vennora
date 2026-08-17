import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/core/errors";

/**
 * Envoi d'e-mails.
 *
 * Deux pilotes : « console » en développement, qui journalise le message au
 * lieu de l'envoyer, et Resend en production. Le pilote console est le défaut
 * — envoyer de vrais e-mails à de vrais clients depuis une machine de
 * développement est le genre d'accident qu'on ne rattrape pas.
 */

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string[];
  subject: string;
  /** Corps en texte brut. Toujours fourni, même quand `html` l'est aussi. */
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

export interface MailResult {
  driver: string;
  /** Identifiant du fournisseur, quand il en donne un. */
  id: string | null;
}

async function sendViaConsole(message: MailMessage): Promise<MailResult> {
  console.info(
    [
      "",
      "──────────── E-MAIL (pilote console) ────────────",
      `À        : ${message.to.join(", ")}`,
      `Objet    : ${message.subject}`,
      message.replyTo ? `Répondre : ${message.replyTo}` : null,
      message.attachments?.length
        ? `Pièces   : ${message.attachments.map((a) => `${a.filename} (${a.content.length} o)`).join(", ")}`
        : null,
      "─────────────────────────────────────────────────",
      message.text,
      "─────────────────────────────────────────────────",
      "",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  );
  return { driver: "console", id: null };
}

async function sendViaResend(message: MailMessage): Promise<MailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      reply_to: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        content_type: a.contentType,
      })),
    }),
  });

  if (!response.ok) {
    console.error(
      "[vennora] échec d'envoi d'e-mail",
      response.status,
      await response.text().catch(() => ""),
    );
    throw new AppError(
      "L'envoi de l'e-mail a échoué. Réessayez dans un instant.",
      "MAIL_FAILED",
      502,
    );
  }

  const data = (await response.json()) as { id?: string };
  return { driver: "resend", id: data.id ?? null };
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (message.to.length === 0) {
    throw new AppError("Aucun destinataire.", "MAIL_NO_RECIPIENT", 422);
  }
  return env.MAIL_DRIVER === "resend"
    ? sendViaResend(message)
    : sendViaConsole(message);
}

export const mailIsLive = env.MAIL_DRIVER !== "console";
