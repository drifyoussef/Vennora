import type { TradeDefinition } from "../types";

/**
 * Ramonage — premier vertical de Vennora.
 *
 * Périodicités : l'arrêté du 20 juillet 2023 impose un ramonage annuel pour
 * les conduits desservant un appareil bois/fioul, deux passages annuels
 * n'étant plus exigés partout mais restant fréquents en usage continu. On
 * retient 12 mois par défaut ; c'est modifiable par équipement.
 */
export const ramonage: TradeDefinition = {
  slug: "ramonage",
  name: "Ramonage",
  colorHex: "#2E2A28",
  active: true,

  vocabulary: {
    equipment: { singular: "Équipement", plural: "Équipements" },
    intervention: { singular: "Intervention", plural: "Interventions" },
  },

  equipmentTypes: [
    {
      code: "CHEMINEE",
      label: "Cheminée",
      icon: "Flame",
      defaultIntervalMonths: 12,
      sortOrder: 10,
    },
    {
      code: "POELE_BOIS",
      label: "Poêle à bois",
      icon: "Flame",
      defaultIntervalMonths: 12,
      sortOrder: 20,
    },
    {
      code: "POELE_GRANULES",
      label: "Poêle à granulés",
      icon: "Flame",
      defaultIntervalMonths: 12,
      sortOrder: 30,
    },
    {
      code: "INSERT",
      label: "Insert",
      icon: "Flame",
      defaultIntervalMonths: 12,
      sortOrder: 40,
    },
    {
      code: "CHAUDIERE_BOIS",
      label: "Chaudière bois",
      icon: "Boxes",
      defaultIntervalMonths: 12,
      sortOrder: 50,
    },
    {
      code: "CHAUDIERE_FIOUL",
      label: "Chaudière fioul",
      icon: "Fuel",
      defaultIntervalMonths: 12,
      sortOrder: 60,
    },
    {
      code: "CHAUDIERE_GAZ",
      label: "Chaudière gaz",
      icon: "Wind",
      defaultIntervalMonths: 12,
      sortOrder: 70,
    },
    {
      code: "AUTRE",
      label: "Autre",
      icon: "CircleDashed",
      defaultIntervalMonths: undefined,
      sortOrder: 999,
    },
  ],

  interventionTypes: [
    {
      code: "RAMONAGE",
      label: "Ramonage",
      colorHex: "#0F3D4C",
      defaultDurationMin: 60,
      recurrenceMonths: 12,
      sortOrder: 10,
    },
    {
      code: "ENTRETIEN",
      label: "Entretien",
      colorHex: "#D97A28",
      defaultDurationMin: 90,
      recurrenceMonths: 12,
      sortOrder: 20,
    },
    {
      code: "CONTROLE",
      label: "Contrôle",
      colorHex: "#1E7FB8",
      defaultDurationMin: 45,
      recurrenceMonths: 12,
      sortOrder: 30,
    },
    {
      code: "DEPANNAGE",
      label: "Dépannage",
      colorHex: "#C8102E",
      defaultDurationMin: 90,
      recurrenceMonths: undefined,
      sortOrder: 40,
    },
    {
      code: "AUTRE",
      label: "Autre",
      colorHex: "#6B7780",
      defaultDurationMin: 60,
      recurrenceMonths: undefined,
      sortOrder: 999,
    },
  ],

  reportSections: [
    {
      key: "summary",
      label: "Résumé de l'intervention",
      hint: "Deux à trois phrases factuelles : ce qui a été fait, sur quel appareil, avec quel résultat global.",
      required: true,
    },
    {
      key: "workDone",
      label: "Travaux réalisés",
      hint: "Liste des opérations effectivement réalisées (ramonage mécanique du conduit, débistrage, nettoyage du foyer, vérification du tirage…). Ne rien inventer qui ne figure pas dans les notes.",
      required: true,
    },
    {
      key: "equipmentState",
      label: "État de l'équipement",
      hint: "État constaté du conduit et de l'appareil : encrassement, étanchéité, raccordement, chapeau, trappe de ramonage.",
      required: true,
    },
    {
      key: "anomaliesSummary",
      label: "Anomalies constatées",
      hint: "Reprendre les anomalies enregistrées, avec leur gravité. S'il n'y en a aucune, l'indiquer explicitement.",
      required: false,
    },
    {
      key: "recommendations",
      label: "Recommandations",
      hint: "Conseils d'usage et actions conseillées au client, sans engagement commercial.",
      required: false,
    },
    {
      key: "futureWork",
      label: "Travaux à prévoir",
      hint: "Interventions à planifier, avec un ordre de priorité. Aucun chiffrage.",
      required: false,
    },
  ],
};
