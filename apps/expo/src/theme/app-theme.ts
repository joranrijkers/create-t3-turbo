/**
 * Semantic app theme tokens for light/dark mode.
 * Used by useAppTheme() so screens and layouts can style without hardcoded colors.
 */
export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceVariant: string;
  card: string;
  cardElevated: string;
  headerBackground: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accentLight: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarInactive: string;
  success: string;
  successDark: string;
  warning: string;
  warningDark: string;
  danger: string;
  dangerDark: string;
  /** Info/callout backgrounds (e.g. onboarding tips) */
  infoBackground: string;
  infoBorder: string;
  /** Overlay scrim for modals */
  overlayScrim: string;
};

export const appThemeLight: AppThemeColors = {
  background: "#F5F3F0",
  surface: "#F5F3F0",
  surfaceVariant: "#EDE7E0",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  headerBackground: "#FFFFFF",
  text: "#171615",
  textMuted: "#6B6460",
  border: "#EDE7E0",
  primary: "#FF7936",
  primaryForeground: "#FFFFFF",
  secondary: "#171615",
  secondaryForeground: "#FFFFFF",
  accentLight: "#FFF0E8",
  tabBarBackground: "#FFFFFF",
  tabBarBorder: "#EDE7E0",
  tabBarInactive: "#A09890",
  success: "#4CAF50",
  successDark: "#2E7D32",
  warning: "#FF7936",
  warningDark: "#C05020",
  danger: "#C62828",
  dangerDark: "#C62828",
  infoBackground: "#EFF6FF",
  infoBorder: "#DBEAFE",
  overlayScrim: "rgba(0,0,0,0.5)",
};

export const appThemeDark: AppThemeColors = {
  background: "#171615",
  surface: "#222222",
  surfaceVariant: "#373737",
  card: "#222222",
  cardElevated: "#373737",
  headerBackground: "#222222",
  text: "#FFFFFF",
  textMuted: "#A09890",
  border: "#373737",
  primary: "#FF7936",
  primaryForeground: "#FFFFFF",
  secondary: "#373737",
  secondaryForeground: "#FFFFFF",
  accentLight: "#C05020",
  tabBarBackground: "#171615",
  tabBarBorder: "#373737",
  tabBarInactive: "#A09890",
  success: "#4CAF50",
  successDark: "#2E7D32",
  warning: "#FF7936",
  warningDark: "#C05020",
  danger: "#C62828",
  dangerDark: "#C62828",
  infoBackground: "#1D4ED8",
  infoBorder: "#3B82F6",
  overlayScrim: "rgba(0,0,0,0.6)",
};

export function getAppTheme(scheme: "light" | "dark" | null): AppThemeColors {
  return scheme === "dark" ? appThemeDark : appThemeLight;
}
