# Vennora Ramonage — notes pour les agents

SaaS B2B de gestion des interventions techniques. Vertical actif : ramonage.
Interface entièrement en français, y compris les identifiants de routes
(`/clients`, `/equipements`, `/interventions/nouvelle`).

Lire `README.md` pour l'architecture et les choix techniques. Les points
ci-dessous sont ceux qu'on casse le plus facilement sans s'en apercevoir.

## Accès aux données

Toute lecture ou écriture métier passe par le contexte :

```ts
const { db, user, ctx } = await getPageContext("customer.view");   // pages
const { db, user, ctx } = await getActionContext("customer.create"); // actions
```

Le `db` retourné injecte `orgId` automatiquement. **Ne jamais importer
`prisma` depuis `@/lib/prisma` dans une page, une action ou un module
`core/data`** — ce client brut est réservé à l'authentification, au seed et à
`core/tenant.ts`.

Sur les créations, écrire quand même `orgId: ctx.orgId` : le typage Prisma
l'exige, et l'extension écrase toute valeur divergente.

## Énumérations

Importer depuis `@/core/enums`, jamais depuis `@/generated/prisma` — sauf pour
`Prisma` (namespace de types) et `PrismaClient`. Un import de valeur depuis le
client généré fait entrer tout le runtime Prisma dans le bundle navigateur.

Toute valeur ajoutée à une énumération de `schema.prisma` doit être reportée
dans `core/enums.ts`, sinon la compilation échoue (c'est voulu).

## Prisma

Version figée en **6.19.3**. Prisma 7 ne supporte pas MongoDB (plus de moteur
de requêtes, pas d'adaptateur Mongo publié). Après toute modification de
`prisma/schema.prisma` : `npm run db:generate`, **puis relancer `npm run dev`**.

Le serveur de développement garde en mémoire le client généré à son
démarrage : sans redémarrage, il ignore un champ ajouté (« Unknown field ») et
refuse une valeur d'énumération ajoutée (« Value 'X' not found in enum »). Les
scripts, eux, repartent d'un processus neuf et fonctionnent — d'où des erreurs
qui n'apparaissent que dans l'application, et jamais en ligne de commande.

Ajouter une valeur à une énumération existante demande en plus de **compléter
les documents déjà en base** : un champ requis absent d'un document fait
échouer sa lecture, et `@default` ne s'applique qu'à la création.

Aucune contrainte d'intégrité côté base. Les suppressions en cascade sont
écrites à la main dans les actions, dans l'ordre inverse des dépendances.

## Offres

`Organization.plan` décide des fonctionnalités servies. La matrice est dans
`src/core/plans.ts` et nulle part ailleurs.

Toute fonctionnalité payante se garde **des deux côtés** :

```ts
exigerFonctionnalite(context, "export");   // action ou route : refuse
autorise(user.org.plan, "export")          // page : ne rend pas le composant
```

Le composant `ZoneVerrouillee` ne reçoit qu'un décor. Ne jamais y passer de
données réelles en comptant sur le flou : c'est du CSS, ça se retire.

## Fichiers

Tout passe par `@/services/storage` : `storeFile`, `fileUrl`, `deleteFile`.
Ne jamais écrire dans `public/` — ce qui s'y trouve est servi sans aucun
contrôle, or il s'agit de photos de chantier et de signatures clients.

`storeFile` détermine le type par la **signature binaire**, pas par le
`Content-Type` annoncé ni par l'extension du nom de fichier, et n'accepte que
les catégories passées en second argument. Le nom d'origine ne sert jamais à
construire un chemin.

`fileUrl` renvoie un lien signé qui expire. L'audience par défaut est
`tenant` : une session de la bonne organisation est exigée en plus de la
signature. Réserver `public` aux destinataires sans compte — le rapport PDF
envoyé au client.

Obtenir une URL n'autorise rien : c'est à l'appelant d'avoir vérifié les
droits par une lecture cloisonnée avant d'appeler `fileUrl`.

## Verticaux

Le vocabulaire, les types d'équipement, les types d'intervention et les
sections du rapport appartiennent à `src/verticals/<metier>/`. Ne rien coder
en dur dans `src/core` ni dans `src/app` qui soit propre au ramonage.

## Interface

- Champs de saisie en `h-11` (44 px) : le technicien saisit au doigt.
- Libellés d'énumération dans `core/labels.ts`, jamais en dur dans un composant.
- Couleurs par jeton (`bg-severity-high`, `text-status-done`, `text-brand`),
  jamais de hex en dur, sauf pour les couleurs venant de la base (type
  d'intervention, technicien) qui passent par `style`.
- Tableau sur écran large, cartes sous 768 px. Pas de scroll horizontal de page.

## Vérifications avant de rendre la main

```bash
npm run typecheck && npm run lint && npm run build
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
