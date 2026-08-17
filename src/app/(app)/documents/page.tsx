import Link from "next/link";
import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { DOCUMENT_CATEGORY_LABEL, plural } from "@/core/labels";
import { can } from "@/core/permissions";
import { fileUrl } from "@/services/storage";
import { formatDate } from "@/lib/format";
import { formatSize } from "@/lib/bytes";
import { DeleteDocument, DocumentUpload } from "./document-upload";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const context = await getPageContext("document.view");
  const { db, user } = context;

  const [rows, customers] = await Promise.all([
    db.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        category: true,
        sizeBytes: true,
        storageKey: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        intervention: { select: { id: true, reference: true } },
      },
    }),
    can(user.role, "document.upload")
      ? db.customer.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  // Les liens sont signés et expirent : aucune URL de document n'est stable.
  const documents = await Promise.all(
    rows.map(async (d) => ({ ...d, url: await fileUrl(d.storageKey) })),
  );

  const canUpload = can(user.role, "document.upload");
  const canDelete = can(user.role, "document.delete");

  return (
    <>
      <PageHeader
        title="Documents"
        description="Rapports, devis, certificats et pièces rattachés à vos clients."
        actions={
          canUpload && <DocumentUpload customers={customers} />
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun document"
          description="Les rapports d'intervention validés sont rangés ici automatiquement. Vous pouvez aussi ajouter un devis, une facture ou un certificat."
          action={canUpload && <DocumentUpload customers={customers} />}
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {document.name}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {document.customer ? (
                      <Link
                        href={`/clients/${document.customer.id}`}
                        className="hover:underline"
                      >
                        {document.customer.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {document.intervention && (
                      <>
                        {" · "}
                        <Link
                          href={`/interventions/${document.intervention.id}`}
                          className="hover:underline"
                        >
                          {document.intervention.reference}
                        </Link>
                      </>
                    )}
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {DOCUMENT_CATEGORY_LABEL[document.category]}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
                  {formatSize(document.sizeBytes)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDate(document.createdAt)}
                </span>

                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                >
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Télécharger ${document.name}`}
                  >
                    <Download className="size-4" />
                  </a>
                </Button>

                {canDelete && (
                  <DeleteDocument id={document.id} name={document.name} />
                )}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            {plural(documents.length, "document")}
          </p>
        </>
      )}
    </>
  );
}
