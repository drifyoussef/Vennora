/**
 * Crée une entreprise cliente et son premier administrateur.
 *
 *   npm run org:create -- --nom "Ramonage du Gard" --admin-email celine@…
 *
 * C'est aujourd'hui la porte d'entrée d'un nouveau client : il n'existe pas
 * d'inscription en libre-service, et c'est délibéré tant qu'il n'y a ni
 * vérification d'adresse ni limitation des créations. Le jour où elle
 * existera, elle appellera la même fonction `createOrganization`.
 *
 * Le mot de passe est demandé en argument ou tiré au sort ; il n'est affiché
 * qu'une fois, à la création.
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { createOrganization } from "../src/core/onboarding";

config({ path: ".env", quiet: true });

function arg(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Mot de passe lisible au téléphone : pas de I/l/O/0 à confondre. */
function motDePasseAleatoire(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const octets = randomBytes(18);
  return Array.from(octets, (o) => alphabet[o % alphabet.length])
    .join("")
    .replace(/(.{6})(?=.)/g, "$1-");
}

async function main() {
  const nom = arg("nom");
  const adminEmail = arg("admin-email");
  if (!nom || !adminEmail) {
    console.error(
      [
        "Usage :",
        '  npm run org:create -- --nom "Ramonage du Gard" --admin-email celine@exemple.fr \\',
        '       [--admin-prenom Céline] [--admin-nom Mazel] [--metier ramonage] \\',
        "       [--mot-de-passe …] [--slug …] [--ville …] [--siret …]",
      ].join("\n"),
    );
    process.exit(1);
  }

  const motDePasse = arg("mot-de-passe") ?? motDePasseAleatoire();
  const prisma = new PrismaClient();

  try {
    const org = await createOrganization(prisma, {
      nom,
      slug: arg("slug"),
      tradeSlug: arg("metier") ?? "ramonage",
      admin: {
        prenom: arg("admin-prenom") ?? "Admin",
        nom: arg("admin-nom") ?? nom,
        email: adminEmail,
        motDePasse,
      },
      email: arg("email"),
      telephone: arg("telephone"),
      adresse: arg("adresse"),
      codePostal: arg("code-postal"),
      ville: arg("ville"),
      siret: arg("siret"),
    });

    console.log(
      [
        "",
        "  Entreprise créée",
        `    Nom            ${org.nom}`,
        `    Identifiant    ${org.slug}`,
        `    Métier         ${arg("metier") ?? "ramonage"}`,
        "",
        "  Administrateur",
        `    E-mail         ${org.adminEmail}`,
        `    Mot de passe   ${motDePasse}`,
        "",
        "  Ce mot de passe ne sera plus affiché. À transmettre au client, qui",
        "  peut le changer depuis son profil.",
        "",
      ].join("\n"),
    );
  } catch (e) {
    console.error(`\n  Échec : ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
