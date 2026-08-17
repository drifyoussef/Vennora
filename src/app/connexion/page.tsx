import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VennoraLogo } from "@/components/vennora/logo";
import { auth } from "@/core/auth";
import { getCurrentUser } from "@/core/auth/session";
import { LoginForm } from "./login-form";
import { isDevelopment } from "@/lib/env";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
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
    <main className="flex min-h-dvh flex-col bg-primary text-primary-foreground">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <VennoraLogo
              showWordmark={false}
              className="justify-center [&_svg]:size-11"
            />
            <h1 className="font-heading mt-4 text-3xl font-semibold tracking-tight">
              Vennora
            </h1>
            <p className="mt-2 text-sm text-primary-foreground/70 text-pretty">
              Gérez vos interventions. Maîtrisez vos équipements.
            </p>
          </div>

          {staleSession && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground/90 text-pretty"
            >
              Votre session n&apos;est plus valide. Reconnectez-vous.
            </p>
          )}

          {params.motdepasse === "change" && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground/90 text-pretty"
            >
              Mot de passe modifié. Reconnectez-vous avec le nouveau — vos
              autres appareils ont également été déconnectés.
            </p>
          )}

          <div className="rounded-xl bg-card p-6 text-card-foreground shadow-lg">
            <LoginForm suite={suite} />
          </div>

          {isDevelopment && (
            <div className="mt-6 rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-4 py-3 text-xs leading-relaxed text-primary-foreground/70">
              <p className="mb-1.5 font-medium text-primary-foreground/90">
                Jeu de démonstration
              </p>
              <p>
                Administrateur · celine@ramonage-cevennes.fr
                <br />
                Technicien · ludovic@ramonage-cevennes.fr
                <br />
                Mot de passe · vennora2026
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="pb-safe px-4 pb-6 text-center text-xs text-primary-foreground/45">
        Vennora — gestion des interventions techniques
      </footer>
    </main>
  );
}
