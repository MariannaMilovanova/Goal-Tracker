# Goal List Delete - Technical Specification

## 1. Purpose

Add a way to delete a goal directly from the goals list screen.

Today the app supports multiple goals and the store already has destructive removal behavior, but the goals list UI only supports:

- opening a goal
- setting a goal as True Focus
- creating another goal

The user should be able to remove an unwanted goal without opening it first.

## 2. Current Implementation

Relevant files:

- `src/screens/GoalsListScreen.tsx`
- `src/store/goalStore.tsx`
- `src/screens/EditGoalScreen.tsx`
- `src/i18n/resources.ts`
- `__tests__/goalStore.test.tsx`

Current store behavior:

- `resetGoal(goalId?)` removes the target goal from `goals`
- if the deleted goal was True Focus, it falls back to the first remaining goal
- if the deleted goal was selected, it re-resolves `selectedGoalId`
- if no goals remain, storage is removed and the widget snapshot is cleared through the existing `commitGoals` flow

Current naming issue:

- `resetGoal()` is destructive deletion
- `restartGoal()` resets progress and keeps the goal

For this feature, the destructive action should be exposed as `deleteGoal()` so UI code and tests are explicit.

Required behavior change:

- a goal marked as True Focus must not be deletable
- this must be enforced in the store, not only hidden in the UI

## 3. Product Requirements

### 3.1 User story

As a user with multiple goals, I can delete any non-True Focus goal from the goals list so that old or unwanted goals no longer appear.

### 3.2 UX requirements

- Each non-True Focus goal card in `GoalsListScreen` has a delete affordance.
- The affordance uses a trash icon button, not a large text CTA.
- The True Focus goal does not have an enabled delete affordance.
- Tapping delete does not open the goal card.
- Deletion requires a destructive confirmation dialog.
- The confirmation names the goal being deleted.
- After deletion, the list updates immediately.
- If there is only one goal, it is True Focus and cannot be deleted from this flow.

### 3.3 Non-goals

- No archive state.
- No undo snackbar.
- No bulk delete.
- No soft delete or recovery.
- No reorder changes.
- No "clear all goals" flow.

## 4. Data and Store Changes

### 4.1 Store API

Add a new explicit destructive method to `GoalStore`:

```ts
deleteGoal: (goalId?: string) => Promise<boolean>;
```

Recommended behavior:

- if `goalId` is omitted, delete the selected goal
- return `false` if there is no selected goal or the requested ID does not exist
- return `false` if the requested goal is the current True Focus goal
- return `true` after state, persistence, and widget sync complete

Keep `resetGoal` temporarily only if existing screens still use it:

```ts
resetGoal: (goalId?: string) => Promise<void>;
```

Implementation should delegate to `deleteGoal`:

```ts
const deleteGoal = useCallback(
  async (goalId?: string) => {
    const activeGoalId = goalId ?? selectedGoalIdRef.current;
    if (!activeGoalId) {
      return false;
    }

    const currentGoals = goalsRef.current;
    if (!currentGoals.some((goal) => goal.id === activeGoalId)) {
      return false;
    }

    const currentSelectedGoalId = selectedGoalIdRef.current;
    const currentTrueFocusGoalId = trueFocusGoalIdRef.current;
    if (activeGoalId === currentTrueFocusGoalId) {
      return false;
    }

    const nextGoals = currentGoals.filter((goal) => goal.id !== activeGoalId);
    const nextSelectedGoalId =
      currentSelectedGoalId === activeGoalId
        ? getDefaultGoalId(nextGoals, currentTrueFocusGoalId)
        : currentSelectedGoalId;

    await commitGoals(nextGoals, currentTrueFocusGoalId, nextSelectedGoalId);
    return true;
  },
  [commitGoals],
);

const resetGoal = useCallback(
  async (goalId?: string) => {
    await deleteGoal(goalId);
  },
  [deleteGoal],
);
```

### 4.2 Persistence

No storage schema change is required.

The existing persisted shape remains:

```ts
type GoalsState = {
  goals: Goal[];
  trueFocusGoalId: string | null;
};
```

Deletion should continue using `commitGoals()`, because that path already:

- applies in-memory state
- persists state to AsyncStorage
- removes the storage key when there are zero goals
- syncs or clears the widget snapshot

### 4.3 True Focus guard

The current True Focus goal cannot be deleted.

Rules:

- `deleteGoal(trueFocusGoalId)` returns `false`
- no state is changed
- AsyncStorage is not written
- widget snapshot is not changed

If a user wants to remove a goal that is currently True Focus, they must first set a different goal as True Focus, then delete the old goal.

### 4.4 Selected goal fallback

If the deleted goal is currently selected:

1. Select the True Focus goal if it still exists.
2. Otherwise select the first remaining goal.
3. Otherwise set `selectedGoalId` to `null`.

Use the existing `getDefaultGoalId(nextGoals, currentTrueFocusGoalId)` helper.

## 5. UI Changes

### 5.1 Goals list screen

Update `GoalsListScreen` to read `deleteGoal` from the store:

```ts
const {
  goals,
  trueFocusGoalId,
  selectedGoalId,
  setSelectedGoal,
  setTrueFocusGoal,
  deleteGoal,
  canCreateMoreGoals,
} = useGoalStore();
```

Add an `onDelete` prop to `GoalCard`:

```ts
function GoalCard({
  goal,
  isTrueFocus,
  isSelected,
  onOpen,
  onMakeTrueFocus,
  onDelete,
}: {
  goal: Goal;
  isTrueFocus: boolean;
  isSelected: boolean;
  onOpen: () => void;
  onMakeTrueFocus: () => void;
  onDelete: () => void;
}) { ... }
```

Add a trash icon button in the card header/top row:

```tsx
{
  !isTrueFocus ? (
    <Pressable
      onPress={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      style={styles.iconAction}
      accessibilityRole="button"
      accessibilityLabel={t('goals.deleteGoalAccessibility', { title: goal.title })}
    >
      <Ionicons name="trash-outline" size={18} color="#B42318" />
    </Pressable>
  ) : null;
}
```

Implementation notes:

- The card itself is already a `Pressable`; the delete button must call `event.stopPropagation()`.
- Keep the delete target at least `36 x 36`.
- Do not render an enabled delete button for the True Focus card.
- Do not place delete next to "Make True Focus" as another large text action; the destructive action should be visually secondary but discoverable.

### 5.2 Confirmation dialog

Add a handler in `GoalsListScreen`:

```ts
const handleDeleteGoal = (goal: Goal) => {
  Alert.alert(t('goals.deleteGoalTitle'), t('goals.deleteGoalDescription', { title: goal.title }), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.delete'),
      style: 'destructive',
      onPress: async () => {
        await deleteGoal(goal.id);
      },
    },
  ]);
};
```

The handler should only be wired for non-True Focus goals. The store guard still protects against accidental or future callers attempting to delete the True Focus goal.

### 5.3 Edit screen cleanup

Update `EditGoalScreen` to use `deleteGoal` for destructive removal.

Recommended copy change:

- button: `Delete goal`
- title: `Delete goal?`
- description: `This will permanently delete this goal and all progress.`
- confirmation action: `Delete`

This avoids the current ambiguity where `resetGoal` deletes the whole goal while `restartGoal` resets progress.

If the selected goal is True Focus, do not show an enabled delete action on the edit screen. The user must choose another True Focus goal from the goals list first.

## 6. Localization

`GoalsListScreen` currently has hardcoded English strings. For this feature, add `useTranslation()` and introduce a `goals` namespace in every locale in `src/i18n/resources.ts`.

Minimum new keys:

```ts
common: {
  delete: 'Delete',
},
goals: {
  title: 'Goals',
  trueFocus: 'True Focus',
  makeTrueFocus: 'Make True Focus',
  daysCompleted: '{{completed}} / {{total}} days completed',
  streak_one: '{{count}} day streak',
  streak_other: '{{count}} day streak',
  limit: 'You can track up to {{count}} goals.',
  deleteGoalAccessibility: 'Delete {{title}}',
  deleteGoalTitle: 'Delete goal?',
  deleteGoalDescription: 'This will permanently delete "{{title}}" and all progress.',
  trueFocusCannotDelete: 'Choose another True Focus goal before deleting this one.',
},
editGoal: {
  deleteGoal: 'Delete goal',
  deleteGoalTitle: 'Delete goal?',
  deleteGoalDescription: 'This will permanently delete this goal and all progress.',
  trueFocusCannotDelete: 'Choose another True Focus goal before deleting this one.',
},
```

Add equivalent entries for Spanish, Portuguese, and German. If translating all existing list strings is considered too much for this feature, at minimum localize the new delete confirmation and button accessibility label.

## 7. Tests

### 7.1 Store tests

Update `__tests__/goalStore.test.tsx`:

- replace current destructive `resetGoal()` test usage with `deleteGoal()`
- keep or add a compatibility test only if `resetGoal` remains exported

Add tests:

1. `deleteGoal` removes a non-selected, non-focus goal without changing selected or True Focus.
2. `deleteGoal` removes the selected goal and falls back to True Focus.
3. `deleteGoal` returns `false` for the True Focus goal and does not change state or persist.
4. `deleteGoal` returns `false` for the only goal because it is True Focus.
5. `deleteGoal` returns `false` for an unknown ID and does not persist.

### 7.2 Component tests

Add a focused test for `GoalsListScreen` if current test setup supports router mocking:

- render two goals
- press the trash icon for one goal
- confirm the alert destructive action
- assert `deleteGoal(goal.id)` is called
- assert pressing trash does not call `setSelectedGoal`
- assert the True Focus card does not expose an enabled delete button

If router/Alert mocking makes this expensive, cover the behavior manually and rely on store tests for correctness.

### 7.3 Manual QA

Verify on iOS simulator and Expo web if supported:

- delete non-focus goal from list
- delete selected non-focus goal from list
- confirm the True Focus goal has no enabled delete affordance
- confirm the only goal cannot be deleted
- cancel delete confirmation and confirm nothing changes
- delete button does not open the goal
- widget remains unchanged when attempting to delete True Focus through store-level tests or dev instrumentation

## 8. Acceptance Criteria

- A user can delete a goal from `GoalsListScreen`.
- Destructive deletion always asks for confirmation.
- Canceling confirmation leaves state unchanged.
- Deleting a non-focus goal does not change True Focus.
- A goal marked as True Focus cannot be deleted.
- Attempting to delete the True Focus goal through the store returns `false` and does not persist.
- Deleting the selected non-focus goal assigns True Focus or another valid fallback as selection.
- AsyncStorage and widget snapshot stay consistent with the resulting goal state.
- Store tests cover deletion fallback behavior.

## 9. Implementation Order

1. Add `deleteGoal` to `GoalStore` and delegate old `resetGoal` to it.
2. Update store tests to use `deleteGoal` and add missing edge cases.
3. Add localized delete strings.
4. Update `GoalsListScreen` with the trash icon, confirmation, and True Focus guard.
5. Update `EditGoalScreen` to use `deleteGoal` and delete-specific copy.
6. Run `yarn test __tests__/goalStore.test.tsx`.
7. Run manual QA for list deletion and True Focus protection.
