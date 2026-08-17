import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Camera, FileCheck2, History } from "lucide-react";

import { VennoraMark } from "@/components/vennora/logo";
import { auth } from "@/core/auth";
import { getCurrentUser } from "@/core/auth/session";
import { LoginForm } from "./login-form";
import { isDevelopment } from "@/lib/env";

export const metadata: Metadata = {
  title: "Connexion",
};

/**
 * Ce que fait l'outil, dit avec les mots du métier.
 *
 * Trois promesses seulement, et uniquement des choses réellement livrées :
 * annoncer sur l'écran d'accueil une fonction qui n'existe pas se paie au
 * premier chantier.
 */
const ARGUMENTS = [
  {
    icon: Camera,
    title: "Le chantier se saisit sur place",
    body: "Photos, notes et dictée depuis le téléphone, au doigt, pendant l'intervention.",
  },
  {
    icon: FileCheck2,
    title: "Le rapport passe par vous",
    body: "Le texte proposé ne part jamais au client sans votre relecture et votre validation.",
  },
  {
    icon: History,
    title: "L'historique suit l'équipement",
    body: "Chaque conduit conserve ses passages, ses anomalies et ses rapports signés.",
  },
];

export default async function LoginPage({
  searchParams,
}: PageProps<"/connexion">) {
  const params = await searchParams;
  const suite = typeof params.suite === "string" ? params.suite : undefined;

  // C'est ici, et nulle part ailleurs, qu'on décide si quelqu'un est déjà
  // connecté : `getCurrentUser` relit la base, donc un jeton qui désigne un
  // compte disparu ou désactivé mène au formulaire plutôt qu'à une boucle.
  const [session, current] = await Promise.all([auth(), getCurrentUser()]);
  if (current) redirect("/");

  // Un cookie sans compte correspondant : compte supprimé, désactivé, ou mot
  // de passe changé depuis. On le dit, plutôt que de laisser croire à un
  // simple oubli d'identifiants.
  const staleSession = Boolean(session?.user) && !current;

  return (
    <main className="min-h-dvh bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panneau de marque. Sur mobile il se réduit à une bande : l'écran
          appartient au clavier et aux deux champs, pas au discours. */}
      <aside className="bg-sidebar text-sidebar-foreground relative isolate flex flex-col overflow-hidden px-6 pt-12 pb-10 lg:px-12 lg:py-14">
        {/* Filigrane : la marque agrandie et recadrée, assez faible pour ne
            jamais concurrencer le texte. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -bottom-24 opacity-[0.055] lg:-right-28 lg:-bottom-28"
        >
          <VennoraMark monochrome className="size-[22rem] lg:size-[32rem]" />
        </div>

        <div className="relative">
          <VennoraMark className="size-10 lg:size-12" />
          <h1 className="font-heading text-sidebar-accent-foreground mt-5 text-3xl font-semibold tracking-tight lg:mt-6 lg:text-4xl">
            Vennora
          </h1>
          <p className="text-sidebar-foreground/75 mt-3 max-w-sm text-pretty lg:text-lg">
            Gérez vos interventions. Maîtrisez vos équipements.
          </p>
        </div>

        <ul className="relative mt-12 hidden space-y-7 lg:block">
          {ARGUMENTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="bg-sidebar-accent text-sidebar-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sidebar-accent-foreground text-sm font-medium">
                  {title}
                </p>
                <p className="text-sidebar-foreground/65 mt-1 text-sm text-pretty">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-sidebar-foreground/40 relative mt-auto hidden pt-12 text-xs lg:block">
          Vennora — gestion des interventions techniques
        </p>
      </aside>

      {/* Panneau du formulaire. */}
      <div className="flex flex-col px-4 py-10 sm:px-8 lg:justify-center lg:px-12 lg:py-14">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Connexion
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Accédez à votre espace de travail.
          </p>

          {staleSession && (
            <p
              role="status"
              className="border-border bg-muted text-foreground mt-6 rounded-lg border px-4 py-3 text-sm text-pretty"
            >
              Votre session n&apos;est plus valide. Reconnectez-vous.
            </p>
          )}

          {params.motdepasse === "change" && (
            <p
              role="status"
              className="border-border bg-muted text-foreground mt-6 rounded-lg border px-4 py-3 text-sm text-pretty"
            >
              Mot de passe modifié. Reconnectez-vous avec le nouveau — vos
              autres appareils ont également été déconnectés.
            </p>
          )}

          <div className="mt-6">
            <LoginForm suite={suite} />
          </div>

          <p className="text-muted-foreground mt-6 text-xs text-pretty">
            Mot de passe oublié ? Votre administrateur peut le réinitialiser
            depuis les paramètres de l&apos;entreprise.
          </p>

          {isDevelopment && (
            <div className="border-border bg-muted/60 mt-8 rounded-lg border px-4 py-3 text-xs leading-relaxed">
              <p className="text-foreground mb-1.5 font-medium">
                Jeu de démonstration
              </p>
              <p className="text-muted-foreground">
                Administrateur · celine@ramonage-cevennes.fr
                <br />
                Technicien · ludovic@ramonage-cevennes.fr
                <br />
                Mot de passe · vennora2026
              </p>
            </div>
          )}

          <p className="text-muted-foreground/70 pb-safe mt-10 text-center text-xs lg:hidden">
            Vennora — gestion des interventions techniques
          </p>
        </div>
      </div>
    </main>
  );
}
