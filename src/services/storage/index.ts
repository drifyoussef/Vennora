import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { localDriver } from "./local";
import { validateUpload, type FileCategory } from "./validate";
import type { PutFileInput, StoredFile, StorageDriver, UrlAudience } from "./types";

/**
 * Point d'entrée du stockage de fichiers.
 *
 * L'application appelle `storeFile`, `fileUrl` et `deleteFile` ; elle ignore
 * si le fichier est sur un disque ou dans un bucket.
 */

let cached: StorageDriver | null = null;

/**
 * Pilote actif, chargé à la demande.
 *
 * L'import du pilote S3 est différé pour que le SDK AWS — plusieurs
 * mégaoctets — n'entre pas dans le bundle serveur quand
 * `STORAGE_DRIVER=local`, c'est-à-dire pendant tout le développement.
 */
export async function getStorage(): Promise<StorageDriver> {
  if (cached) return cached;

  if (env.STORAGE_DRIVER === "s3") {
    const { s3Driver } = await import("./s3");
    cached = s3Driver;
  } else {
    cached = localDriver;
  }
  return cached;
}

/** Dix minutes : le temps d'afficher une galerie, pas d'archiver un lien. */
const DEFAULT_URL_TTL = 600;

/**
 * Construit la clé de stockage.
 *
 * L'organisation est en tête du chemin : les fichiers d'une entreprise sont
 * regroupés, ce qui rend une purge de compte triviale et rend visible, à la
 * simple lecture d'une clé, à qui appartient le fichier.
 *
 * Le nom est un UUID, jamais le nom d'origine : celui-ci vient du téléphone
 * du technicien et peut contenir n'importe quoi — accents, séparateurs,
 * caractères de contrôle, ou le nom d'un autre client.
 */
function buildKey(
  orgId: string,
  scope: string,
  ownerId: string,
  ext: string,
): string {
  return `org/${orgId}/${scope}/${ownerId}/${randomUUID()}.${ext}`;
}

/**
 * Valide puis enregistre un fichier.
 *
 * Le type retenu est celui que la signature binaire confirme, pas celui que
 * le navigateur annonce : c'est aussi lui qui détermine l'extension et le
 * `Content-Type` renvoyé plus tard.
 */
export async function storeFile(
  input: PutFileInput,
  accept: FileCategory[],
): Promise<StoredFile> {
  const detected = validateUpload(input.body, accept);
  const key = buildKey(input.orgId, input.scope, input.ownerId, detected.ext);

  const driver = await getStorage();
  await driver.put(key, input.body, detected.mime);

  return {
    key,
    contentType: detected.mime,
    sizeBytes: input.body.length,
  };
}

/**
 * URL temporaire d'un fichier.
 *
 * Appeler cette fonction n'autorise rien : c'est à l'appelant d'avoir déjà
 * vérifié, par une lecture en base cloisonnée par organisation, que
 * l'utilisateur a le droit de voir ce fichier.
 */
export async function fileUrl(
  key: string,
  options: { expiresIn?: number; audience?: UrlAudience } = {},
): Promise<string> {
  const driver = await getStorage();
  return driver.url(
    key,
    options.expiresIn ?? DEFAULT_URL_TTL,
    options.audience ?? "tenant",
  );
}

export async function readFileBytes(key: string): Promise<Buffer> {
  const driver = await getStorage();
  return driver.get(key);
}

/**
 * Supprime un fichier. Ne lève jamais.
 *
 * Un fichier orphelin coûte quelques kilo-octets ; une suppression qui échoue
 * au milieu d'une opération métier laisse la base incohérente. On privilégie
 * la cohérence de la base et on journalise l'échec.
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    const driver = await getStorage();
    await driver.delete(key);
  } catch (e) {
    console.error(`[vennora] suppression de fichier impossible : ${key}`, e);
  }
}

export async function deleteFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map(deleteFile));
}

/** Vérifie que la clé appartient bien à l'organisation indiquée. */
export function keyBelongsToOrg(key: string, orgId: string): boolean {
  return key.startsWith(`org/${orgId}/`);
}

export { validateUpload, MAX_SIZE, formatSize } from "./validate";
export type { FileCategory } from "./validate";
export type { StoredFile, StorageScope, UrlAudience } from "./types";
