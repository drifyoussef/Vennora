import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { USER_ROLE_LABEL } from "@/core/labels";
import { TEAM_COLORS } from "@/core/palette";
import { objectId } from "@/core/schemas";
import { formatDate } from "@/lib/format";
import { UserForm } from "../../user-form";
import { ResetPassword } from "./reset-password";

export const metadata: Metadata = { title: "Modifier le membre" };

export default async function EditUserPage({
  params,
}: PageProps<"/parametres/equipe/[id]/modifier">) {
  const { db, user: actor } = await getPageContext("user.manage");
  const { id } = await params;

  const parsed = objectId.safeParse(id);
  if (!parsed.success) notFound();

  const member = await db.user.findFirst({
    where: { id: parsed.data },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      colorHex: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!member) notFound();

  const fullName = `${member.firstName} ${member.lastName}`;
  const isSelf = member.id === actor.id;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={fullName}
        description={`${USER_ROLE_LABEL[member.role]} · dans l'équipe depuis le ${formatDate(member.createdAt)}${
          member.lastLoginAt
            ? ` · dernière connexion le ${formatDate(member.lastLoginAt)}`
            : " · jamais connecté"
        }`}
        breadcrumbs={[
          { label: "Paramètres", href: "/parametres" },
          { label: fullName },
        ]}
      />

      <UserForm
        initial={member}
        defaultColor={member.colorHex ?? TEAM_COLORS[0].hex}
        isSelf={isSelf}
        cancelHref="/parametres"
      />

      <section className="mt-10 border-t border-border pt-6">
        <h2 className="font-heading text-base font-semibold">Mot de passe</h2>
        <p className="mt-1 mb-4 max-w-prose text-sm text-muted-foreground text-pretty">
          {isSelf
            ? "Pour changer votre propre mot de passe, passez par votre profil : l'ancien mot de passe y est demandé."
            : "À utiliser si le mot de passe a été oublié, ou en urgence si un téléphone a été perdu."}
        </p>
        {!isSelf && <ResetPassword userId={member.id} fullName={fullName} />}
      </section>
    </div>
  );
}
