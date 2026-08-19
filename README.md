# Vennora Ramonage

**Gérez vos interventions. Maîtrisez vos équipements.**

SaaS B2B de gestion des interventions techniques. Premier vertical métier :
le **ramonage**.

Le produit tient en une chaîne :

```
Client → Site → Équipement → Intervention → Rapport → Historique
```

---

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseigner DATABASE_URL et AUTH_SECRET
npm run db:push             # crée les index MongoDB
npm run db:seed             # jeu de démonstration « Ramonage Cévennes »
npm run dev
```

### Variables indispensables

| Variable       | Rôle                                                             |
| -------------- | ---------------------------------------------------------------- |
| `DATABASE_URL` | URI MongoDB Atlas, **nom de base inclus** (`…mongodb.net/vennora`) |
| `AUTH_SECRET`  | `openssl rand -base64 32`                                        |

Les autres (S3, IA, e-mail) ont un mode dégradé et peuvent rester vides :
voir `.env.example`. La configuration est validée au démarrage par
`src/lib/env.ts` — une clé manquante fait échouer le boot plutôt que de
produire une erreur obscure à la première requête.

### Comptes de démonstration

| Rôle          | E-mail                          | Mot de passe  |
| ------------- | ------------------------------- | ------------- |
| Administrateur | `celine@ramonage-cevennes.fr`   | `vennora2026` |
| Technicien    | `ludovic@ramonage-cevennes.fr`  | `vennora2026` |

---

## Scripts

| Commande            | Effet                                            |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Serveur de développement                          |
| `npm run build`     | `prisma generate` puis build de production        |
| `npm run typecheck` | Vérification TypeScript sans émission             |
| `npm run lint`      | ESLint                                            |
| `npm run db:push`   | Applique le schéma Prisma à MongoDB               |
| `npm run db:seed`   | (Re)crée le jeu de démonstration                  |
| `npm run db:studio` | Prisma Studio                                     |

---

## Architecture

```
src/
├── app/
│   ├── (app)/           écrans authentifiés (dashboard, clients, planning…)
│   ├── connexion/       authentification
│   └── api/auth/        Auth.js
├── core/                cœur métier, indépendant de l'interface
│   ├── auth/            session, mots de passe, configuration Auth.js
│   ├── data/            requêtes de lecture, une par agrégat
│   ├── context.ts       point d'entrée unique de tout accès aux données
│   ├── tenant.ts        isolation multi-tenant
│   ├── permissions.ts   matrice de droits
│   ├── enums.ts         énumérations utilisables côté navigateur
│   └── schemas.ts       validation Zod, partagée client/serveur
├── verticals/           définition des métiers
│   ├── types.ts         contrat d'un métier
│   ├── ramonage/        le seul vertical actif
│   └── registry.ts      registre des métiers
├── components/
│   ├── ui/              shadcn/ui
│   ├── shell/           navigation, barre latérale, barre mobile
│   └── vennora/         composants métier partagés
├── services/            intégrations (QR codes, puis stockage, PDF, IA)
└── lib/                 env validé, client Prisma, formatage
```

### Ajouter un métier

Le cœur est agnostique. Un nouveau vertical se résume à :

1. écrire `src/verticals/<metier>/index.ts` (types d'équipement, types
   d'intervention, sections du rapport, vocabulaire) ;
2. l'enregistrer dans `src/verticals/registry.ts` avec `active: true` ;
3. relancer `npm run db:seed` — ou appeler `syncTradeCatalogs()` — pour
   projeter les catalogues en base.

Aucune modification de `src/core` ni de `src/app`.

---

## Isolation multi-tenant

Toutes les données sont cloisonnées par `Organization`. Le risque n'est pas
d'écrire un mauvais filtre, c'est d'en **oublier** un : un `findMany` sans
`orgId` compile et passe les tests sur un jeu mono-entreprise.

La possibilité de l'oublier a donc été supprimée. Une page ou une action
commence par :

```ts
const { db, user, ctx } = await getPageContext("customer.view");
```

Le `db` retourné est un client Prisma étendu qui injecte `orgId` dans le
`where` de chaque lecture et de chaque écriture. Le client brut (`lib/prisma`)
n'est utilisé que par l'authentification, le seed et `core/tenant.ts`.

Deux garde-fous complètent le dispositif :

- `getPageContext` / `getActionContext` **relisent l'utilisateur en base** à
  chaque requête (mémoïsé par requête). Un compte désactivé perd l'accès
  immédiatement, sans attendre l'expiration du jeton ;
- `src/proxy.ts` ne fait qu'une redirection optimiste. Le contrôle d'accès
  réel est dans les layouts et les Server Actions ; contourner le proxy ne
  donne accès à rien.

---

## Choix techniques notables

**MongoDB plutôt que PostgreSQL.** Conséquence assumée : aucune contrainte
d'intégrité ni cascade au niveau base. Les suppressions en cascade sont
écrites explicitement dans les actions, et une suppression est refusée dès
qu'elle emporterait un historique à valeur probante (interventions terminées,
rapports signés).

**Prisma figé en 6.19.3.** Prisma 7 a supprimé le moteur de requêtes au profit
d'adaptateurs, et il n'existe pas d'adaptateur MongoDB : la v7 ne supporte pas
MongoDB. Ne pas mettre à jour sans vérifier ce point.

**Énumérations dupliquées dans `core/enums.ts`.** Importer une constante
depuis le client Prisma généré entraîne tout son runtime dans le bundle
navigateur. Les valeurs sont redéclarées et confrontées au type Prisma :
ajouter une valeur au schéma sans la reporter casse la compilation.

**Recherche par expression régulière échappée.** Prisma traduit `contains` en
`$regex` sur MongoDB ; toute saisie utilisateur passe par `escapeSearch()`
avant d'atteindre la base.

**Jeton de QR code opaque et régénérable.** L'étiquette collée sur un appareil
ne porte jamais un identifiant de base. Elle est révocable sans toucher aux
données.

---

## État d'avancement

| Lot                                                   | État     |
| ----------------------------------------------------- | -------- |
| **P0** projet, base, authentification, multi-tenant, design system | ✅ fait |
| **P1** clients, sites, équipements, interventions, planning        | ✅ fait |
| **P2** interface terrain, QR codes, photos, anomalies, notes       | ✅ fait |
| **P3** signature, PDF, envoi par e-mail                            | ✅ fait |
| **P4** enregistrement vocal, transcription, compte-rendu assisté   | ✅ fait (fournisseurs simulés) |
| **P5** finitions, tests, permissions fines                         | partiel |

Le parcours du §29 est bouclé : client → site → équipement → intervention →
photos → dictée → compte-rendu → validation → signature → PDF → envoi →
historique.

Trois briques tournent en implémentation simulée tant qu'aucune clé n'est
fournie : la transcription vocale, la rédaction assistée et l'envoi
d'e-mails. Chacune est derrière une interface — voir `AI_PROVIDER`,
`TRANSCRIPTION_PROVIDER` et `MAIL_DRIVER` dans `.env.example`.

**Rédaction assistée.** `AI_PROVIDER=groq` branche un modèle ouvert servi par
Groq — `qwen/qwen3.6-27b` par défaut — avec le même contrat que l'adaptateur
Anthropic : les six sections sont imposées par un schéma JSON strict, pas
demandées dans le prompt.

Deux contraintes valent d'être connues avant de brancher ce modèle, l'une
comme l'autre mesurées :

- **le raisonnement du modèle est conservé, et il coûte onze secondes** par
  compte-rendu contre une seule sans lui. Il les vaut pour la fidélité aux
  notes : privé de réflexion, le modèle comble les trous — « tirage conforme
  aux normes » là où la note dit « tirage conforme », conseils d'entretien
  que personne n'a donnés. Avec, il écrit « l'étanchéité n'a pas été
  contrôlée lors de cette intervention ». Sur une pièce remise au client,
  dire ce qu'on n'a pas fait vaut mieux que meubler ;
- **le palier gratuit plafonne à 8 000 jetons par minute** pour ce modèle,
  budget de sortie demandé compris. Une génération en consomme environ 5 500 :
  au-delà d'une par minute, l'API répond 429 et l'interface propose de rédiger
  à la main.

**Dictée.** `TRANSCRIPTION_PROVIDER=groq` branche Whisper large v3 servi par
Groq, dont le palier gratuit suffit largement à une entreprise de terrain. La
route est compatible avec celle d'OpenAI : les deux fournisseurs partagent le
même adaptateur, changer revient à changer une ligne de configuration. Le
modèle par défaut est `whisper-large-v3` : mesurée sur une note française de
quinze secondes, la variante « turbo » ne rend rien d'exploitable pour trente
millisecondes gagnées. La langue est envoyée d'office (`fr`), et le vocabulaire
du métier est passé en amorce — « débistrage » ou « boisseau » ne sont pas
dans le vocabulaire courant d'un modèle généraliste.
