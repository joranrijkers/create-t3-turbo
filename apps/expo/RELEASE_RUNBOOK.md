# Prikkr — Release runbook

Stappen om de app klaar te zetten voor TestFlight / Play Store en productie-builds. Voer geen deploy uit zonder expliciete goedkeuring.

## 1. Bundle identifiers

- In `apps/expo/app.config.ts` staan:
  - `ios.bundleIdentifier`: `com.prikkr.app`
  - `android.package`: `com.prikkr.app`
- Wijzig deze alleen als je een andere app-ID wilt gebruiken (bijv. per omgeving).

## 2. EAS projectId

- De EAS projectId staat in `apps/expo/app.config.ts` onder `extra.eas.projectId`.
- Zorg dat `app.json` in de repo-root (indien gebruikt) dezelfde `expo.extra.eas.projectId` heeft, of verwijder die overlap zodat alleen `app.config.ts` geldt.

## 3. Omgevingsvariabelen (productie)

- **Vercel (of hosting):**
  - `CRON_SECRET`: Geheime waarde voor de cron-job die `/api/cron/attendance-reminder` aanroept.
  - Cron-aanroep moet de header `Authorization: Bearer <CRON_SECRET>` meesturen (bijv. in Vercel Cron of externe cron-service).

- **Expo / EAS:**
  - `EXPO_PUBLIC_API_URL` / `AUTH_URL`: wijzen naar de productie-URL van de Next.js-backend.
  - Overige variabelen volgens `.env.example`.

## 4. EAS Build & Submit

- **Eerste production-build:**
  ```bash
  cd apps/expo
  eas build --platform ios --profile production
  eas build --platform android --profile production
  ```

- **Na goedkeuring submit naar stores:**
  ```bash
  eas submit --platform ios --latest
  eas submit --platform android --latest
  ```

- Voor iOS: Apple Developer-account, App Store Connect-app en eventueel certificaten; EAS regelt veel automatisch.

## 5. TestFlight / Play intern testen

- **Preview-build** (intern): `eas build --platform ios --profile preview` (of android). Simulator-builds ondersteunen geen push; gebruik een fysiek device of production/preview zonder simulator.
- **TestFlight (iOS):** Upload build naar App Store Connect, voeg interne testers toe, test push en alle flows op een echte device.
- **Play intern (Android):** Upload AAB naar Play Console → Intern testen, voeg testers toe.
- Push-notificaties testen alleen op echte device (niet simulator).

## 6. EAS Update (aanbevolen)

- Voor snelle bugfixes na release zonder nieuwe store-review:
  ```bash
  eas update:configure
  eas update --auto
  ```

## 7. Store listing

- Screenshots voor vereiste formaten (iPhone 6.7", 6.5", etc.; Android idem).
- App-naam, korte/lange beschrijving, keywords, categorie.
- Support-URL (verplicht): contact- of supportpagina.
- Privacy-vragen in App Store Connect / Play Console invullen (afgestemd op privacybeleid).

## 8. Privacy & Voorwaarden

- Zet in je build-omgeving (EAS secrets of .env):
  - `EXPO_PUBLIC_PRIVACY_URL`: publieke URL van het privacybeleid (bijv. op je Next.js-site of eigen domein).
  - `EXPO_PUBLIC_TERMS_URL`: publieke URL van de gebruiksvoorwaarden.
- Op het welkomstscherm (`apps/expo/src/app/(onboarding)/welcome.tsx`) openen "Voorwaarden" en "Privacybeleid" deze URLs via `Linking.openURL`. Instellingen → Privacybeleid gebruikt eveneens `EXPO_PUBLIC_PRIVACY_URL`.
