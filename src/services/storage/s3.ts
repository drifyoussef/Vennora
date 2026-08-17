import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { assertSafeKey } from "./local";
import { signKey } from "./signing";
import type { StorageDriver } from "./types";

/**
 * Stockage S3-compatible : AWS S3, Scaleway, OVH, MinIO, Cloudflare R2.
 *
 * `S3_ENDPOINT` et `S3_FORCE_PATH_STYLE` couvrent les fournisseurs qui ne
 * reconnaissent pas les URLs à sous-domaine de bucket — c'est le cas de MinIO
 * en local et de la plupart des installations auto-hébergées.
 *
 * Les identifiants ne quittent jamais le serveur : le navigateur ne reçoit
 * que des URLs présignées à durée limitée.
 */
let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  client = new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function bucket(): string {
  return env.S3_BUCKET!;
}

async function toBuffer(body: unknown): Promise<Buffer> {
  // `transformToByteArray` est fourni par le SDK sur toutes les plateformes.
  const stream = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof stream?.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }
  throw new Error("Réponse S3 illisible.");
}

export const s3Driver: StorageDriver = {
  name: "s3",

  async put(key, body, contentType) {
    assertSafeKey(key);
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        // Aucun objet public : l'accès passe exclusivement par une URL
        // présignée émise après contrôle des droits.
        ACL: "private",
      }),
    );
  },

  async get(key) {
    assertSafeKey(key);
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return toBuffer(result.Body);
  },

  async delete(key) {
    assertSafeKey(key);
    await getClient().send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
    );
  },

  async exists(key) {
    assertSafeKey(key);
    try {
      await getClient().send(
        new HeadObjectCommand({ Bucket: bucket(), Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  },

  /**
   * S3 ne connaît pas notre notion d'audience : une URL présignée est un
   * porteur de droit, point. On passe donc toujours par la route interne, qui
   * applique le contrôle « tenant » puis redirige vers l'URL présignée. Les
   * liens `public` (rapport envoyé par e-mail, P3) pointent directement sur S3.
   */
  async url(key, expiresInSeconds, audience) {
    assertSafeKey(key);

    if (audience === "tenant") {
      const { exp, aud, sig } = signKey(key, expiresInSeconds, audience);
      const params = new URLSearchParams({ exp: String(exp), aud, sig });
      return `/api/fichiers/${key}?${params}`;
    }

    return getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: expiresInSeconds },
    );
  },
};
