"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/vennora/page";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[vennora] erreur de rendu", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md pt-10">
      <EmptyState
        icon={TriangleAlert}
        title="Une erreur est survenue"
        description="L'affichage de cette page a échoué. Réessayez ; si le problème persiste, signalez-le en indiquant le code ci-dessous."
        action={
          <div className="space-y-3">
            <Button onClick={reset} className="gap-1.5">
              <RotateCcw className="size-4" />
              Réessayer
            </Button>
            {error.digest && (
              <p className="font-mono text-xs text-muted-foreground">
                {error.digest}
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}
