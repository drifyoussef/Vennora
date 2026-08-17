import "server-only";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

/**
 * Rapport d'intervention, mise en page PDF.
 *
 * React-PDF plutôt qu'un rendu HTML par navigateur sans tête : pas de
 * Chromium à héberger, pagination déterministe, et un fichier qui sort
 * identique quel que soit l'environnement. Le prix à payer est une mise en
 * page à écrire à la main — c'est ce fichier.
 *
 * Les polices sont celles intégrées au format PDF (Helvetica) : aucune police
 * externe à télécharger, donc aucun appel réseau à la génération et aucun
 * risque de rendu différent d'une machine à l'autre.
 */

export interface ReportPhoto {
  /** Image en data URI, intégrée au document. */
  dataUrl: string;
  caption: string | null;
}

export interface ReportDocumentData {
  organization: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    siret: string | null;
    footer: string | null;
  };
  reference: string;
  date: string;
  technicianName: string;
  customer: { name: string; email: string | null; phone: string | null };
  site: { name: string; address: string };
  equipment: {
    label: string;
    type: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
  } | null;
  interventionType: string;
  sections: Array<{ label: string; value: string }>;
  anomalies: Array<{
    title: string;
    severity: string;
    description: string | null;
    recommendation: string | null;
  }>;
  photos: ReportPhoto[];
  signature: {
    imageDataUrl: string | null;
    signerName: string;
    signedAt: string;
  } | null;
  nextInterventionAt: string | null;
}

const PETROL = "#0F3D4C";
const AMBER = "#D97A28";
const SLATE = "#6B7780";
const LINE = "#D8CFC0";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 54,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#1B2B31",
    lineHeight: 1.45,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: PETROL,
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PETROL },
  orgLine: { fontSize: 8, color: SLATE, marginTop: 2 },
  docTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: PETROL,
    textAlign: "right",
  },
  reference: { fontSize: 8, color: SLATE, textAlign: "right", marginTop: 3 },

  grid: { flexDirection: "row", gap: 14, marginBottom: 14 },
  col: { flex: 1 },
  label: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  value: { fontSize: 9.5 },

  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: PETROL,
    marginTop: 12,
    marginBottom: 4,
    borderBottomWidth: 0.7,
    borderBottomColor: LINE,
    paddingBottom: 3,
  },
  paragraph: { marginBottom: 2 },

  anomaly: {
    borderLeftWidth: 2.5,
    borderLeftColor: AMBER,
    paddingLeft: 7,
    paddingVertical: 3,
    marginBottom: 7,
  },
  anomalyTitle: { fontFamily: "Helvetica-Bold" },
  anomalyMeta: { fontSize: 8, color: SLATE, marginTop: 1 },

  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCell: { width: 158, marginBottom: 8 },
  photo: { width: 158, height: 118, objectFit: "cover" },
  caption: { fontSize: 7.5, color: SLATE, marginTop: 2 },

  signatures: { flexDirection: "row", gap: 20, marginTop: 18 },
  signatureBox: {
    flex: 1,
    borderWidth: 0.7,
    borderColor: LINE,
    borderRadius: 3,
    padding: 8,
    minHeight: 82,
  },
  signatureImage: { height: 40, objectFit: "contain", marginVertical: 4 },
  signatureMeta: { fontSize: 7.5, color: SLATE },

  notice: {
    marginTop: 14,
    padding: 7,
    backgroundColor: "#F7F4EE",
    fontSize: 8,
    color: SLATE,
  },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    borderTopWidth: 0.7,
    borderTopColor: LINE,
    paddingTop: 5,
    fontSize: 7,
    color: SLATE,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ReportDocument({ data }: { data: ReportDocumentData }) {
  const org = data.organization;

  return (
    <Document
      title={`Rapport d'intervention ${data.reference}`}
      author={org.name}
      creator="Vennora"
      producer="Vennora"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>{org.name}</Text>
            {org.address && <Text style={styles.orgLine}>{org.address}</Text>}
            <Text style={styles.orgLine}>
              {[org.phone, org.email].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>RAPPORT D&apos;INTERVENTION</Text>
            <Text style={styles.reference}>
              {data.reference} · {data.date}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <Field label="Client" value={data.customer.name} />
            <Field
              label="Site"
              value={`${data.site.name}\n${data.site.address}`}
            />
          </View>
          <View style={styles.col}>
            <Field label="Type d'intervention" value={data.interventionType} />
            <Field label="Technicien" value={data.technicianName} />
          </View>
          <View style={styles.col}>
            {data.equipment ? (
              <>
                <Field
                  label="Équipement"
                  value={`${data.equipment.label}\n${data.equipment.type}`}
                />
                <Field
                  label="Marque et modèle"
                  value={
                    [data.equipment.brand, data.equipment.model]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }
                />
                {data.equipment.serialNumber && (
                  <Field
                    label="N° de série"
                    value={data.equipment.serialNumber}
                  />
                )}
              </>
            ) : (
              <Field label="Équipement" value="Non précisé" />
            )}
          </View>
        </View>

        {data.sections
          .filter((s) => s.value.trim())
          .map((section) => (
            <View key={section.label} wrap={false}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {section.value.split("\n").map((line, i) => (
                <Text key={i} style={styles.paragraph}>
                  {line}
                </Text>
              ))}
            </View>
          ))}

        {data.anomalies.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Détail des anomalies</Text>
            {data.anomalies.map((anomaly, i) => (
              <View key={i} style={styles.anomaly} wrap={false}>
                <Text style={styles.anomalyTitle}>{anomaly.title}</Text>
                <Text style={styles.anomalyMeta}>
                  Gravité : {anomaly.severity}
                </Text>
                {anomaly.description && (
                  <Text style={{ marginTop: 2 }}>{anomaly.description}</Text>
                )}
                {anomaly.recommendation && (
                  <Text style={{ marginTop: 2 }}>
                    Recommandation : {anomaly.recommendation}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {data.photos.length > 0 && (
          <>
            <Text style={styles.sectionTitle} break={data.photos.length > 4}>
              Photos
            </Text>
            <View style={styles.photoRow}>
              {data.photos.map((photo, i) => (
                <View key={i} style={styles.photoCell} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- composant React-PDF, pas une balise img */}
                  <Image style={styles.photo} src={photo.dataUrl} />
                  {photo.caption && (
                    <Text style={styles.caption}>{photo.caption}</Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {data.nextInterventionAt && (
          <View style={styles.notice} wrap={false}>
            <Text>
              Prochaine intervention conseillée : {data.nextInterventionAt}.
            </Text>
          </View>
        )}

        <View style={styles.signatures} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.label}>Signature du client</Text>
            {data.signature?.imageDataUrl ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- composant React-PDF */}
                <Image
                  style={styles.signatureImage}
                  src={data.signature.imageDataUrl}
                />
                <Text style={styles.signatureMeta}>
                  {data.signature.signerName}
                </Text>
                <Text style={styles.signatureMeta}>
                  Signé le {data.signature.signedAt}
                </Text>
              </>
            ) : (
              <Text style={[styles.signatureMeta, { marginTop: 26 }]}>
                Non signé
              </Text>
            )}
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.label}>Le technicien</Text>
            <Text style={{ marginTop: 26 }}>{data.technicianName}</Text>
            <Text style={styles.signatureMeta}>{org.name}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{org.footer ?? org.name}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
