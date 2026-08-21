import Link from "next/link";
import { Lock } from "lucide-react";

import { messageOffre, type Fonctionnalite } from "@/core/plans";
import { cn } from "@/lib/utils";

/**
 * Zone réservée à une offre supérieure.
 *
 * Le flou n'est pas la sécurité, c'est la politesse. Ce composant ne reçoit
 * jamais la vraie fonctionnalité ni les vraies données : `apercu` est un
 * décor, inerte et sans information. Ce qui protège réellement, c'est que la
 * page ne rend pas le composant réel et que l'action serveur correspondante
 * refuse — retirer le filtre CSS dans le navigateur ne révèle donc rien, et
 * forger la requête ne fait rien.
 *
 * D'où `aria-hidden` et `pointer-events-none` sur l'aperçu : un lecteur
 * d'écran n'a pas à lire un décor, et rien n'y est cliquable.
 */
export function ZoneVerrouillee({
  fonctionnalite,
  titre,
  description,
  apercu,
  className,
}: {
  fonctionnalite: Fonctionnalite;
  titre: string;
  description?: string;
  /** Décor purement visuel : aucune donnée réelle ne doit y entrer. */
  apercu?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      {apercu && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none blur-[5px] saturate-50 opacity-60"
        >
          {apercu}
        </div>
      )}

      <div
        className={cn(
          "flex flex-col items-center gap-2 px-6 py-8 text-center",
          apercu && "absolute inset-0 justify-center bg-card/55 backdrop-blur-[2px]",
        )}
      >
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-4" />
        </span>
        <h3 className="font-heading text-base font-semibold">{titre}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        )}
        <p className="text-sm font-medium">{messageOffre(fonctionnalite)}</p>
        <Link
          href="/parametres"
          className="text-primary mt-1 text-sm font-semibold underline underline-offset-4"
        >
          Voir mon offre
        </Link>
      </div>
    </section>
  );
}

/**
 * Décor générique : des blocs de texte qui n'en sont pas. Utilisé derrière le
 * verrou quand la vraie zone ressemble à une liste ou à un formulaire.
 */
export function ApercuFactice({ lignes = 4 }: { lignes?: number }) {
  return (
    <div className="space-y-2.5 p-5">
      {Array.from({ length: lignes }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="bg-muted size-8 shrink-0 rounded-lg" />
          <span
            className="bg-muted h-3 rounded-full"
            style={{ width: `${45 + ((i * 17) % 40)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
