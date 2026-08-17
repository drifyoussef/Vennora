import { describe, expect, it } from "vitest";

import { assertSafeKey } from "@/services/storage/local";
import { signKey, verifyKey } from "@/services/storage/signing";
import { detect, validateUpload } from "@/services/storage/validate";
import { deleteFile, keyBelongsToOrg, readFileBytes, storeFile, fileUrl } from "@/services/storage";
import { ValidationError } from "@/core/errors";
import { bytes } from "./fixtures";

/**
 * Stockage de fichiers.
 *
 * Trois surfaces à protéger : ce qu'on accepte d'écrire (signature binaire),
 * où on l'écrit (traversée de chemin) et qui peut le relire (liens signés).
 */
describe("détection du type réel", () => {
  it("reconnaît les formats attendus", () => {
    expect(detect(bytes.jpeg)?.mime).toBe("image/jpeg");
    expect(detect(bytes.png)?.mime).toBe("image/png");
    expect(detect(bytes.webm)?.mime).toBe("audio/webm");
    expect(detect(bytes.pdf)?.mime).toBe("application/pdf");
  });

  it("refuse le HTML et le SVG", () => {
    // Le SVG est un vecteur de script : un technicien n'a aucune raison
    // d'en envoyer, on ne l'accepte donc jamais.
    expect(detect(bytes.html)).toBeNull();
    expect(detect(bytes.svg)).toBeNull();
  });

  it("ignore le type annoncé et se fie aux octets", () => {
    // Un HTML présenté comme une photo : c'est le cas qu'on veut bloquer.
    expect(() => validateUpload(bytes.html, ["image"])).toThrow(ValidationError);
  });

  it("refuse un fichier d'une catégorie non attendue à cet endroit", () => {
    expect(() => validateUpload(bytes.pdf, ["image"])).toThrow(ValidationError);
    expect(validateUpload(bytes.pdf, ["document"]).mime).toBe("application/pdf");
  });

  it("refuse un fichier vide", () => {
    expect(() => validateUpload(Buffer.alloc(0), ["image"])).toThrow(
      ValidationError,
    );
  });

  it("refuse au-delà du plafond de la catégorie", () => {
    const huge = Buffer.concat([bytes.jpeg, Buffer.alloc(13 * 1024 * 1024)]);
    expect(() => validateUpload(huge, ["image"])).toThrow(ValidationError);
  });
});

describe("traversée de chemin", () => {
  const hostiles = [
    "../secret",
    "org/x/../../etc/passwd",
    "/etc/passwd",
    "org\\x\\y",
    "org/x//y",
    "org/./x",
    "",
  ];

  for (const key of hostiles) {
    it(`refuse ${JSON.stringify(key)}`, () => {
      expect(() => assertSafeKey(key)).toThrow();
    });
  }

  it("accepte une clé normale", () => {
    expect(() =>
      assertSafeKey("org/abc/interventions/def/photo.jpg"),
    ).not.toThrow();
  });
});

describe("liens signés", () => {
  const key = "org/aaaaaaaaaaaaaaaaaaaaaaaa/interventions/bbb/photo.jpg";

  it("accepte une signature intacte", () => {
    const { exp, aud, sig } = signKey(key, 600, "tenant");
    expect(
      verifyKey(key, { exp: String(exp), aud, sig }).ok,
    ).toBe(true);
  });

  it("rejette une signature réutilisée pour une autre clé", () => {
    const { exp, aud, sig } = signKey(key, 600, "tenant");
    expect(
      verifyKey("org/zzz/interventions/bbb/photo.jpg", {
        exp: String(exp),
        aud,
        sig,
      }).ok,
    ).toBe(false);
  });

  it("rejette une expiration rallongée", () => {
    const { exp, aud, sig } = signKey(key, 600, "tenant");
    expect(
      verifyKey(key, { exp: String(exp + 86_400), aud, sig }).ok,
    ).toBe(false);
  });

  it("rejette une audience modifiée", () => {
    const { exp, sig } = signKey(key, 600, "tenant");
    expect(verifyKey(key, { exp: String(exp), aud: "public", sig }).ok).toBe(
      false,
    );
  });

  it("rejette une signature tronquée ou absente", () => {
    const { exp, aud, sig } = signKey(key, 600, "tenant");
    expect(verifyKey(key, { exp: String(exp), aud, sig: sig.slice(0, -2) }).ok).toBe(false);
    expect(verifyKey(key, { exp: null, aud: null, sig: null }).ok).toBe(false);
  });

  it("rejette un lien périmé, en le distinguant d'une forge", () => {
    const { exp, aud, sig } = signKey(key, -10, "tenant");
    const result = verifyKey(key, { exp: String(exp), aud, sig });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });
});

describe("écriture, relecture, suppression", () => {
  const orgId = "a".repeat(24);

  it("préfixe la clé par l'organisation et déduit l'extension des octets", async () => {
    const stored = await storeFile(
      {
        orgId,
        scope: "interventions",
        ownerId: "b".repeat(24),
        body: bytes.jpeg,
        contentType: "image/png", // mensonge délibéré
      },
      ["image"],
    );

    expect(stored.key.startsWith(`org/${orgId}/interventions/`)).toBe(true);
    expect(stored.key.endsWith(".jpg")).toBe(true);
    expect(stored.contentType).toBe("image/jpeg");
    expect(keyBelongsToOrg(stored.key, orgId)).toBe(true);
    expect(keyBelongsToOrg(stored.key, "0".repeat(24))).toBe(false);

    expect((await readFileBytes(stored.key)).equals(bytes.jpeg)).toBe(true);

    const url = await fileUrl(stored.key);
    expect(url).toContain("/api/fichiers/");
    expect(url).toContain("sig=");

    await deleteFile(stored.key);
    await expect(readFileBytes(stored.key)).rejects.toBeTruthy();
    // Une seconde suppression ne doit pas lever.
    await expect(deleteFile(stored.key)).resolves.toBeUndefined();
  });
});
