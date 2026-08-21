import type { PrismaClient } from "@/generated/prisma";
import { z } from "zod";
import { hashPassword } from "./auth/hash";
import { syncTradeCatalogs } from "./catalog-sync";
import { UserRole } from "./enums";
import { password as passwordSchema } from "./schemas";
import { TRADES, type TradeSlug } from "@/verticals/registry";

/**
 * Création d'une organisation et de son premier administrateur.
 *
 * Seul endroit, avec l'authentification et le seed, à recevoir le client
 * Prisma brut — et pour une raison structurelle : le client cloisonné exige
 * un `orgId`, or c'est précisément l'organisation qu'on est en train de
 * créer. Il n'y a pas d'organisation courante à ce moment-là.
 *
 * Le module ne dépend ni de Next ni de `server-only` : il doit tourner depuis
 * un script en ligne de commande, qui est aujourd'hui la porte d'entrée d'un
 * nouveau client. Le jour où une inscription en libre-service existera, elle
 * appellera cette même fonction — la règle métier ne doit pas exister à deux
 * endroits.
 */
const schema = z.object({
  nom: z.string().trim().min(2, "Nom d'entreprise trop court.").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Le slug n'accepte que minuscules, chiffres et tirets.")
    .min(2)
    .max(60)
    .optional(),
  tradeSlug: z.string(),
  admin: z.object({
    prenom: z.string().trim().min(1, "Prénom requis.").max(80),
    nom: z.string().trim().min(1, "Nom requis.").max(80),
    email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
    motDePasse: passwordSchema,
  }),
  email: z.string().trim().toLowerCase().email().optional(),
  telephone: z.string().trim().max(30).optional(),
  adresse: z.string().trim().max(200).optional(),
  codePostal: z.string().trim().max(10).optional(),
  ville: z.string().trim().max(100).optional(),
  siret: z.string().trim().max(20).optional(),
});

export type NouvelleOrganisation = z.input<typeof schema>;

export interface OrganisationCreee {
  orgId: string;
  slug: string;
  nom: string;
  adminId: string;
  adminEmail: string;
}

/**
 * Construit un identifiant d'URL à partir du nom : « Ramonage Cévennes »
 * devient « ramonage-cevennes ». Les accents sont décomposés puis retirés,
 * faute de quoi « Cévennes » donnerait « cvennes ».
 */
export function slugify(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createOrganization(
  prisma: PrismaClient,
  entree: NouvelleOrganisation,
): Promise<OrganisationCreee> {
  const data = schema.parse(entree);

  const trade = TRADES[data.tradeSlug as TradeSlug];
  if (!trade) {
    throw new Error(
      `Métier inconnu : « ${data.tradeSlug} ». Connus : ${Object.keys(TRADES).join(", ")}.`,
    );
  }
  if (!trade.active) {
    throw new Error(
      `Le métier « ${trade.name} » n'a pas de catalogue : l'activer dans src/verticals avant de créer un client.`,
    );
  }

  // L'adresse e-mail est unique pour toute l'installation : la même personne
  // ne peut pas être administratrice de deux entreprises. Le dire ici plutôt
  // que de laisser remonter une violation d'index.
  const dejaPris = await prisma.user.findUnique({
    where: { email: data.admin.email },
    select: { id: true },
  });
  if (dejaPris) {
    throw new Error(`L'adresse ${data.admin.email} est déjà utilisée.`);
  }

  const slug = data.slug ?? slugify(data.nom);
  const collision = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (collision) {
    throw new Error(
      `Le slug « ${slug} » est déjà pris. En fournir un autre explicitement.`,
    );
  }

  // Les catalogues sont idempotents : les synchroniser ici garantit qu'une
  // entreprise créée sur une base neuve trouve ses types d'équipement.
  await syncTradeCatalogs(prisma);
  const tradeRecord = await prisma.trade.findUniqueOrThrow({
    where: { slug: trade.slug },
    select: { id: true },
  });

  const org = await prisma.organization.create({
    data: {
      name: data.nom,
      slug,
      tradeId: tradeRecord.id,
      email: data.email,
      phone: data.telephone,
      address: data.adresse,
      postalCode: data.codePostal,
      city: data.ville,
      siret: data.siret,
    },
    select: { id: true, slug: true, name: true },
  });

  const admin = await prisma.user.create({
    data: {
      orgId: org.id,
      firstName: data.admin.prenom,
      lastName: data.admin.nom,
      email: data.admin.email,
      passwordHash: await hashPassword(data.admin.motDePasse),
      role: UserRole.ADMIN,
    },
    select: { id: true, email: true },
  });

  return {
    orgId: org.id,
    slug: org.slug,
    nom: org.name,
    adminId: admin.id,
    adminEmail: admin.email,
  };
}
