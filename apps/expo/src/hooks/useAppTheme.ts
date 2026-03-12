import { useColorScheme } from "react-native";

import { getAppTheme, type AppThemeColors } from "~/theme/app-theme";

export function useAppTheme(): {
  scheme: "light" | "dark";
  colors: AppThemeColors;
} {
  const scheme = useColorScheme() ?? "light";
  const colors = getAppTheme(scheme);
  return { scheme, colors };
}
