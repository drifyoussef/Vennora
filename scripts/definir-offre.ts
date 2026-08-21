/**
 * Change l'offre souscrite par une entreprise.
 *
 *   npm run org:plan -- --slug ramonage-cevennes --offre PRO
 *
 * Volontairement hors de l'application : ouvrir une fonctionnalité payante
 * est une décision commerciale, elle ne doit pas être à portée de clic d'un
 * administrateur client. Le jour où un paiement en ligne existera, c'est lui
 * qui appellera ce chemin.
 */
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { Plan } from "../src/core/enums";
import { libelleOffre, utilisateursInclus } from "../src/core/plans";

config({ path: ".env", quiet: true });

function arg(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const slug = arg("slug");
  const offre = arg("offre")?.toUpperCase();
  const prisma = new PrismaClient();

  try {
    if (!slug) {
      const orgs = await prisma.organization.findMany({
        select: { slug: true, name: true, plan: true, _count: { select: { users: true } } },
        orderBy: { name: "asc" },
      });
      console.log("\n  Entreprises\n");
      for (const o of orgs) {
        console.log(
          `    ${o.slug.padEnd(30)} ${libelleOffre(o.plan).padEnd(12)} ${o._count.users} utilisateur(s)  — ${o.name}`,
        );
      }
      console.log("\n  Pour changer : npm run org:plan -- --slug <slug> --offre PRO\n");
      return;
    }

    if (!offre || !(offre in Plan)) {
      console.error(
        `\n  Offre inconnue. Valeurs possibles : ${Object.keys(Plan).join(", ")}.\n`,
      );
      process.exitCode = 1;
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, plan: true, _count: { select: { users: true } } },
    });
    if (!org) {
      console.error(`\n  Aucune entreprise « ${slug} ».\n`);
      process.exitCode = 1;
      return;
    }

    const nouvelle = offre as Plan;
    await prisma.organization.update({ where: { id: org.id }, data: { plan: nouvelle } });

    console.log(
      [
        "",
        `  ${org.name}`,
        `    ${libelleOffre(org.plan)} → ${libelleOffre(nouvelle)}`,
        "",
      ].join("\n"),
    );

    // Rétrograder une entreprise qui a plus d'utilisateurs que l'offre n'en
    // comprend ne casse rien — personne n'est déconnecté — mais il faut le
    // savoir avant que le client s'en aperçoive sur sa facture.
    const inclus = utilisateursInclus(nouvelle);
    if (org._count.users > inclus) {
      console.log(
        `  Attention : ${org._count.users} utilisateurs pour ${inclus} compris dans l'offre.\n`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
