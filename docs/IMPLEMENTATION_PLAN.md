# One Goal — Implementation Plan (Workstreams)

## Overview
This plan breaks delivery into parallel workstreams with clear dependencies and acceptance criteria. The goal is a focused MVP: single goal, daily check-in, visual progress, celebration, and iOS widgets.

## Workstreams

### WS1 — Project Setup & Tooling
**Scope**
- Expo Router integration (entry point + `app/` structure).
- ESLint + Prettier config.
- Jest + React Native Testing Library setup.
- CI-ready scripts.

**Key Tasks**
- Configure `main` entry for Expo Router.
- Add lint and format scripts.
- Add Jest config and sample test.

**Dependencies**
- None.

**Acceptance Criteria**
- `yarn lint` runs successfully.
- `yarn test` executes at least one passing test.
- App boots with Expo Router.

---

### WS2 — Data Model & Storage
**Scope**
- Goal data model.
- AsyncStorage persistence.
- Day gating logic.
- Store implementation (Context + hooks).

**Key Tasks**
- Implement `Goal` type and storage key.
- Implement `canMarkDone` using local date.
- Implement store actions: load, create, markDone, reset.
- Add unit tests for day gating and store actions.

**Dependencies**
- WS1 (test setup).

**Acceptance Criteria**
- Goal persists across app restarts.
- Mark done blocked on same local day.
- Unit tests for `canMarkDone` and store pass.

---

### WS3 — UI: Onboarding & Home
**Scope**
- Onboarding flow (title + duration).
- Home view with big number, grid, and CTA.

**Key Tasks**
- Create `OnboardingScreen` and `HomeScreen`.
- Build components: `GoalTitleInput`, `DurationPicker`, `PrimaryButton`, `BigNumber`.
- Render grid with completed/remaining states.
- App route shows onboarding if no goal, home otherwise.

**Dependencies**
- WS2 (store).

**Acceptance Criteria**
- User can create goal and reach home.
- Home shows correct `completedDays` and `totalDays`.
- CTA disabled after completion for the day.

---

### WS4 — Progress Grid & Animations
**Scope**
- Render grid (View or SVG).
- Animated number increment.
- Cell transition animation.
- Optional Lottie overlay.

**Key Tasks**
- Implement `ProgressGrid` with `GridCell`.
- Add reanimated number transition on completion.
- Animate cell fill and pulse.
- Integrate optional Lottie animation on completion.

**Dependencies**
- WS3 (UI) and WS2 (store).

**Acceptance Criteria**
- New completion animates number and current cell.
- Celebration overlay appears and dismisses cleanly.

---

### WS5 — Haptics & Feedback
**Scope**
- Haptic feedback on successful completion.

**Key Tasks**
- Add haptic trigger in completion flow.
- Ensure no haptic on blocked (already done today).

**Dependencies**
- WS2 (store) and WS4 (celebration).

**Acceptance Criteria**
- Haptic triggers once on successful completion.

---

### WS6 — iOS Widgets
**Scope**
- App Group storage, WidgetKit extension.
- Native bridge to update widgets from RN.

**Key Tasks**
- Run Expo prebuild to generate iOS project.
- Create WidgetKit extension (small/medium/lock variants).
- Implement snapshot JSON read/write.
- Add native module to write snapshot + reload timelines.
- Trigger widget updates after create/mark/reset.

**Dependencies**
- WS2 (data model), WS1 (project setup).

**Acceptance Criteria**
- Widgets display title + count + compact progress.
- Widgets update after create/mark/reset.

---

### WS7 — QA, Edge Cases & Polish
**Scope**
- Validate edge cases, refine UX.
- Accessibility and layout polish.

**Key Tasks**
- Handle completion at totalDays boundary.
- Verify day gating across timezone changes.
- Add error handling for storage read/write failures.
- Layout polishing for iPhone sizes.

**Dependencies**
- WS2–WS6.

**Acceptance Criteria**
- No crashes in empty state or corrupted storage.
- Button disabled when `completedDays == totalDays`.
- Visual consistency across device sizes.

## Milestones

### Milestone 1 — MVP Shell
**Includes**
- WS1 + WS2 + WS3.

**Exit Criteria**
- User can create a goal, see it on home, and mark done once per day.

---

### Milestone 2 — Delight & Motion
**Includes**
- WS4 + WS5.

**Exit Criteria**
- Celebration animations and haptics work reliably.

---

### Milestone 3 — Widgets
**Includes**
- WS6.

**Exit Criteria**
- Widgets update on create/mark/reset.

---

### Milestone 4 — Polish
**Includes**
- WS7.

**Exit Criteria**
- UX polished, edge cases covered, tests green.

## Sequencing and Parallelization
- WS1 can run immediately.
- WS2 can start once testing is ready (WS1).
- WS3 depends on WS2.
- WS4 and WS5 can run in parallel after WS3 and WS2 are stable.
- WS6 can start after WS2 (data model) and requires prebuild.
- WS7 after all prior streams are stable.

## Risks & Mitigations
- **Widget update reliability**: Use explicit snapshot write + `WidgetCenter.shared.reloadAllTimelines()`.
- **Day gating correctness**: Use local date strings and tests for boundaries.
- **Animation performance**: Use Reanimated; keep grid rendering lightweight (SVG or optimized Views).

## Deliverables Checklist
- App routes + screens.
- Store + AsyncStorage.
- Progress grid + animations + haptics.
- WidgetKit extension + bridge.
- Tests and linting configured.
