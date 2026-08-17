import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/vennora/page";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <EmptyState
        icon={FileQuestion}
        title="Page introuvable"
        description="Cette page n'existe pas, ou la ressource demandée n'appartient pas à votre entreprise."
        action={
          <Button asChild>
            <Link href="/">Retour au tableau de bord</Link>
          </Button>
        }
      />
    </div>
  );
}
