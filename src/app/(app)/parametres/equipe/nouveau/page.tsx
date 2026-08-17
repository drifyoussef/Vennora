import type { Metadata } from "next";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { nextFreeColor } from "@/core/palette";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Nouveau membre" };

export default async function NewUserPage() {
  const { db } = await getPageContext("user.manage");

  const used = await db.user.findMany({ select: { colorHex: true } });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Ajouter un membre"
        description="Créez un accès pour un technicien ou un administrateur de l'entreprise."
        breadcrumbs={[
          { label: "Paramètres", href: "/parametres" },
          { label: "Nouveau membre" },
        ]}
      />
      <UserForm
        defaultColor={nextFreeColor(used.map((u) => u.colorHex))}
        cancelHref="/parametres"
      />
    </div>
  );
}
