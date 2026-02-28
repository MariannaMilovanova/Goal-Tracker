# One Goal — Implementation Plan (Workstreams)

## Overview
This plan breaks delivery into parallel workstreams with clear dependencies and acceptance criteria. The goal is a focused MVP: single goal, daily check-in, visual progress, celebration, and iOS widgets.

---

## Feature Plan — Allow Editing Goal (Must Have)

### Scope
Add an “Edit Goal” flow so a user can change title, total days, and (optionally) progress. Provide a reset option. Keep UI minimal.

### UX Summary
Home screen shows a small ⚙️ icon in the top-right that opens the Edit Goal screen. The screen allows:
1. Edit title
2. Edit total days
3. Edit completed days behind an “Advanced” toggle
4. Reset goal (destructive, with confirmation)

### Data & Store Changes
1. Extend store update API to accept `completedDays` and an optional `lastCompletedDate` override (or a flag indicating whether “today” should be counted).
2. Clamp and validate values: `title` required and trimmed, `totalDays` minimum 1, `completedDays` between 0 and `totalDays`.
3. When `completedDays` is edited, set `lastCompletedDate` to `null` unless the user explicitly chooses to mark today as done. This avoids blocking the next check-in.
4. Ensure widget snapshot is updated after edits.

### UI & Navigation
1. Add top-right settings/gear button in Home header (no new dependencies required).
2. Add new screen route `app/edit-goal.tsx`.
3. Edit screen layout: title input, total days input or picker, “Advanced” toggle for editing completed days, completed days input shown only when toggle is on with helper text, primary “Save” button, secondary “Reset Goal” action with confirmation.
4. On save, navigate back to Home and update store.
5. On reset, clear goal and navigate to onboarding.

### Validation & Edge Cases
1. If `totalDays` is reduced below current `completedDays`, clamp `completedDays` and show a brief warning.
2. If `completedDays == totalDays`, Home should show completed state and disable check-in.
3. Editing title should keep case and spacing normalized (trim).

### Tests
1. Store unit tests: editing title updates and persists, editing total days clamps completed days, editing completed days respects bounds and clears `lastCompletedDate` by default.
2. UI sanity: edit screen renders with existing values, save calls update and returns to Home, reset clears goal and returns to onboarding.

### Dependencies
Requires WS2 (store) and WS3 (UI).

### Acceptance Criteria
1. User can edit title and total days.
2. User can optionally edit completed days via advanced toggle.
3. Reset goal clears all data and returns to onboarding.
4. Widgets reflect changes immediately after save/reset.

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
