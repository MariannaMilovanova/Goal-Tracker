# One Goal — Multiple Goals / True Focus Technical Specification

## 1. Purpose
Refactor the app from a single-goal product into a multi-goal product that still preserves the core "True Focus" philosophy:

- users may track up to 10 goals
- only one goal is the True Focus goal at a time
- the True Focus goal is the default goal shown on app launch
- widgets continue to represent only the True Focus goal

This change must preserve the existing per-goal tracking behavior:

- tracked weekdays
- skipped / off / completed history
- start date
- streak calculation
- completion animation flow
- widget updates

## 2. Product Principles

### 2.1 Primary principle
The app is not becoming a generic goals dashboard. It remains a focus-first product.

Multiple goals are allowed, but one goal must remain visually and behaviorally primary.

### 2.2 Resulting UX rule
- app launch opens the True Focus goal by default
- the home goal screen still feels like the main destination
- the goals list is secondary navigation, not the primary landing experience

## 3. Current State

The current app persists a single `Goal` object under one AsyncStorage key and renders either:

- onboarding if no goal exists
- home screen if a goal exists

Current goal model is timeline-based and includes:

- `title`
- `totalDays`
- `completedDays`
- `timeline`
- `trackedWeekdays`
- `lastCompletedDate`
- `createdAt`
- optional `accentColor`

The current widget snapshot is derived from that single active goal.

## 4. Goals and Non-goals

### Goals
- support up to 10 goals
- support one explicit True Focus goal
- preserve existing tracking logic per goal
- add a goals list screen
- allow opening any goal without changing True Focus
- allow explicitly setting any goal as True Focus
- migrate existing single-goal storage automatically
- keep widget behavior bound to True Focus only

### Non-goals
- nested goal categories
- archived goals
- cross-goal analytics
- goal sorting / drag reorder
- shared progress summaries across all goals
- multiple widgets for multiple goals

## 5. Data Model

## 5.1 Goal model
The app should retain the current timeline-based model and extend it with identifiers and metadata.

Recommended type:

```ts
type Goal = {
  id: string;
  title: string;
  totalDays: number;
  completedDays: number;
  timeline: GoalDayState[];
  trackedWeekdays: number[];
  lastCompletedDate: string | null;
  createdAt: string;
  updatedAt: string;
  accentColor?: string;
};
```

Notes:
- `createdAt` continues to serve as the goal start / timeline anchor in the current implementation
- `updatedAt` should be added for list ordering, conflict resolution, and future sync readiness
- keep `timeline` as the source of truth for completion history because current UI and logic already rely on it

## 5.2 State model

Recommended persisted root state:

```ts
type GoalsState = {
  goals: Goal[];
  trueFocusGoalId: string | null;
  selectedGoalId: string | null;
};
```

### Why include `selectedGoalId`
This is not strictly required by the product brief, but it is the cleanest way to support:

- opening a non-focus goal from the goals list
- editing the currently opened goal
- returning from settings without losing context

Behavior:
- `selectedGoalId` controls the currently opened goal in-app
- `trueFocusGoalId` controls the default goal on launch and the widget source

If the team wants lower scope, `selectedGoalId` can remain in memory only instead of persisted. Persisting it is acceptable if the desired UX is "reopen the last goal you were viewing during the same product session model". If the desired UX is strictly "always launch into True Focus", then:

- persist `trueFocusGoalId`
- do not persist `selectedGoalId`
- initialize selected goal from True Focus on load

Recommended product behavior here:
- do **not** persist `selectedGoalId`
- always default to True Focus on cold launch

Therefore the persisted shape should stay:

```ts
type GoalsState = {
  goals: Goal[];
  trueFocusGoalId: string | null;
};
```

And `selectedGoalId` should exist only in store state, not in storage.

## 5.3 Goal limits
- maximum goals: `10`
- minimum goals: `0`

Store must enforce the max goal count, not just UI.

## 6. Store Architecture

## 6.1 Replace single-goal store shape
Current store returns:

- `goal`

New store should return:

```ts
type GoalStore = {
  goals: Goal[];
  trueFocusGoalId: string | null;
  selectedGoalId: string | null;
  selectedGoal: Goal | null;
  isLoading: boolean;
  loadGoals: () => Promise<void>;
  createGoal: (input: GoalInput) => Promise<Goal | null>;
  updateGoal: (goalId: string, updates: GoalUpdate) => Promise<Goal | null>;
  resetGoal: (goalId: string) => Promise<void>;
  markDone: (goalId?: string) => Promise<boolean>;
  markDay: (goalId: string, date: string) => Promise<boolean>;
  undoDay: (goalId: string, date: string) => Promise<boolean>;
  setSelectedGoal: (goalId: string | null) => void;
  setTrueFocusGoal: (goalId: string) => Promise<void>;
};
```

Recommended convenience behavior:
- if `goalId` is omitted in actions like `markDone`, operate on `selectedGoal`
- all persistence logic should still resolve by explicit goal ID internally

## 6.2 Per-goal action model
All current actions must become goal-scoped:

- `markDone(goalId)`
- `markDay(goalId, date)`
- `undoDay(goalId, date)`
- `updateGoal(goalId, updates)`
- `resetGoal(goalId)`

This is the most important correctness rule in the refactor.

If actions remain implicitly global, state corruption across goals becomes likely.

## 6.3 Goal lookup strategy
Use goal ID for all mutations.

Recommended internal pattern:

```ts
const index = goals.findIndex((goal) => goal.id === goalId);
```

Avoid title-based lookup entirely.

## 6.4 True Focus setter
`setTrueFocusGoal(goalId)` should:

- validate that `goalId` exists
- set `trueFocusGoalId = goalId`
- leave all goal content untouched
- update widget snapshot from that goal

## 6.5 Selected goal resolution
Derived helper:

```ts
function getDefaultGoalId(goalsState): string | null
```

Rules:
- if `trueFocusGoalId` exists and matches a goal, use it
- otherwise use the first goal in the array
- otherwise return `null`

On load:
- `selectedGoalId = getDefaultGoalId(state)`

On deleting the selected goal:
- `selectedGoalId = getDefaultGoalId(nextState)`

On opening a goal from the list:
- set `selectedGoalId` to that goal ID
- do not change `trueFocusGoalId`

## 7. Persistence and Migration

## 7.1 New storage shape
Replace current single-goal storage payload with:

```ts
type PersistedGoalsState = {
  goals: Goal[];
  trueFocusGoalId: string | null;
};
```

Keep the storage key stable if desired, but the payload format changes.

Recommended:
- keep the same AsyncStorage key
- migrate its value by shape

## 7.2 Migration cases

### Case A — empty storage
Input:
- `null`

Output:

```ts
{
  goals: [],
  trueFocusGoalId: null
}
```

### Case B — current single-goal payload
Input:
- existing `Goal`

Output:

```ts
{
  goals: [{ ...existingGoal, id, updatedAt }],
  trueFocusGoalId: generatedId
}
```

Migration rules:
- generate a stable new `id`
- set `updatedAt = existingGoal.createdAt` or `new Date().toISOString()`
- preserve timeline/history exactly
- set migrated goal as True Focus

### Case C — already migrated payload
Input:
- `PersistedGoalsState`

Output:
- normalized `PersistedGoalsState`

## 7.3 Normalization
Add:

- `normalizeGoal(raw): Goal | null`
- `normalizeGoalsState(raw): PersistedGoalsState`

Responsibilities:
- validate goal arrays
- enforce max 10 goals
- ensure `trueFocusGoalId` points to an existing goal or becomes `null`
- preserve current timeline normalization rules per goal

## 8. Widget Behavior

## 8.1 Source goal
Widget snapshot should be built from:

```ts
goals.find((goal) => goal.id === trueFocusGoalId)
```

Fallback:
- if missing, use first goal
- if no goals, clear widget snapshot

Recommended exact behavior:
- use True Focus if valid
- else first existing goal
- else empty widget state

This is slightly more robust than forcing `null` when `trueFocusGoalId` is invalid.

## 8.2 Widget update triggers
Widget sync should happen when:

- goal content changes for the current True Focus goal
- `trueFocusGoalId` changes
- goals array becomes empty
- the True Focus goal is deleted

Widget sync does **not** need to run when a non-focus goal changes, unless that change also changes focus selection or the fallback focus target.

## 9. Navigation

## 9.1 Entry behavior
Current:
- `app/index.tsx` shows home or onboarding based on `goal`

New:
- show onboarding / empty state if `goals.length === 0`
- otherwise resolve and show the selected goal, initialized from True Focus

## 9.2 New screen
Add:

- `GoalsListScreen`
- route: `app/goals.tsx`

## 9.3 Header actions
Home goal screen should add:

- goals/list icon
- settings icon

Recommended order:
- goals list icon
- settings icon

Behavior:
- goals icon -> push `/goals`
- settings icon -> edit selected goal

## 9.4 Detail navigation model
The app does not need a dedicated route per goal ID in phase 1.

Recommended approach:
- keep one home screen route
- store `selectedGoalId` in app state
- opening a goal from the list just changes store state and navigates back

This is simpler than introducing parameterized routes like `/goal/[id]`.

## 10. Goals List Screen

## 10.1 Purpose
Display all goals and allow the user to:

- open a goal
- see which goal is True Focus
- set another goal as True Focus
- create a goal if under the 10-goal cap

## 10.2 Goal card content
Each card should show:

- title
- completed days / total days
- current streak
- compact progress preview
- True Focus badge if applicable

Recommended derived values:
- streak should reuse current home-screen streak logic
- progress preview can reuse a compact `ProgressGrid` variant or a small horizontal summary bar

## 10.3 Card actions

### For any goal
- tapping the card opens that goal

### For non-focus goals
- show `Make True Focus`

### For focus goal
- show badge only
- no redundant "already focus" button

## 10.4 Create goal CTA
If `goals.length < 10`:
- show `Create goal`

If `goals.length >= 10`:
- disable CTA
- show helper text:
  - `You can track up to 10 goals.`

## 11. Goal Creation Flow

## 11.1 First goal
When first goal is created:
- insert new goal
- set `trueFocusGoalId = goal.id`
- set `selectedGoalId = goal.id`

## 11.2 Additional goals
When another goal is created:
- insert new goal
- leave existing True Focus unchanged
- optionally set `selectedGoalId = newGoal.id` if onboarding should open the newly created goal immediately

Recommended UX:
- after creating an additional goal, open that newly created goal
- do not change True Focus automatically

This respects the user's action without diluting the True Focus concept.

## 11.3 Creation entry points
The app should support:

- first-goal onboarding flow
- create-from-goals-list flow for additional goals

Recommended implementation:
- reuse `OnboardingScreen` as a generic goal creation screen
- allow it to behave differently depending on whether goals already exist

## 12. Edit / Reset / Delete Behavior

## 12.1 Edit goal
Edit screen operates only on `selectedGoal`.

All updates must be written by goal ID.

## 12.2 Reset goal
Clarify product meaning:

- current `resetGoal` deletes the entire goal
- there is also "start again" behavior that resets progress only

These are different actions and should remain distinct.

Recommended naming:
- `deleteGoal(goalId)` for destructive removal of a goal
- `restartGoal(goalId)` or `resetProgress(goalId)` for progress-only reset

This is worth cleaning up during the refactor because the current single-goal API name will become ambiguous with multiple goals.

## 12.3 If deleted goal was True Focus
When deleting a goal:

- remove it from `goals`
- if deleted goal ID === `trueFocusGoalId`, choose a replacement:
  - first remaining goal, if any
  - otherwise `null`

- also re-resolve `selectedGoalId`

## 13. Per-goal Derived Logic

The following must become goal-specific helpers:

- `reconcilePastTimeline(goal, today)`
- `ensureCompletedDays(goal)`
- `getGoalStartDate(goal)`
- `getLastCompletedDateFromTimeline(goal, timeline)`
- streak calculation
- visible total days calculation
- completion eligibility

Do not move these into global state. They should operate on one goal at a time.

## 14. UI State and Screen Behavior

## 14.1 Home screen
Home screen should read `selectedGoal`, not global `goal`.

If `selectedGoal` is null:
- show onboarding / empty state

## 14.2 Empty state
If there are no goals:
- show the current onboarding / create-goal experience

## 14.3 Settings screen
Edit only the currently selected goal.

This avoids introducing another goal selector inside settings.

## 15. Error Handling and Edge Cases

## 15.1 True Focus points to missing goal
Possible after bad data or migration issues.

Behavior:
- fall back to first goal
- repair state in memory and persist corrected `trueFocusGoalId`

## 15.2 Selected goal points to missing goal
Behavior:
- resolve to True Focus
- else first goal
- else null

## 15.3 Max goals exceeded by corrupt storage
Behavior:
- truncate to first 10 normalized goals
- log warning
- persist repaired state

## 15.4 Duplicate goal IDs
Behavior:
- keep first valid occurrence
- drop duplicates during normalization

## 15.5 No True Focus after deleting all goals
Behavior:
- `trueFocusGoalId = null`
- clear widget snapshot
- show onboarding / empty state

## 16. Testing Strategy

## 16.1 Unit tests
Add tests for:

- migration from single goal to multi-goal state
- create first goal -> becomes True Focus
- create second goal -> first remains True Focus
- set True Focus -> previous focus cleared
- deleting True Focus -> fallback goal selected
- deleting last goal -> empty state and cleared focus
- mark done for selected goal only
- mark / undo past days on one goal does not affect another
- widget snapshot selection from True Focus goal

## 16.2 Component tests
Add tests for:

- app entry with no goals -> onboarding
- app entry with goals -> selected True Focus goal
- goals list rendering
- tapping goal card opens that goal
- tapping `Make True Focus` updates badge/state
- create CTA disabled at 10 goals

## 16.3 Manual QA
Verify:

- first install
- migration from old storage
- multiple goals with different schedules
- deleting focused goal
- switching between goals
- widget updates after focus change

## 17. Implementation Plan

### Workstream A — Data model and migration
- add `id` and `updatedAt` to goal model
- add `GoalsState`
- add normalization and migration

### Workstream B — Store refactor
- replace single-goal store with multi-goal store
- add `selectedGoalId`
- scope all mutations by goal ID

### Workstream C — Navigation
- add goals list route
- add goals icon to home header
- wire selected goal switching

### Workstream D — Goals list UI
- render cards
- True Focus badge
- `Make True Focus` action
- create-goal CTA and cap handling

### Workstream E — Settings / deletion / restart flows
- make edit goal operate on selected goal only
- split delete vs restart semantics if needed

### Workstream F — Widget compatibility
- derive snapshot from True Focus goal
- handle empty fallback

### Workstream G — Regression coverage
- migration tests
- per-goal mutation tests
- navigation behavior tests

## 18. Recommended Decisions

Recommended implementation choices:

1. Keep the current timeline-based goal model.
2. Introduce `id` and `updatedAt` on each goal.
3. Persist:
   - `goals`
   - `trueFocusGoalId`
4. Keep `selectedGoalId` in store state, not persisted.
5. Use one home route plus store-level selected goal switching.
6. Add a dedicated goals list screen.
7. Keep widgets bound only to True Focus.
8. Migrate old single-goal storage automatically.

## 19. Acceptance Mapping

This spec satisfies the requested acceptance criteria by design:

- multiple goals supported
- max count 10
- first goal auto-focuses
- only one True Focus goal at a time
- app opens focus goal by default
- goals list accessible from home
- switching goals does not change focus
- explicit focus reassignment supported
- widget remains bound to True Focus
- old storage migrates
- existing tracking logic remains per goal

## 20. Summary

The clean architecture is:

- many goals in storage
- one True Focus goal in persistent state
- one selected goal in UI state

That separates three concerns correctly:

- persistence of all user goals
- product-level primary focus
- current in-app viewing context

This is the lowest-risk way to add multi-goal support without breaking the existing timeline-based tracking model.
