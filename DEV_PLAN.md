# Prikkr — Ontwikkelplan

Prikkr is een maaltijdplanning-app voor studentenhuizen en gezinnen. Huisgenoten stemmen wie er aanwezig is bij het avondeten, plannen recepten, en genereren automatisch een boodschappenlijst.

## Tech Stack

| Laag | Technologie |
|------|-------------|
| Monorepo | Turborepo + pnpm workspaces |
| Mobiele app | Expo (SDK 54) + Expo Router v4 + React Native 0.81 |
| Backend / API | Next.js 15 (App Router) — host voor tRPC, Better Auth en API-routes; de Expo-app praat tegen deze backend |
| Web (optioneel) | TanStack Start of Next.js-pagina’s voor admin/preview |
| API | tRPC v11 + TanStack Query |
| Authenticatie | Better Auth (magic link + social login), uitgevoerd op de Next.js-backend |
| Database ORM | Drizzle ORM (PostgreSQL) |
| Database / Backend | Supabase (Postgres + Realtime + Storage) |
| Styling | NativeWind (Tailwind voor RN) + Tailwind CSS (web) |
| Validatie | Zod v4 |

## Workspace-structuur

```
prikkr/
├── apps/
│   ├── expo/                  # React Native app (hoofdproduct) — praat met Next.js-backend
│   ├── nextjs/                # Backend: tRPC API, Better Auth, API-routes; later evt. web dashboard
│   └── tanstack-start/        # TanStack Start web app (optioneel)
├── packages/
│   ├── api/                   # tRPC router definities (door Next.js geserveerd)
│   ├── auth/                  # Better Auth configuratie (door Next.js gebruikt)
│   ├── db/                    # Drizzle schema + migraties
│   ├── ui/                    # Gedeelde UI-componenten
│   └── validators/            # Gedeelde Zod schemas
└── tooling/
    ├── eslint/
    ├── prettier/
    ├── tailwind/
    └── typescript/
```

**Architectuur:** De Expo-app is het hoofdproduct voor eindgebruikers. De Next.js-app fungeert als backend: zij host de tRPC-API (`/api/trpc`), Better Auth (`/api/auth`) en eventuele andere API-routes. De mobiele app praat dus altijd tegen de Next.js-backend (lokaal of via een gedeployde URL).

## Datamodel

Het volledige schema staat in `packages/db/src/schema.ts`. Kernentiteiten:

- **Household** — een huishouden met een unieke uitnodigingscode
- **HouseholdMember** — koppeling gebruiker ↔ huishouden (rol: admin/member)
- **UserPreferences** — dieetwensen en allergieën per gebruiker
- **Recipe** — recepten aangemaakt door huisgenoten
- **Ingredient** — ingrediënten per recept
- **MealPlan** — geplande maaltijden (datum + maaltijdtype + kok)
- **Attendance** — aanwezigheid per maaltijdplan (ja/nee/misschien + gasten)
- **ShoppingList** — boodschappenlijst per huishouden
- **ShoppingItem** — item op de boodschappenlijst (afgevinkt/niet)

---

## Fase 1 — Fundament & Authenticatie (Week 1–2)

**Doel:** Werkende authenticatie, navigatiestructuur en database in productie.

**Tijdens het bouwen:** Alle auth en API lopen via de **Next.js-backend** (Better Auth op Next.js, tRPC op Next.js). De **Expo-app** is alleen client: zij roept de Next.js-URL aan voor login en voor alle tRPC-calls. Zorg dat `EXPO_PUBLIC_API_URL` / `AUTH_URL` naar die backend wijzen.

**Taken:**

- [x] **Supabase-project aanmaken**
  - ~~Maak project aan op [supabase.com](https://supabase.com)~~
  - ~~Kopieer `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` naar `.env.local`~~

- [x] **Database-migratie uitvoeren**
  - ~~`pnpm db:push` om het schema te pushen naar Supabase~~
  - ~~Verifieer tabellen in Supabase Studio~~

- [x] **Better Auth configureren** (`packages/auth/src/index.ts`) — wordt door **Next.js** gebruikt (`apps/nextjs/src/auth/server.ts`); auth-routes leven op de Next.js-backend.
  - ~~Magic link e-mail instellen (Supabase SMTP of Resend)~~
  - Optioneel: Discord OAuth toevoegen

- [x] **Expo navigatiestructuur** (`apps/expo/src/app/`) — alleen UI en flows; alle auth-aanroepen gaan naar de Next.js-backend.
  - ~~`(auth)/` — inlog-schermen (magic link invoer + wacht-op-link)~~
  - ~~`(app)/` — beschermde schermen (tab-navigatie)~~
  - ~~Tabs: `maaltijdplan`, `recepten`, `boodschappen`, `profiel`~~

- [x] **tRPC auth-middleware** — in **packages/api** (door Next.js geserveerd); ~~protectedProcedure vereist ingelogde sessie~~.

**Klaar als:** Gebruiker kan inloggen via magic link, sessie blijft behouden na app-herstart.

---

## Fase 2 — Huishoudens & Uitnodigingen (Week 3–4)

**Doel:** Gebruikers kunnen een huishouden aanmaken of via code lid worden.

**Tijdens het bouwen:** Backend-logica (tRPC routers) leeft in **packages/api** en wordt door **Next.js** geserveerd. **Expo** gebruikt de tRPC-client en roept daarmee de Next.js-backend aan; geen eigen API in de app.

**Taken:**

- [x] **Household tRPC router** (`packages/api/src/router/household.ts`) — backend, door Next.js geserveerd. Uitbreiden met:
  - ~~`household.create` — aanmaken + willekeurige 8-char code genereren~~
  - ~~`household.joinByCode` — lid worden via uitnodigingscode~~
  - ~~`household.myHouseholds` — huishoudens van de ingelogde gebruiker~~
  - ~~`household.members` — leden van een huishouden ophalen~~

- [x] **Expo schermen** — roepen `household.create`, `household.joinByCode`, etc. aan via tRPC tegen de Next.js-backend.
  - ~~Onboarding: huishouden aanmaken of code invoeren~~
  - ~~Leden-overzicht per huishouden~~

- [x] **HouseholdMember aanmaken bij join**

**Klaar als:** Twee gebruikers kunnen hetzelfde huishouden delen.

---

## Fase 3 — Maaltijdplanning & Aanwezigheid (Week 5–8)

**Doel:** Kernfunctionaliteit — maaltijden plannen en aanwezigheid bijhouden.

**Tijdens het bouwen:** Nieuwe tRPC-routers (MealPlan, Attendance) in **packages/api** → door Next.js geserveerd. **Expo** toont data en stuurt mutaties via de bestaande tRPC-client naar de Next.js-backend.

**Taken:**

- [x] **MealPlan tRPC router** (packages/api) — backend, door Next.js geserveerd.
  - ~~`mealPlan.forWeek` — maaltijdplan voor een week ophalen~~
  - ~~`mealPlan.create` — maaltijd inplannen (datum, type, recept, kok)~~
  - ~~`mealPlan.update` / `delete`~~

- [x] **Attendance tRPC router** (packages/api) — backend, door Next.js geserveerd.
  - ~~`attendance.respond` — aanwezigheid aangeven (ja/nee/misschien + gasten)~~
  - ~~`attendance.forMealPlan` — alle reacties voor een maaltijdplan~~

- [x] **Expo maaltijdplan-scherm** — laadt en mutates data via tRPC naar Next.js-backend.
  - ~~Weekoverzicht (horizontaal scrollende dagen)~~
  - ~~Per dag: geplande maaltijden met aanwezigheidsstatus~~
  - ~~Snel aanwezigheid aangeven via swipe of knoppen~~

- [ ] **Push-notificaties** (Expo Notifications)
  - [ ] Herinnering bij geen reactie: cron `/api/cron/attendance-reminder` bestaat; zorg dat `CRON_SECRET` in Vercel (productie) staat en de cron-URL met header `Authorization: Bearer <CRON_SECRET>` wordt aangeroepen
  - [ ] Test push op echte device (preview-build met simulator: true ondersteunt geen push; gebruik TestFlight-build voor iOS)

**Klaar als:** Alle huisgenoten kunnen zien wie er eet en dat snel bijwerken.

---

## Fase 4 — Recepten (Week 9–11)

**Doel:** Huishoudens kunnen recepten bewaren en aan maaltijdplannen koppelen.

**Tijdens het bouwen:** Recipe- en Ingredient-routers in **packages/api** (Next.js-backend). **Expo** alleen UI + tRPC-calls naar die backend.

**Taken:**

- [x] **Recipe tRPC router** (packages/api) — backend, door Next.js geserveerd.
  - ~~`recipe.list` — recepten van het huishouden~~
  - ~~`recipe.create` / `update` / `softDelete`~~
  - ~~`recipe.byId` — recept + ingrediënten ophalen~~

- [x] **Ingredient tRPC router** (packages/api) — backend, door Next.js geserveerd.
  - ~~CRUD voor ingrediënten per recept~~

- [x] **Expo recept-schermen** — data via tRPC van/naar Next.js-backend.
  - ~~Receptenlijst met zoekfunctie en tags~~
  - ~~Recept-detailscherm (instructies, ingrediënten, portiegrootte)~~
  - ~~Recept aanmaken/bewerken~~
  - [x] **Receptfoto:** ~~bij aanmaken/bewerken cover photo kunnen uploaden (camera/galerij → Supabase Storage → `Recipe.imageUrl`)~~ — zie ook sectie *Design-backlog* hieronder.

- [x] **Receptkoppeling aan maaltijdplan**
  - ~~Bij maaltijd inplannen: optioneel recept kiezen~~

**Klaar als:** Recepten kunnen worden aangemaakt en aan de weekplanning gekoppeld.

---

## Fase 5 — Boodschappenlijst (Week 12–14)

**Doel:** Automatische boodschappenlijst op basis van de weekplanning.

**Tijdens het bouwen:** ShoppingList-tRPC in **packages/api** (Next.js). **Expo** toont en update de lijst via tRPC; realtime-updates (Supabase Realtime) kunnen via dezelfde backend of direct vanaf de app, afhankelijk van keuze.

**Taken:**

- [x] **ShoppingList tRPC router** (packages/api) — backend, door Next.js geserveerd.
  - ~~`shoppingList.generate` — ingrediënten van geplande maaltijden samenvoegen~~
  - ~~`shoppingList.current` — huidige lijst ophalen~~
  - ~~`shoppingList.checkItem` / `uncheckItem`~~
  - ~~`shoppingList.addManual` — handmatig item toevoegen~~
  - ~~`shoppingList.clearChecked`~~

- [x] **Expo boodschappenlijst-scherm** — data en mutaties via tRPC naar Next.js-backend.
  - ~~Gesorteerd op categorie (groenten, zuivel, vlees, etc.)~~
  - ~~Afvinken met optimistic updates~~
  - ~~Filtertabs: Alle items / Per gang / Per recept~~
  - ~~Progress-indicator en "Wis afgevinkte items"~~
  - [x] **Lege staat:** ~~duidelijke CTA "Genereer uit weekplan" toevoegen wanneer de lijst leeg is (roep `shoppingList.generate` aan; nu alleen "+ om items toe te voegen")~~

- [x] **Supabase Realtime** — ~~live updates wanneer huisgenoot iets afvinkt (optioneel voor MVP)~~

**Klaar als:** Boodschappenlijst wordt automatisch gegenereerd en is live gedeeld.

---

## Fase 6 — Instellingen-pagina (Week 15–16)

**Doel:** De huidige Huishouden-tab ombouwen tot een volwaardige Instellingen-pagina met profielbeheer, huishoudenbeheer, dieetvoorkeuren en meldingsinstellingen.

**Design:** Zie artboard *Instellingen* in het Paper-bestand (`Prikkr / Iphone app`).

**Navigatie:** Tab-label en -icoon wijzigen van "Huishouden" → "Instellingen" (icoon: `account` of `cog-outline`).

**Taken:**

- [ ] **Profielkaart** (`apps/expo/src/app/(app)/(tabs)/profiel.tsx`)
  - [ ] Profielfoto tonen via `useProfileImageUpload` hook (upload naar Supabase Storage)
  - [ ] Naam en e-mail bewerkbaar maken — navigeer naar nieuw scherm `(app)/profiel/edit.tsx`
  - [x] Initiaal-avatar als fallback wanneer geen foto is ingesteld

- [ ] **Huishouden-sectie**
  - [x] Huishoudennaam en aanmaakdatum tonen (bestaande data uit `useCurrentHousehold`)
  - [x] "Leden beheren" — navigeert naar bestaand ledenoverzicht (huidige Huishouden-inhoud)
  - [ ] "Lid uitnodigen" — toont uitnodigingscode en kopieer-naar-klembord functie

- [x] **Voorkeuren-sectie**
  - [x] "Dieet & allergieën" — navigeert naar bestaand scherm `(app)/voorkeuren/dietary.tsx`; toon huidige waarden als subtekst
  - [x] "Taal" — placeholder rij (taalwisseling buiten MVP-scope)

- [x] **Meldingen-sectie** (nieuw scherm of inline toggles)
  - [x] Toggle: Push-notificaties aan/uit — gebruik `Expo Notifications` permission request
  - [x] Toggle: Aanwezigheidsherinnering aan/uit — sla op in `UserPreferences` of `SecureStore`
  - [x] Toggle: Boodschappenlijst-updates aan/uit — sla op in `UserPreferences` of `SecureStore`
  - [x] `userPreferences` tRPC-router uitbreiden met velden `notifPush`, `notifAttendance`, `notifShopping` (boolean)

- [x] **App-sectie**
  - [x] "Over Prikkr" — toont versienummer (`expo-constants` `expoConfig.version`) + eventueel changelog
  - [x] "Privacybeleid" — opent `EXPO_PUBLIC_PRIVACY_URL` via `Linking.openURL`

- [x] **Uitloggen-knop**
  - [x] Roep `authClient.signOut()` aan + navigeer terug naar `(auth)/login`

- [x] **Tab-rename**
  - [x] In `apps/expo/src/app/(app)/(tabs)/_layout.tsx`: label "Huishouden" → "Instellingen", icoon `account-multiple-outline` → `cog-outline`
  - [x] i18n-sleutel toevoegen in `nl.json`: `"tabs.settings": "Instellingen"`

**Klaar als:** Gebruiker kan profiel bewerken, huishouden beheren, dieetvoorkeuren aanpassen en meldingen in-/uitschakelen vanuit één Settings-scherm.

---

## Fase 6b — Instellingen subpagina's (Week 16–17)

**Doel:** Alle subpagina's van de Instellingen-tab implementeren.

**Design:** Zie artboards *Profiel bewerken*, *Huishouden bewerken*, *Leden beheren*, *Lid uitnodigen*, *Over Prikkr* in het Paper-bestand (`Prikkr / Iphone app`). Dieetvoorkeuren bestaat al als `(app)/voorkeuren/dietary.tsx`.

### Profiel bewerken — `(app)/instellingen/profiel.tsx`

- [x] **Avatar** — toon huidige profielfoto of initiaal-fallback (oranje cirkel + letter); tik opent picker (camera / galerij) via `useProfileImageUpload`, upload naar Supabase Storage
- [x] **Persoonlijke gegevens** — `Naam` bewerkbaar via inline tap → tekstveld + opslaan (tRPC `userPreferences.upsert` of apart profiel-endpoint); `E-mailadres` read-only met label "Niet wijzigbaar"
- [x] **Beveiliging** → "Wachtwoord wijzigen" — navigeer naar `(app)/instellingen/wachtwoord.tsx` of stuur magic-link opnieuw (`authClient.sendVerificationEmail`)
- [x] **Gevaarzone** → "Account verwijderen" — toon bevestigingsdialoog, roep `authClient.deleteUser()` aan en navigeer naar `(auth)/login`

### Huishouden bewerken — `(app)/instellingen/huishouden.tsx`

- [x] **Header-kaart** — toon huishoudennaam + aanmaakdatum + ledencount (data via `useCurrentHousehold`)
- [x] **Naam huishouden** — bewerkbaar tekstveld (geactiveerd via focus); opslaan via `household.update` tRPC-mutatie
- [x] **Uitnodigingscode** — toon huidige 8-char code + "Kopieer"-knop (`Clipboard.setStringAsync`)
- [x] **Opslaan-knop** — disabled zolang naam niet gewijzigd is
- [x] **Gevaarzone**:
  - ~~"Huishouden verlaten" — verwijder `HouseholdMember`-record van de huidige gebruiker (`household.leaveHousehold`); navigeer naar `(onboarding)/`~~
  - ~~"Huishouden verwijderen" (alleen admin) — bevestigingsdialoog + `household.delete` mutatie; alle leden worden uitgelogd / doorgestuurd~~

### Leden beheren — `(app)/instellingen/leden.tsx`

- [x] **Ledenlijst** — laad via `household.members`; toon avatar (initiaal + kleur), naam, e-mail, rol-badge (Admin / Lid), "Jij"-badge voor huidige gebruiker
- [x] **Contextmenu (···)** per lid (niet zichzelf) — opties: "Maak Admin", "Verwijder uit huishouden" → confirm dialoog → `household.updateMemberRole` / `household.removeMember` tRPC-mutaties
- [x] **Nieuw lid uitnodigen** — navigeer naar `(app)/instellingen/uitnodigen.tsx`
- [x] **Gevaarzone** → "Huishouden verlaten" — zelfde flow als in huishouden-bewerken

### Lid uitnodigen — `(app)/instellingen/uitnodigen.tsx`

- [x] **Code-display** — grote weergave van de uitnodigingscode (bijv. `WTR-8472`) via `useCurrentHousehold().household.inviteCode`
- [x] **QR-code** — genereer via `expo-qrcode-svg` of `react-native-qrcode-svg` (package toevoegen); encode de code als tekst of als deep-link `prikkr://join?code=WTR-8472`
- [x] **"Code kopiëren"** — `Clipboard.setStringAsync(code)` + korte toast-feedback
- [x] **"Uitnodiging delen"** — `Share.share({ message: 'Join de Wetering op Prikkr: WTR-8472' })` via `expo-sharing` of `react-native`'s `Share` API
- [ ] **Vervaldatum / vernieuwen** (optioneel MVP+) — knop "Nieuwe code genereren" → `household.regenerateInviteCode`

### Over Prikkr — `(app)/instellingen/over.tsx`

- [x] **App-icoon + naam + versie** — versienummer via `expo-constants`: `Constants.expoConfig?.version`
- [ ] **"Wat is er nieuw"** — statische lijst met changelog-entries (hardcoded of vanuit `CHANGELOG.md` via build-script)
- [x] **"Privacybeleid"** — `Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL)`
- [x] **"Gebruiksvoorwaarden"** — `Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL)`
- [x] **"Open source licenties"** — navigeer naar `(app)/instellingen/licenties.tsx` of open extern via `expo-updates`
- [x] **Footer** — "Gemaakt met zorg voor studenten & gezinnen · © 2026 Prikkr"

### Navigatiestructuur toevoegen

- [x] Nieuw mapje `apps/expo/src/app/(app)/instellingen/` met bestanden:
  - `profiel.tsx`, `huishouden.tsx`, `leden.tsx`, `uitnodigen.tsx`, `over.tsx`
- [x] In `(tabs)/profiel.tsx` (de Instellingen-tab): alle rijen koppelen aan `router.push('/(app)/instellingen/...')`
- [x] i18n-sleutels toevoegen in `nl.json` voor alle nieuwe schermen en labels

**Klaar als:** Elke rij op de Instellingen-pagina navigeert naar een volledig werkende subpagina.

---

## Fase 7 — Afwerking & Launch (Week 18–22)

**Doel:** Stabiele, verzorgde app klaar voor beta-gebruikers.

**Tijdens het bouwen:** Alle nieuwe API-logica blijft in **packages/api** / Next.js-backend. **Expo** blijft de client. Eventueel webdashboard bouw je bovenop dezelfde Next.js-app (zelfde API, andere UI).

**Taken:**

- [x] **Gebruikersprofielen & voorkeuren**
  - ~~Dieetwensen en allergieën instellen~~ (scherm `voorkeuren/dietary.tsx`)
  - [x] Profielfoto via Supabase Storage (hook `useProfileImageUpload` bestaat; koppelen in profiel-scherm indien nog niet zichtbaar)

- [x] **UserPreferences integreren in maaltijdplanning**
  - Waarschuwing als recept ingrediënten bevat die huisgenoot niet eet (bijv. bij receptkeuze in maaltijd plan/edit)

- [x] **Offline-ondersteuning** — TanStack Query cache + optimistic updates

- [ ] **Expo EAS Build & Submit**
  - [x] Bundle identifier aanpassen: in `apps/expo/app.config.ts` staat nog `ios.bundleIdentifier` en `android.package: "your.bundle.identifier"` — vervang door echte ID (bijv. `com.prikkr.app`)
  - [ ] iOS TestFlight + Android Play Store intern testen (preview-builds)
  - [ ] Production-build en submit naar App Store / Play Store (`eas build --platform ios --profile production`, daarna `eas submit --latest`)

- [x] **Next.js als backend** — ~~De Next.js-app is de eigenaar van de backend: zij serveert de tRPC-API en Better Auth.~~ Het webdashboard (huishoudenbeheer voor admins) is een extra laag bovenop dezelfde app.

- [x] **Foutafhandeling & lege staten** — vriendelijke UI bij geen data
  - [x] Op cruciale schermen (maaltijdplan, recepten, boodschappen, profiel, instellingen-subpagina’s) duidelijke lege staten met korte uitleg en retry/CTA
  - [x] Bij netwerk-/API-fouten: vriendelijke foutmelding + retry-mogelijkheid; onderscheid tussen “geen huishouden” en “laden mislukt”
  - [x] Mutatiefouten (boodschappen, profiel-opslaan) tonen Alert met retry

- [x] **Performance** — paginering/virtualisatie op lijsten
  - [x] Boodschappenlijst gevirtualiseerd met SectionList + initialNumToRender/windowSize/maxToRenderPerBatch
  - Recepten hadden al paginering (“Meer laden”)

- [x] **Toegankelijkheid** — screen reader labels, voldoende contrast
  - [x] accessibilityLabel, accessibilityRole, accessibilityState en accessibilityHint op maaltijdplan, profiel/instellingen, boodschappen (knoppen, kaarten, switches, links)

**Klaar als:** App is stabiel, ziet er verzorgd uit, en is getest door minimaal 5 echte gebruikers.

---

## Ontwikkelworkflow

```bash
# Installeer dependencies
pnpm install

# Start alle apps tegelijk
pnpm dev

# Alleen Expo starten
pnpm --filter expo dev

# Database schema pushen
pnpm db:push

# Nieuwe migratie genereren
pnpm db:generate

# TypeScript controleren
pnpm typecheck
```

## Omgevingsvariabelen

Zie `.env.example` voor alle benodigde variabelen. Kopieer naar `.env.local` en vul in vanuit het Supabase-dashboard.

---

## Design-backlog (uit `docs/design/prikkr-design-html/`)

De HTML-designs bevatten functionaliteit die in de app nog ontbreekt. Onderstaande punten toevoegen aan de juiste fases of als extra taken.

### Recepten

- [x] **Receptfoto (cover photo)** — ~~Bij recept aanmaken en bewerken een foto kunnen toevoegen~~ (implementatie in `recept/new.tsx` en `recept/edit/[id].tsx` met `useRecipeImageUpload`, upload naar Supabase Storage, `Recipe.imageUrl`).
- [ ] **Recept-detail volgens design** — Grote headerfoto, share-knop, favoriet (heart), tags (bijv. Italian, Medium), bereidingstijd/servings/rating, auteur met avatar, calories/protein (indien beschikbaar), tabs Ingredients/Instructions, portion control (servings aanpassen), ingrediënten afvinken tijdens koken, "Use for Meal" CTA.  
  *(Deels gedaan: tabs, portion control, ingrediënten afvinken, "Use for Meal", imageUrl-tonen.)*
- [x] **Receptenlijst volgens design** — ~~Zoekbalk, filters (All, Vegetarian, Vegan, Quick &lt;30m, High Protein), sectie "House Favorites" (carousel met foto’s), lijst "All Recipes" met thumbnail~~, [ ] favoriet per recept, ~~floating "Add Recipe"-knop~~.
- [ ] **Add/Edit Recipe volgens design** — Cover photo-upload bovenaan; "Bulk Add" voor ingrediënten; optioneel: difficulty (Easy/Medium), custom tags naast presets.

### Boodschappenlijst

- [x] **Weergave** — ~~Filtertabs (All Items, By Aisle, By Recipe); progress-indicator; "Clear Checked"~~ (in `boodschappen.tsx`). Optioneel: per item "Added by" en "For: [receptnaam]" tonen.
- [x] **Handmatig item toevoegen** — ~~Inline toevoegen~~ aanwezig. Optioneel: modal met qty, categorie, note (zoals in design).

### Profiel & voorkeuren

- [x] **Dietary & Allergies** — ~~Basis scherm gekoppeld aan `UserPreferences`~~ (`voorkeuren/dietary.tsx`). Optioneel: verder uitwerken volgens design (toggles/checkboxes, extra velden).

### Maaltijdplanning

- [x] **Plan a meal** — ~~Flow volgens design: datumkiezer (horizontaal), maaltijdtype, recept kiezen, kok kiezen (huisgenoten met checkboxes).~~

### Overige uit design

- [ ] **Recept-metadata** — Optioneel: difficulty, rating (bijv. 4.8 (12)), calories/protein; auteur ("Recipe by …") met avatar.
- [ ] **Recept-favoriet** — Favoriet (heart) per recept, persoonlijk of per huishouden (design laat heart op kaart en in detail zien).

---

## Nog te doen — MVP-afronding & App Store ready

Concrete taken die je één voor één kunt afvinken. Volgorde is een suggestie; pas aan op prioriteit.

### MVP-afronding

1. ~~**Boodschappen: CTA "Genereer uit weekplan" in lege staat**~~ — Gedaan. Knop roept `shoppingList.generate` aan; lege staat toont uitleg en foutfeedback.

2. **Push-herinnering productie-klaar**  
   - In Vercel (of je hosting): omgevingsvariabele `CRON_SECRET` zetten.  
   - Ervoor zorgen dat de cron-job die `/api/cron/attendance-reminder` aanroept de header `Authorization: Bearer <CRON_SECRET>` meestuurt (bijv. in Vercel Cron-configuratie of externe cron-service).  
   - Push testen op een echte device met een TestFlight- of interne build (niet simulator).

3. **Foutafhandeling en lege staten**  
   - Per scherm: maaltijdplan, recepten, boodschappen, profiel — controleren op lege data en een vriendelijke lege staat tonen (icoon + korte tekst + eventueel actie).  
   - Bij netwerk- of tRPC-fouten: geen kale crash; toon een duidelijke foutmelding en een retry-knop of pull-to-refresh.

4. ~~**(Optioneel) Waarschuwing dieet/allergie bij recept**~~  
   Bij het kiezen van een recept in maaltijd plan/edit: als het recept ingrediënten bevat die conflicteren met de dieetwensen of allergieën van een huisgenoot, een waarschuwing tonen (bijv. "Bevat noten — let op voor [naam]").

### App Store ready

5. ~~**Bundle identifier**~~  
   In `apps/expo/app.config.ts`: `ios.bundleIdentifier` en `android.package` aanpassen van `"your.bundle.identifier"` naar een echte identifier (bijv. `com.prikkr.app`). Vereist voor store-builds.

6. **Privacybeleid- en Voorwaarden-URLs**  
   - Een publieke pagina of site met Privacybeleid en Gebruiksvoorwaarden (bijv. onderdeel van je Next.js-app of eigen domein).  
   - In de Expo-app: deze URLs ergens vastleggen (config of env, bijv. `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`) en in de welkomst-/auth-flow en eventueel in profiel/instellingen linken.  
   - In `apps/expo/src/app/(onboarding)/welcome.tsx`: de "Voorwaarden"-Pressable een `onPress` geven die de terms-URL opent (bijv. `Linking.openURL`); evt. ook "en Privacybeleid" in de tekst en een link naar de privacy-URL.

7. **EAS Build & Submit**  
   - Eerste production-build: `cd apps/expo && eas build --platform ios --profile production` (en voor Android idem).  
   - Na goedkeuring: `eas submit --platform ios --latest` (en Android).  
   - Voor iOS: Apple Developer-account, App Store Connect-app en eventueel certificaten; EAS regelt veel automatisch.

8. **Store listing**  
   - Screenshots voor de vereiste formaten (iPhone 6.7", 6.5", etc.; Android idem). EAS Metadata kan helpen.  
   - App-naam, korte/lange beschrijving, keywords, categorie.  
   - Support-URL (verplicht): contact- of supportpagina (bijv. website of mailto:).  
   - In App Store Connect / Play Console: privacy-vragen invullen (welke data je verzamelt, overeenkomstig je privacybeleid).

9. **EAS Update (aanbevolen)**  
   Voor snelle bugfixes na release zonder nieuwe store-review: `eas update:configure` en daarna `eas update --auto` voor OTA-updates. Zie README.

---

## Prioritering (MVP)

De minimaal werkende versie (MVP) bevat Fase 1 t/m 4 plus de kern van Fase 5 (boodschappenlijst):
- Inloggen via magic link
- Huishouden aanmaken / joinen
- Maaltijdplan voor de week
- Aanwezigheid aangeven
- Recepten bewaren (inclusief receptfoto)
- Boodschappenlijst (genereren, afvinken, handmatig toevoegen)

Wat er nog moet voor een afgeronde MVP en voor App Store-release staat in de sectie **Nog te doen — MVP-afronding & App Store ready** hierboven.
