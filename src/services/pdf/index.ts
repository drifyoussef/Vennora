import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { ReportDocument, type ReportDocumentData } from "./report-document";

/**
 * Rendu du rapport en PDF.
 *
 * `createElement` plutôt que du JSX : ce module est importé par des Server
 * Actions et des route handlers en `.ts`, et il n'y a qu'un seul élément à
 * construire — pas la peine de faire de ce fichier un `.tsx` pour ça.
 */
export async function renderReportPdf(
  data: ReportDocumentData,
): Promise<Buffer> {
  // `renderToBuffer` attend un élément typé `DocumentProps`. Notre composant
  // rend bien un `<Document>`, mais ses propres props sont `{ data }` : le
  // typage ne peut pas le déduire, d'où cette assertion — la seule du module.
  const element = createElement(ReportDocument, {
    data,
  }) as ReactElement<DocumentProps>;

  return renderToBuffer(element);
}

export type { ReportDocumentData, ReportPhoto } from "./report-document";
