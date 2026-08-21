import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Download, Lock, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGrid, PageHeader } from "@/components/vennora/page";
import { TechnicianChip } from "@/components/vennora/badges";
import { getPageContext } from "@/core/context";
import {
  autorise,
  libelleOffre,
  messageOffre,
  utilisateursInclus,
} from "@/core/plans";
import { USER_ROLE_LABEL } from "@/core/labels";
import { getEquipmentTypes, getInterventionTypes } from "@/core/catalog";
import { formatAddress, formatDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MemberActions } from "./member-actions";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const { db, user } = await getPageContext("organization.manage");

  const [organization, users, equipmentTypes, interventionTypes] =
    await Promise.all([
      db.organization.findFirst({
        where: { id: user.orgId },
        select: {
          name: true,
          address: true,
          postalCode: true,
          city: true,
          phone: true,
          email: true,
          siret: true,
          createdAt: true,
          trade: { select: { name: true, colorHex: true } },
        },
      }),
      db.user.findMany({
        orderBy: [{ role: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          active: true,
          colorHex: true,
          lastLoginAt: true,
        },
      }),
      getEquipmentTypes(user.org.tradeSlug),
      getInterventionTypes(user.org.tradeSlug),
    ]);

  if (!organization) return null;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Paramètres"
        description="Informations de l'entreprise, équipe et référentiels métier."
      />

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading mb-4 flex items-center gap-2 text-base font-semibold">
          <Building2 className="size-4 text-muted-foreground" />
          Entreprise
        </h2>
        <FieldGrid>
          <Field label="Raison sociale">{organization.name}</Field>
          <Field label="Métier">
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: organization.trade.colorHex }}
              />
              {organization.trade.name}
            </span>
          </Field>
          <Field label="SIRET">{organization.siret ?? "—"}</Field>
          <Field label="Adresse">{formatAddress(organization)}</Field>
          <Field label="Téléphone">{formatPhone(organization.phone)}</Field>
          <Field label="E-mail">{organization.email ?? "—"}</Field>
        </FieldGrid>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading flex items-center gap-2 text-base font-semibold">
            <Users className="size-4 text-muted-foreground" />
            Équipe
            <span className="text-sm font-normal text-muted-foreground">
              {users.length}
            </span>
          </h2>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/parametres/equipe/nouveau">
              <Plus className="size-4" />
              Ajouter un membre
            </Link>
          </Button>
        </div>

        <ul className="divide-y divide-border">
          {users.map((member) => (
            <li
              key={member.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0",
                !member.active && "opacity-60",
              )}
            >
              <TechnicianChip
                firstName={member.firstName}
                lastName={member.lastName}
                colorHex={member.colorHex}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <Link
                    href={`/parametres/equipe/${member.id}/modifier`}
                    className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {member.firstName} {member.lastName}
                  </Link>
                  {member.id === user.id && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      vous
                    </span>
                  )}
                  {!member.active && (
                    <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-normal tracking-wide text-muted-foreground uppercase">
                      désactivé
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                  {member.phone && ` · ${formatPhone(member.phone)}`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {USER_ROLE_LABEL[member.role]}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {member.lastLoginAt
                  ? `Vu le ${formatDate(member.lastLoginAt)}`
                  : "Jamais connecté"}
              </span>
              <MemberActions
                userId={member.id}
                fullName={`${member.firstName} ${member.lastName}`}
                active={member.active}
                isSelf={member.id === user.id}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* L'export est proposé sans condition ni délai : c'est la
          contrepartie de « vos données vous appartiennent ». Un client qui
          doit le demander ne le croit qu'à moitié. */}
      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading mb-1 text-base font-semibold">
          Votre offre
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Vous êtes à l&apos;offre{" "}
          <span className="text-foreground font-medium">
            {libelleOffre(user.org.plan)}
          </span>
          {" "}: {utilisateursInclus(user.org.plan) === Infinity
            ? "utilisateurs illimités"
            : `${utilisateursInclus(user.org.plan)} utilisateur(s) compris`}
          . Pour en changer, écrivez-nous.
        </p>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading mb-1 text-base font-semibold">
          Vos données
        </h2>
        <p className="mb-4 text-sm text-muted-foreground text-pretty">
          Clients, sites, équipements, interventions, anomalies et
          comptes-rendus au format tableur, accompagnés des rapports PDF
          signés. L&apos;archive est construite à la demande : elle est
          toujours à jour, et rien n&apos;en est conservé sur nos serveurs.
        </p>
        {autorise(user.org.plan, "export") ? (
          <Button asChild variant="outline" className="gap-1.5">
            <a href="/api/export" download>
              <Download className="size-4" />
              Télécharger l&apos;export complet
            </a>
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            {messageOffre("export")} Nous vous le fournissons sur demande en
            attendant : vos données restent les vôtres.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading mb-1 text-base font-semibold">
          Référentiels métier
        </h2>
        <p className="mb-4 text-sm text-muted-foreground text-pretty">
          Ces catalogues sont définis par le métier « {organization.trade.name} »
          et partagés par toutes les entreprises du même vertical.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Types d&apos;équipement
            </p>
            <ul className="space-y-1.5">
              {equipmentTypes.map((type) => (
                <li
                  key={type.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span>{type.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {type.defaultIntervalMonths
                      ? `tous les ${type.defaultIntervalMonths} mois`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Types d&apos;intervention
            </p>
            <ul className="space-y-1.5">
              {interventionTypes.map((type) => (
                <li
                  key={type.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: type.colorHex }}
                    />
                    {type.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {type.defaultDurationMin} min
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
