# One Goal — Localization Technical Specification

## 1. Purpose
Add first-party localization support for the app UI in the following languages:

- English (`en`)
- Spanish (`es`)
- Portuguese, Brazil (`pt-BR`)
- German (`de`)
- French (`fr`)
- Ukrainian (`uk`)

The goal is to localize the React Native app first, keep the implementation maintainable, and avoid a translation system that is too weak for pluralization and future growth.

## 2. Recommendation

### Recommended stack
- `expo-localization` for device locale detection and supported locale declaration
- `i18next` for translations, interpolation, fallback handling, and plural rules
- `react-i18next` for React Native integration via hooks and providers
- Standard `Intl` APIs for dates, numbers, and locale-aware formatting

### Why this stack
- `expo-localization` is the correct Expo-native source of truth for device locale and supported locales.
- `react-i18next` is a mature React / React Native integration layer on top of `i18next`.
- `i18next` handles pluralization better than a minimal key-value string approach, which matters for strings like:
  - `1 day completed`
  - `2 days completed`
  - `5 day streak`
- This app already has dynamic strings, alerts, status labels, and schedule-related text. The project should use a library that scales past MVP copy replacement.

### Explicit non-recommendation
Do not use a hand-rolled translation object without a library. It is acceptable for prototypes, but it becomes brittle once pluralization, interpolation, and fallback behavior start spreading across screens and widgets.

## 3. Scope

### In scope
- Onboarding screen text
- Home screen text
- Edit Goal / settings screen text
- Grid cell alerts and confirmation dialogs
- Celebration overlay messages
- Button labels
- Validation and helper text
- Widget strings, if the widget contains user-facing English copy

### Out of scope for phase 1
- In-app manual language picker
- Remote translation delivery
- Translation management platform
- Localized App Store metadata
- RTL layout support

## 4. Product Behavior

### Locale source
- Phase 1 should use the device or per-app system language.
- No custom in-app language selector is required initially.
- If the device locale is unsupported, the app should fall back to English.

### Fallback behavior
- Fallback language: English (`en`)
- Missing translation key behavior:
  - Development: log missing keys
  - Production: fall back to English

### Supported locale list
- `en`
- `es`
- `pt-BR`
- `de`
- `fr`
- `uk`

Note:
- Brazilian Portuguese should be stored as `pt-BR`, not generic `pt`, because product copy and phrasing are market-specific.

## 5. Architecture

### 5.1 New dependencies
- `expo-localization`
- `i18next`
- `react-i18next`

### 5.2 Suggested file structure
```txt
src/i18n/
  index.ts
  resources/
    en.json
    es.json
    pt-BR.json
    de.json
    fr.json
    uk.json
  format.ts
```

Optional:
```txt
src/i18n/types.ts
```

### 5.3 Initialization
Create `src/i18n/index.ts` to:
- read current locale from `expo-localization`
- normalize locale to one of the supported language codes
- initialize `i18next`
- set fallback language to `en`
- export the configured i18n instance

### 5.4 App bootstrap
Initialize i18n before rendering routed screens.

Recommended integration points:
- app entry
- app root layout
- top-level provider component

## 6. Translation Strategy

### 6.1 Key naming
Use stable semantic keys, not English sentence keys.

Examples:
```json
{
  "home.markDone": "Mark as done",
  "home.completedDays_one": "{{count}} day completed",
  "home.completedDays_other": "{{count}} days completed",
  "home.streak_one": "{{count}} day streak",
  "home.streak_other": "{{count}} days streak",
  "goal.reset": "Reset goal",
  "goal.totalDays": "Total days"
}
```

### 6.2 Dynamic strings
Use interpolation for:
- counts
- dates inserted into alert text
- next check-in day names
- start date labels

### 6.3 Dates and numbers
Do not translate dates and numbers manually.

Use `Intl.DateTimeFormat` and `Intl.NumberFormat` with the active locale for:
- `Started Mar 16`
- `Next check-in Thursday`
- large number labels if formatting is needed later

## 7. Locale Normalization Rules

The app should normalize device locales to supported app locales.

Examples:
- `en-US` -> `en`
- `en-GB` -> `en`
- `es-ES` -> `es`
- `es-MX` -> `es`
- `pt-BR` -> `pt-BR`
- `pt-PT` -> fallback decision:
  - phase 1: map to `pt-BR` only if product accepts that tradeoff
  - safer default: fallback to `en`
- `uk-UA` -> `uk`
- unsupported locale -> `en`

Recommendation:
- Keep locale matching explicit, not fuzzy.
- Do not silently map all Portuguese users to Brazilian Portuguese unless product approves that.

## 8. Widget Localization

The app includes an iOS widget, so localization cannot stop at React Native UI.

### Phase 1 recommendation
- Localize widget strings that are visible to users.
- Keep widget text minimal.
- Use native iOS localization files for widget strings if needed.

If the widget currently uses almost no text, it is acceptable to:
- localize the main app first
- localize widget copy in the same workstream if user-facing English remains visible

## 9. Native App Locale Declaration

The project should declare supported locales in app config so iOS and Android can expose supported app languages correctly.

This should be added through the `expo-localization` config plugin with the supported locale list for both platforms.

Planned config shape:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-localization",
        {
          "supportedLocales": {
            "ios": ["en", "es", "pt-BR", "de", "fr", "uk"],
            "android": ["en", "es", "pt-BR", "de", "fr", "uk"]
          }
        }
      ]
    ]
  }
}
```

## 10. Implementation Workstreams

### Workstream A — Foundation
- Install dependencies
- Add i18n bootstrap
- Add locale normalization helper
- Wire top-level provider initialization

### Workstream B — String extraction
- Inventory all current hard-coded user-facing strings
- Group by screen/component
- Replace literals with translation keys

### Workstream C — Translation resources
- Create `en.json` as source-of-truth copy
- Create `es.json`, `pt-BR.json`, `de.json`, `fr.json`, `uk.json`
- Ensure plural keys exist where counts are used

### Workstream D — Formatting
- Route date formatting through locale-aware formatters
- Route count-based labels through i18next pluralization

### Workstream E — Native configuration
- Add `expo-localization` plugin
- Declare supported locales in app config
- Verify iOS per-app language support

### Workstream F — Widget localization
- Audit current widget copy
- Localize remaining visible strings if needed

### Workstream G — QA and regression coverage
- Add unit tests for locale selection and fallback
- Add smoke tests for major screens in at least `en` and one secondary locale
- Verify layout resilience for longer translated strings

## 11. Testing Plan

### Unit tests
- locale normalization
- fallback to English
- plural keys for `completedDays` and `streak`
- date formatting helper output

### Manual QA
- device/app language set to each supported locale
- onboarding flow
- home screen with:
  - completed state
  - rest day state
  - skipped day state
  - undo confirmations
- settings screen
- celebration overlay
- widget text if applicable

### Layout QA focus
- French and German string expansion
- Ukrainian text length and wrapping
- button width and modal alerts

## 12. Migration Notes

The app currently contains hard-coded English strings across screens and components. This means phase 1 is primarily a string extraction and replacement pass, not a data-model migration.

No stored user data migration is required for app UI localization.

## 13. Risks

### Risk 1 — Incomplete extraction
If one or two strings remain hard-coded, the app will feel partially translated.

Mitigation:
- do a complete string inventory before implementation

### Risk 2 — Pluralization bugs
Count-based labels can become grammatically wrong if translated as plain concatenation.

Mitigation:
- use i18next plural keys from the start

### Risk 3 — Locale mismatch
Region-specific locale mapping can produce wrong copy, especially for Portuguese.

Mitigation:
- use explicit locale normalization rules

### Risk 4 — Widget drift
Main app may be localized while the widget remains English.

Mitigation:
- include widget audit in the same implementation plan

## 14. Recommended Rollout

### Phase 1
- Foundation
- App UI localization
- Supported locale declaration
- English + placeholder translation files for all target languages

### Phase 2
- Human-reviewed translations
- Widget localization completion
- Native metadata localization if desired

### Phase 3
- Optional in-app language override
- Optional translation management workflow

## 15. Decision

Recommended implementation:
- `expo-localization` + `i18next` + `react-i18next`
- device/per-app system language only in phase 1
- explicit supported locales:
  - `en`
  - `es`
  - `pt-BR`
  - `de`
  - `fr`
  - `uk`
- English fallback
- `Intl` for dates and numbers

This is the correct balance for this app:
- strong enough for production
- simple enough to ship quickly
- compatible with Expo and React Native
