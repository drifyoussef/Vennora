import Link from "next/link";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Page 403.
 *
 * Convention Next : ce fichier vit à la racine de `app/`, hors de la coquille
 * authentifiée — il ne peut donc pas s'appuyer sur la barre latérale. On
 * assume une page autonome, avec un retour explicite vers le tableau de bord.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <ShieldOff className="size-5" />
        </div>

        <h1 className="font-heading mt-4 text-xl font-semibold tracking-tight">
          Accès réservé
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Cette page est réservée aux administrateurs de l&apos;entreprise.
          Si vous pensez devoir y accéder, demandez à votre responsable de
          modifier votre rôle.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Retour au tableau de bord</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/interventions">Mes interventions</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
