/**
 * Contrat de stockage de fichiers.
 *
 * Deux implémentations : disque local en développement, S3-compatible en
 * production. Le reste de l'application ne connaît que cette interface — elle
 * ne sait jamais où le fichier vit réellement, ni comment l'URL est signée.
 */

export type StorageScope =
  | "interventions"
  | "equipements"
  | "signatures"
  | "rapports"
  | "notes-vocales"
  | "documents"
  | "logos";

export interface PutFileInput {
  /** Toujours issu de la session serveur, jamais d'un champ de formulaire. */
  orgId: string;
  scope: StorageScope;
  /** Identifiant de l'objet porteur : intervention, équipement, organisation. */
  ownerId: string;
  body: Buffer;
  contentType: string;
  /** Nom d'origine, conservé pour l'affichage seulement. Jamais pour le chemin. */
  originalName?: string;
}

export interface StoredFile {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Qui peut ouvrir une URL signée.
 *
 * `tenant` — la signature ne suffit pas, une session de la bonne organisation
 * est aussi exigée. C'est le défaut : une URL qui traîne dans un historique de
 * navigateur ne doit rien ouvrir.
 *
 * `public` — la signature seule suffit. Réservé aux cas où le destinataire
 * n'a pas de compte : le rapport PDF envoyé par e-mail au client (P3).
 */
export type UrlAudience = "tenant" | "public";

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * URL temporaire. Le pilote local renvoie une route interne signée, le
   * pilote S3 une URL présignée : dans les deux cas, elle expire.
   */
  url(key: string, expiresInSeconds: number, audience: UrlAudience): Promise<string>;
}
