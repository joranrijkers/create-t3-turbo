/**
 * Prikkr design tokens from docs/design/prikkr-design-html
 * Sources: Login Form, Welcome (8), Create Household (1), Join (10), Meal Planning (2),
 * Meal Detail (3), Recipe Detail (4), Grocery List (5), Dietary Pref (6), Recipe Collection (7),
 * Add Recipe (11), Household Overview (12).
 */
export const prikkrDesign = {
  colors: {
    primary: "#FF7936",
    secondary: "#171615",
    textGray: "#6B6460",
    lightGray: "#A09890",
    bgSoft: "#F5F3F0",
    accentLight: "#FFF0E8",
    white: "#FFFFFF",
    borderGray: "#EDE7E0",
    red: "#C62828",
    success: "#4CAF50",
    successDark: "#2E7D32",
    warning: "#FF7936",
    warningDark: "#C05020",
    danger: "#C62828",
    dangerDark: "#C62828",
    blueSoft: "#EFF6FF",
    blueAccent: "#1D4ED8",
    greenSoft: "#F0FDF4",
    orangeSoft: "#FFF0E8",
    orange100: "#FFDAC5",
  },
  shadow: {
    /** 0 10px 40px -10px rgba(0,0,0,0.08) - logo/soft surfaces */
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 40,
      elevation: 4,
    },
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 20,
      elevation: 3,
    },
    input: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 10,
      elevation: 2,
    },
    button: {
      shadowColor: "#FF7936",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 6,
    },
    floating: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 30,
      elevation: 8,
    },
    /** Bottom sheet: 0 -10px 40px -15px rgba(0,0,0,0.1) */
    sheet: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.1,
      shadowRadius: 40,
      elevation: 12,
    },
  },
  /** Border radius from designs: cards 2xl = 16, 3xl = 24, sheet rounded-t-[2.5rem] = 40 */
  radius: {
    card: 16,
    cardLg: 24,
    sheet: 40,
    input: 16,
    button: 16,
  },
} as const;
