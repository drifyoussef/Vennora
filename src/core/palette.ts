/**
 * Couleurs assignables à un membre de l'équipe.
 *
 * Elles servent à distinguer les techniciens dans le planning : sur une vue
 * semaine chargée, la pastille de couleur se lit avant le nom. La liste est
 * fermée pour deux raisons — garantir un contraste suffisant sur fond clair
 * comme sur fond sombre, et empêcher qu'un formulaire trafiqué injecte une
 * valeur arbitraire dans un attribut `style`.
 */
export const TEAM_COLORS = [
  { hex: "#0F3D4C", label: "Bleu pétrole" },
  { hex: "#D97A28", label: "Ambre cuivré" },
  { hex: "#1E7FB8", label: "Bleu" },
  { hex: "#4F7B45", label: "Vert" },
  { hex: "#C8102E", label: "Rouge" },
  { hex: "#7D8A93", label: "Ardoise" },
  { hex: "#00A0A8", label: "Turquoise" },
  { hex: "#C9A227", label: "Or" },
  { hex: "#6B4E9B", label: "Violet" },
] as const;

export const TEAM_COLOR_VALUES = TEAM_COLORS.map((c) => c.hex) as readonly string[];

/** Attribue la première couleur libre, pour éviter deux pastilles identiques. */
export function nextFreeColor(used: Array<string | null>): string {
  const taken = new Set(used.filter(Boolean));
  return TEAM_COLORS.find((c) => !taken.has(c.hex))?.hex ?? TEAM_COLORS[0].hex;
}
