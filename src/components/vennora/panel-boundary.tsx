"use client";

import { Component, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Frontière d'erreur autour d'un panneau.
 *
 * Sans elle, une exception dans la galerie photo emporte tout l'écran
 * d'intervention : le technicien perd aussi l'accès aux anomalies, au
 * compte-rendu et à la signature, alors qu'un seul bloc est en cause. Chaque
 * panneau du terrain est donc isolé.
 *
 * Écrit en composant de classe parce que React n'expose toujours pas de
 * primitive de frontière d'erreur autrement — `error.tsx` de Next couvre la
 * route, pas une section.
 */
interface Props {
  /** Nom du panneau, affiché à l'utilisateur en cas de panne. */
  title: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class PanelBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[vennora] panneau en erreur", this.props.title, error);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="rounded-xl border border-severity-high/30 bg-severity-high/5 p-5">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-severity-high" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold">
              {this.props.title} — affichage impossible
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Ce bloc n&apos;a pas pu s&apos;afficher. Le reste de
              l&apos;intervention reste utilisable ; rien n&apos;a été perdu.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.reset}
              className="mt-3 gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Réessayer
            </Button>
          </div>
        </div>
      </section>
    );
  }
}
