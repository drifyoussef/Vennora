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
  /** Identifiant du message, quand le serveur en donne un. */
  id: string | null;
}
