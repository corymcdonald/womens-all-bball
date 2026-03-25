export const TEAM_COLORS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Pink",
  "White",
  "Black",
  "Gray",
] as const;

export type TeamColor = (typeof TEAM_COLORS)[number];

export const COLOR_VALUES: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
  orange: "#f97316",
  pink: "#ec4899",
  white: "#f5f5f5",
  black: "#333333",
  gray: "#6b7280",
};
