import Link from "next/link";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { findEquipmentByQrToken } from "@/core/data/equipment";

/**
 * Résolution d'un QR code d'équipement.
 *
 * Route sous le layout authentifié : un scan par un visiteur non connecté
 * passe d'abord par /connexion, qui le ramène ici ensuite grâce au paramètre
 * `suite`. La recherche se fait dans le tenant de l'utilisateur, donc une
 * étiquette d'une autre entreprise ne remonte rien.
 */
export default async function QrResolvePage({
  params,
}: PageProps<"/e/[token]">) {
  const context = await getPageContext("equipment.view");
  const { token } = await params;

  const equipment = await findEquipmentByQrToken(context, token);

  if (equipment) redirect(`/equipements/${equipment.id}`);

  return (
    <div className="mx-auto max-w-md pt-10">
      <EmptyState
        icon={QrCode}
        title="Équipement introuvable"
        description="Ce QR code ne correspond à aucun équipement de votre entreprise. Il peut avoir été régénéré, ou appartenir à une autre société."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/scanner">Scanner à nouveau</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/equipements">Voir les équipements</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
