import { NextResponse } from "next/server";

import { getCurrentUser } from "@/core/auth/session";
import { tenantDb } from "@/core/tenant";
import { buildPdfData, loadReportData } from "@/core/data/report";
import { UserRole } from "@/core/enums";
import { objectId } from "@/core/schemas";
import { renderReportPdf } from "@/services/pdf";

/**
 * Aperçu du rapport, généré à la volée.
 *
 * Utile avant validation : le technicien voit exactement ce que le client
 * recevra, sans avoir à valider pour le découvrir. Le PDF officiel, lui, est
 * celui figé au moment de la validation et stocké — c'est celui qui part par
 * e-mail et qui est archivé dans les documents.
 *
 * `?telecharger=1` force le téléchargement plutôt que l'affichage en ligne.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Authentification requise.", { status: 401 });
  }

  const { id } = await context.params;
  const parsed = objectId.safeParse(id);
  if (!parsed.success) {
    return new NextResponse("Intervention introuvable.", { status: 404 });
  }

  const db = tenantDb({ orgId: user.orgId });

  // Le client tenant borne déjà la recherche à l'organisation ; on ajoute la
  // règle métier : un technicien ne voit que ses propres interventions.
  const scope = await db.intervention.findFirst({
    where: { id: parsed.data },
    select: { technicianId: true },
  });
  if (
    !scope ||
    (user.role === UserRole.TECHNICIAN && scope.technicianId !== user.id)
  ) {
    return new NextResponse("Intervention introuvable.", { status: 404 });
  }

  const data = await loadReportData(
    { user, ctx: { orgId: user.orgId, userId: user.id, role: user.role }, db },
    parsed.data,
  );

  const pdf = await renderReportPdf(await buildPdfData(data));
  const download = new URL(request.url).searchParams.has("telecharger");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Rapport ${data.reference}.pdf"`,
      // Un aperçu reflète l'état courant : il ne doit jamais être servi
      // depuis un cache après une modification du compte-rendu.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
