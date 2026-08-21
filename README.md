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
| `npm run org:create`| Crée une entreprise cliente et son administrateur |
| `npm run user:password`| Réinitialise le mot de passe d'un utilisateur      |
| `npm run org:plan`  | Affiche ou change l'offre d'une entreprise         |
| `npm run db:studio` | Prisma Studio                                     |

---

## Embarquer un client

Il n'existe pas d'inscription en libre-service, et c'est délibéré tant qu'il
n'y a ni vérification d'adresse ni limitation des créations. Une entreprise se
crée en ligne de commande :

```bash
npm run org:create -- --nom "Ramonage du Gard" \
    --admin-email celine@ramonage-du-gard.fr \
    --admin-prenom Céline --admin-nom Mazel --ville Nîmes
```

Le mot de passe est tiré au sort et affiché **une seule fois** — sauf si
`--mot-de-passe` en impose un. Le client le change ensuite depuis son profil.
La commande synchronise les catalogues métier au passage : l'entreprise créée
trouve ses types d'équipement dès la première intervention.

La règle métier vit dans `src/core/onboarding.ts`. Le jour où une inscription
en libre-service existera, elle appellera la même fonction — pas une copie.

**Reprise du fichier clients.** Un nouveau client arrive avec un tableur :
`/clients/import` lit un CSV — point-virgule, accents Windows-1252 et marque
d'ordre d'octets compris — montre ce qu'il a compris, puis écrit sur
validation. L'opération est idempotente sur le couple nom + code postal :
relancée, elle n'ajoute rien.

**Mot de passe perdu.** Un administrateur réinitialise celui de ses
techniciens depuis l'application. Pour l'administrateur unique qui perd le
sien, il reste la ligne de commande :

```bash
npm run user:password -- --email celine@ramonage-cevennes.fr [--reactiver]
```

**Export des données.** `Paramètres → Vos données` construit à la demande une
archive ZIP : six fichiers CSV lisibles dans un tableur, les rapports PDF
signés, et un fichier de lecture. Rien n'est stocké au passage.

---

## Offres

`Organization.plan` porte l'offre souscrite, et `src/core/plans.ts` dit ce que
chacune donne. C'est la seule matrice : l'interface la lit pour flouter, le
serveur la lit pour refuser.

| | Essentiel | Fondateur | Pro | Business | Entreprise |
| --- | --- | --- | --- | --- | --- |
| Clients, sites, équipements, planning, photos, QR, rapport PDF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dictée et compte-rendu assisté | | ✅ | ✅ | ✅ | ✅ |
| Envoi du rapport par e-mail | | ✅ | ✅ | ✅ | ✅ |
| Suivi des échéances | | ✅ | ✅ | ✅ | ✅ |
| Export complet depuis l'application | | | | ✅ | ✅ |

« Fondateur » est une offre de lancement et non un palier : mêmes
fonctionnalités que Pro, prix tenu dans la durée. Elle est volontairement
absente de l'échelle commerciale du code — l'application ne proposera jamais
d'y « passer », puisqu'elle ne se souscrit plus.

**Le floutage n'est pas la protection.** Une zone verrouillée n'est pas rendue
avec ses données — le composant réel n'atteint jamais le navigateur — et
l'action correspondante appelle `exigerFonctionnalite`, qui refuse. Retirer un
filtre CSS ne révèle donc rien, et forger la requête ne fait rien.

Le nombre d'utilisateurs compris est déclaré dans la matrice mais **n'est pas
appliqué** : rien n'empêche aujourd'hui un quatrième compte sur une offre qui
en comprend trois. C'est un choix, pas un oubli — tant que la facturation est
manuelle, mieux vaut un client servi qu'un client bloqué un samedi.

Changer l'offre d'un client se fait hors de l'application :

```bash
npm run org:plan                                    # état des lieux
npm run org:plan -- --slug ramonage-cevennes --offre PRO
```

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

**E-mail.** `MAIL_DRIVER=smtp` envoie par nodemailer, avec les variables
`SMTP_*`. N'importe quel serveur SMTP fait l'affaire — celui de l'hébergeur du
domaine, un routeur transactionnel, ou celui de l'entreprise elle-même : pas
de compte à ouvrir chez un fournisseur d'API, et le rapport peut partir de
l'adresse professionnelle de l'artisan. Le chiffrement est déduit du port
(465 implicite, STARTTLS ailleurs) sauf si `SMTP_SECURE` le force.

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
