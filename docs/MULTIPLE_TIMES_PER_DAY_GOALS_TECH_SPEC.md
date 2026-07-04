# Multiple Times Per Day Goals - Technical Specification

## 1. Purpose

Add a second goal type for habits that must be completed multiple times in one local calendar day, while preserving the existing once-per-day behavior and reusing the current home screen, progress grid, celebration, streak, and widget flows.

Example:

```ts
Meaningful Eating
3 times per day
```

For these goals, each calendar cell still represents one day. A day is completed only when its per-day count reaches the configured target.

## 2. Goals

- Support two goal types: once per day and multiple times per day.
- Keep existing once-per-day goals visually and behaviorally unchanged.
- Migrate all existing persisted goals to once-per-day goals with a daily target of 1.
- Track count progress per local date for multiple-times-per-day goals.
- Show partial calendar progress with a left-to-right fill for partially completed days.
- Count completed days, streaks, and goal completion based on days whose target was reached, not total taps.
- Run the full completion celebration only when a day first reaches the target.
- Keep widget behavior simple: show today's progress for multiple-times-per-day goals.

## 3. Non-goals

- No separate multi-event history beyond the daily count.
- No custom labels for each daily occurrence.
- No changing the existing weekly schedule model.
- No new navigation route for the new goal type.
- No redesign of the calendar grid.

## 4. Current System Summary

The app currently stores each goal with a `timeline: GoalDayState[]`, where each index maps to one day from `createdAt`.

```ts
type GoalDayState = 'completed' | 'skipped' | 'off';
```

Important current dependencies:

- `src/store/goalTypes.ts` defines the persisted goal shape.
- `src/store/goalStore.tsx` owns create, update, mark, undo, runtime reconciliation, persistence, and widget sync.
- `src/utils/goalValidation.ts` normalizes persisted and legacy goal data.
- `src/utils/goalMetrics.ts` derives skipped days and streaks from `timeline`.
- `src/components/ProgressGrid.tsx` renders day cells from `timeline`.
- `src/screens/HomeScreen.tsx` controls the main CTA, celebration sequence, calendar alerts, and progress display.
- `src/screens/OnboardingScreen.tsx` creates goals.
- `src/screens/EditGoalScreen.tsx` edits goals.
- `src/utils/widgetSnapshot.ts` builds the widget payload.
- `src/i18n/resources.ts` contains localized UI strings.

## 5. Data Model

Keep the existing timeline model for calendar layout and day-state compatibility, and add goal type plus per-date count records.

```ts
export type GoalType = 'oncePerDay' | 'multipleTimesPerDay';

export type GoalRecord = {
  count: number;
};

export type Goal = {
  id: string;
  title: string;
  type: GoalType;
  totalDays: number;
  completedDays: number;
  timeline: GoalDayState[];
  trackedWeekdays: number[];
  lastCompletedDate: string | null;
  createdAt: string;
  updatedAt: string;
  accentColor?: string;
  dailyTarget: number;
  records: Record<string, GoalRecord>;
};
```

### Field Rules

- `type = 'oncePerDay'` means existing behavior.
- `type = 'multipleTimesPerDay'` means `records[date].count` controls daily progress.
- `dailyTarget = 1` for once-per-day goals.
- `dailyTarget` must be an integer from 2 to 10 for multiple-times-per-day goals.
- `records` uses local date keys in `YYYY-MM-DD` format.
- Missing record for a date means count 0.
- `completedDays` remains persisted for the existing UI, but must always equal the number of `timeline` entries with `completed`.
- `lastCompletedDate` means the most recent local date whose target was reached, not the most recent tap.

### Why Keep `timeline`

Replacing `timeline` with records everywhere would touch most grid, streak, skipped-day, edit-start-date, and migration logic. Keeping it reduces risk:

- existing once-per-day behavior stays stable
- skipped and off days keep the same representation
- calendar layout and month grouping stay unchanged
- multiple-times-per-day goals only need records for counts and partial fills

## 6. Migration and Normalization

Update `normalizeGoal` in `src/utils/goalValidation.ts`.

### Existing Goals

For any persisted goal without `type`, `dailyTarget`, or `records`:

```ts
type = 'oncePerDay';
dailyTarget = 1;
records = {};
```

Optionally backfill records for completed once-per-day timeline entries:

```ts
records[date] = { count: 1 };
```

This is useful for consistency, but once-per-day logic can also continue to rely on `timeline`.

### Validation

- Reject goals with invalid `type`.
- Clamp `dailyTarget`:
  - once-per-day: force to 1
  - multiple-times-per-day: clamp to 2..10
- Normalize each record:
  - keep only `YYYY-MM-DD` keys
  - coerce finite numeric counts to integers
  - clamp counts to `0..dailyTarget`
  - drop records with count 0 unless they are needed for compatibility
- After normalizing records, recalculate timeline completion for multiple-times-per-day goals so any date with count >= dailyTarget is `completed`.

## 7. Store API

Extend the store input and update types in `src/store/goalTypes.ts`.

```ts
export type GoalInput = {
  title: string;
  totalDays: number;
  trackedWeekdays?: number[];
  accentColor?: string;
  type?: GoalType;
  dailyTarget?: number;
};

export type GoalUpdate = {
  title?: string;
  totalDays?: number;
  trackedWeekdays?: number[];
  lastCompletedDate?: string | null;
  createdAt?: string;
  accentColor?: string;
  type?: GoalType;
  dailyTarget?: number;
};
```

Recommended store API additions:

```ts
trackOneToday(goalId?: string): Promise<'incremented' | 'completed' | false>;
undoTodayProgress(goalId?: string): Promise<boolean>;
```

Alternative lower-scope option: make `markDone()` branch internally by `goal.type`. This keeps call sites smaller but makes the method name less accurate for multiple-times-per-day goals.

Recommended approach:

- keep `markDone`, `markDay`, `undoDay`, and `undoToday` for once-per-day and calendar day-level operations
- add `trackOneToday` and `undoTodayProgress` for multiple-times-per-day CTA behavior

## 8. Store Behavior

### Create Goal

In `createGoal`:

- default `type` to `oncePerDay`
- default `dailyTarget` to 1
- if `type = multipleTimesPerDay`, default `dailyTarget` to 3
- initialize `records` as `{}`

### Track One Today

For multiple-times-per-day goals:

1. Resolve selected goal.
2. Reject if no goal, goal complete, today is not trackable, or target already reached.
3. Reconcile past timeline first.
4. Read today's count from `records[today]?.count ?? 0`.
5. Increment by 1, clamped to `dailyTarget`.
6. If the new count is below target:
   - persist records only
   - do not increment `completedDays`
   - do not set `lastCompletedDate`
   - return `'incremented'`
7. If the new count reaches target for the first time:
   - mark today's timeline entry as `completed`
   - recalculate `completedDays`
   - set `lastCompletedDate = today`
   - return `'completed'`

### Undo Last Today

For multiple-times-per-day goals:

1. Resolve selected goal.
2. Read today's current count.
3. Reject if count is 0.
4. Decrement count by 1.
5. If count drops below target and today's timeline state was `completed`:
   - change today's timeline entry back to the scheduled state
   - because today should not become a missed day, remove today's trailing timeline entry when it is the last entry, matching current `undoDay(today)` behavior
   - recalculate `completedDays`
   - recalculate `lastCompletedDate` from the timeline
6. Persist and sync widget.

### Past Day Marking

Keep existing calendar alert behavior for once-per-day goals.

For multiple-times-per-day goals, a past scheduled day should support day-level completion from the calendar:

- if the user chooses "Mark as done", set `records[date].count = dailyTarget`
- mark that timeline date `completed`
- this preserves existing calendar affordances without requiring multiple past taps

Lower-scope acceptable option:

- leave past-day count editing out of phase 1
- allow calendar past-day marking to complete the entire day

## 9. Derived Helpers

Add small helpers, either in `goalStore.tsx` or a new utility such as `src/utils/goalProgress.ts`.

```ts
getGoalDailyTarget(goal: Goal): number
getRecordCount(goal: Goal, date: string): number
isGoalDayCompleted(goal: Goal, date: string): boolean
getDateProgressRatio(goal: Goal, date: string): number
setRecordCount(goal: Goal, date: string, count: number): Goal
recalculateGoalCompletion(goal: Goal): Goal
```

Rules:

- once-per-day completion can continue to use `timeline`.
- multiple-times-per-day completion is count >= dailyTarget.
- `completedDays` should be counted from completed timeline states after records are applied.
- streak should count only completed tracked days. Partial days do not extend streak.

## 10. Progress Grid

Extend `src/components/ProgressGrid.tsx` to support optional partial progress.

```ts
type ProgressGridDayProgress = {
  count: number;
  target: numbery
};

type ProgressGridProps = {
  total: number;
  timeline: GoalDayState[];
  elapsedDays: number;
  highlightIndex?: number | null;
  celebrationCellIndex?: number | null;
  celebrationToken?: number;
  startDate?: string;
  trackedWeekdays?: number[];
  records?: Record<string, GoalRecord>;
  dailyTarget?: number;
  goalType?: GoalType;
  onCellPress?: (payload: ProgressGridCellPressPayload) => void;
};
```

### Cell State Rules

For once-per-day goals, render exactly as today.

For multiple-times-per-day goals:

- `count >= dailyTarget`: completed green cell with checkmark
- scheduled past day and `count === 0`: existing skipped/missed cell
- scheduled past day or today and `0 < count < dailyTarget`: partial cell
- future scheduled day: existing future cell
- not scheduled day: existing off style
- today: keep today outline visible even when partially filled

### Partial Fill Visual

Add a partial overlay to `GridCell`:

- same `CELL_SIZE` and `CELL_RADIUS`
- base should use the existing scheduled/future cell styling
- green overlay fills left to right
- width is `(count / dailyTarget) * 100%`
- keep today outline above the partial fill
- optionally render compact text like `1/3` or `2/3`
- partial cells should not have the completed-cell shadow or checkmark

Implementation note:

- use an absolutely positioned `View` for the partial fill
- set `overflow: 'hidden'` on the cell fill container
- place count text above the fill layer if included

## 11. Home Screen UI

Update `src/screens/HomeScreen.tsx`.

### Header

For once-per-day goals, keep current header unchanged.

For multiple-times-per-day goals, show a compact badge under the title:

```txt
3 times per day
```

Use localized text. Avoid emoji as a required semantic marker; icon use is optional.

### Main Counter

Keep the big number as completed days:

```txt
21
days completed
```

Do not show total tap count in the big number.

### Today Progress Block

Show only for multiple-times-per-day goals and only while the goal is not complete.

```txt
Today                         1 / 3 completed

● ○ ○
```

Rules:

- filled dots = today's count
- empty dots = remaining target
- max 10 dots
- use `dailyTarget`
- disabled/completed state should show all dots filled

### CTA

For once-per-day goals:

- label: existing "Mark as done"
- behavior: existing `markDone`

For multiple-times-per-day goals:

- while today's count < dailyTarget:
  - label: "Track one"
  - include a plus icon if practical
  - behavior: `trackOneToday`
- when today's count >= dailyTarget:
  - label: "Done today"
  - disabled

### Undo

For once-per-day goals:

- keep existing calendar-cell undo behavior.

For multiple-times-per-day goals:

- show a compact secondary action "Undo last" only when today's count > 0
- behavior: `undoTodayProgress`
- never decrement below 0
- if today's count falls below target, today is no longer completed

### Celebration

For multiple-times-per-day goals:

- if `trackOneToday` returns `'incremented'`:
  - haptic can run
  - update the progress block and partial grid cell
  - do not show the full celebration overlay
  - do not increment the big number
- if it returns `'completed'`:
  - run the existing full celebration sequence
  - animate today's cell to full green
  - increment the displayed completed-days number by 1

## 12. Create and Edit UI

Update `src/screens/OnboardingScreen.tsx` and `src/screens/EditGoalScreen.tsx`.

### Goal Type Selection

Add a segmented control:

```txt
Goal type
[ Once per day ] [ Multiple times per day ]
```

### Times Per Day Input

Show only when multiple-times-per-day is selected.

```txt
Times per day
[ 3 ]
```

Validation:

- required for multiple-times-per-day
- integer only
- min 2
- max 10
- default 3 when switching to multiple-times-per-day

When switching back to once-per-day:

- set `dailyTarget` to 1

### Editing Existing Goals

Allow editing `type` and `dailyTarget`, but handle history carefully:

- once-per-day to multiple-times-per-day:
  - set target to 3 by default unless user chooses another value
  - existing completed days should get records with count = dailyTarget
- multiple-times-per-day to once-per-day:
  - set dailyTarget to 1
  - any date with count > 0 can be treated as completed only if its timeline state is already completed; do not convert partial historical days into completed days automatically
- changing dailyTarget on multiple-times-per-day:
  - recalculate completed states from existing records
  - if target increases, previously completed days may become partial unless their count still reaches the new target
  - if target decreases, partial days may become completed

Recommended phase 1 simplification:

- allow goal type and target to be set on create
- allow target changes only for goals with no progress
- preserve edit support for title, total days, schedule, start date

If edit support is required for progressed goals, add a confirmation alert explaining that changing the target will recalculate historical completion.

## 13. Widget Snapshot

Update `src/utils/widgetSnapshot.ts`.

```ts
export type WidgetSnapshot = {
  title: string;
  totalDays: number;
  completedDays: number;
  lastCompletedDate: string | null;
  accentColor?: string;
  updatedAt: string;
  type: GoalType;
  dailyTarget: number;
  todayCount: number;
  todayProgressLabel: string;
  isDoneToday: boolean;
};
```

For once-per-day goals:

- `type = 'oncePerDay'`
- `dailyTarget = 1`
- `todayCount = isDoneToday ? 1 : 0`
- widget can keep current display

For multiple-times-per-day goals:

- show title
- if target not reached: `1 / 3 today`
- if target reached: `Done today`

Native widget rendering may need a follow-up if the WidgetKit side expects the old snapshot only. The JS snapshot should be backward-compatible by keeping existing fields.

## 14. Localization

Add keys in all locales in `src/i18n/resources.ts`.

Suggested keys:

```ts
common.trackOne;
common.doneToday;
common.undoLast;
goalType.label;
goalType.oncePerDay;
goalType.multipleTimesPerDay;
goalType.timesPerDay;
goalType.timesPerDayBadge;
goalType.timesPerDayValidation;
home.todayProgress;
home.todayProgressCount;
```

Keep fallback English copy short because the controls are compact.

## 15. Accessibility

- Segment buttons must expose selected state.
- Times-per-day input needs a clear accessibility label.
- Partial grid cells should announce progress:
  - `July 4, 1 of 3 completed`
  - completed days keep existing completed announcement
- "Track one" button should announce today's current count after activation if practical.
- Dots in the progress block should be decorative unless each dot is made individually meaningful.

## 16. Tests

### Unit Tests

Update `__tests__/goalValidation.test.ts`:

- legacy goal normalizes to `oncePerDay`, `dailyTarget = 1`, `records = {}`
- invalid goal type defaults or rejects according to final implementation choice
- multiple-times-per-day daily target clamps to 2..10
- invalid record keys are dropped
- counts clamp to `0..dailyTarget`

Update `__tests__/goalStore.test.tsx`:

- create multiple-times-per-day goal with default target 3
- `trackOneToday` increments record count without completing day below target
- reaching target marks timeline completed and increments `completedDays` by 1
- extra track after target is reached returns false
- undo last decrements count
- undo last below target removes today's completion
- completedDays counts days, not taps
- streak ignores partial days and includes target-reached days
- past-day calendar mark sets count to target

Update `__tests__/date.test.ts` only if new date helpers are added.

### Component Tests

If existing setup supports it:

- `ProgressGrid` renders partial cell text or accessible progress
- Home shows today progress block only for multiple-times-per-day goals
- Home CTA changes from "Track one" to "Done today"

### Manual QA

- Existing once-per-day goal created before migration still works.
- Once-per-day mark, undo, streak, and calendar alerts are unchanged.
- Multiple-times-per-day goal:
  - 0/3 shows no partial fill
  - 1/3 fills roughly one third left to right
  - 2/3 fills roughly two thirds left to right
  - 3/3 becomes full green with checkmark
  - full celebration runs only at 3/3
  - undo from 3/3 to 2/3 removes completed day
  - widget shows `1 / 3 today` before completion and `Done today` after completion

## 17. Implementation Order

1. Update `Goal` types with `GoalType`, `dailyTarget`, and `records`.
2. Add normalization and migration in `goalValidation`.
3. Add progress helper functions.
4. Update store create, update, track, undo, and past-day mark behavior.
5. Update metrics if helper extraction changes streak counting.
6. Extend `ProgressGrid` with optional partial progress rendering.
7. Update Home UI badge, progress block, CTA, undo, and celebration branching.
8. Update Onboarding and Edit UI for goal type and daily target.
9. Update widget snapshot.
10. Add i18n keys for all locales.
11. Add and update tests.
12. Run `yarn test` and a manual visual check of the calendar states.

## 18. Open Decisions

1. Should editing `dailyTarget` be allowed after a goal has progress?
   - Recommended: block in phase 1 or require confirmation with history recalculation.
2. Should partial historical days show `1/3` text inside the small calendar cell?
   - Recommended: include text only if it stays readable at 36px; otherwise rely on accessibility and the today progress block.
3. Should past-day marking for multiple-times-per-day ask for a count?
   - Recommended: no for phase 1. "Mark as done" should complete the day by setting count to target.
4. Should once-per-day goals backfill `records` for completed days?
   - Recommended: optional. Do it if it simplifies shared helper logic.

## 19. Acceptance Criteria

- Existing once-per-day goals still work after migration.
- Old goals migrate to `type = 'oncePerDay'` and `dailyTarget = 1`.
- User can create a multiple-times-per-day goal.
- User can set `dailyTarget`, for example 3.
- Pressing "Track one" increments today's count.
- Partial progress appears as left-to-right fill in the calendar cell.
- `1/3` fills about 33 percent of the cell from left to right.
- `2/3` fills about 66 percent of the cell from left to right.
- `3/3` becomes a full green completed cell.
- Completed-day counter increases only when the daily target is reached.
- Full celebration runs only when daily target is reached.
- "Undo last" decrements today's count correctly.
- Today progress block shows correct dots and count.
- Streak logic is based on completed days, not total taps.
