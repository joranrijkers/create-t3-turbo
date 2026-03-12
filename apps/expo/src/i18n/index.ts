import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "./locales/en.json";
import nl from "./locales/nl.json";
import type { AppLanguagePreference } from "~/utils/language-storage";

const resources = {
  en: { translation: en },
  nl: { translation: nl },
};

export type AppLanguageCode = "nl" | "en";

export function getDeviceLanguage(): AppLanguageCode {
  const deviceLocale = Localization.getLocales()[0];
  const languageCode = deviceLocale?.languageCode ?? "en";
  return languageCode.startsWith("nl") ? "nl" : "en";
}

export function resolveLanguagePreference(
  preference: AppLanguagePreference,
): AppLanguageCode {
  return preference === "auto" ? getDeviceLanguage() : preference;
}

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  supportedLngs: ["en", "nl"],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
