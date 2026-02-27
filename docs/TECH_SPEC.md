# One Goal — Technical Specification

## 1. Purpose
Build a minimal iPhone habit/progress app focused on one goal at a time. The user selects a goal and a fixed number of days, then marks completion once per local calendar day. The app emphasizes visual progress (grid), with celebratory animation and haptics after tracking. Widgets must reflect progress.

## 2. Goals and Non-goals
### Goals (MVP)
- Single active goal.
- Daily completion (once per local calendar day).
- Visual progress grid and big number.
- Celebration animation + haptics on completion.
- iOS widgets (Home + Lock screen) updated after changes.

### Non-goals (MVP)
- Multiple goals.
- Days remaining.
- Streak repair, analytics, social features.
- Android widgets.

## 3. Target Platform
- iOS (iPhone-first).
- Expo + React Native (TypeScript).

## 4. Tech Stack
### App
- Expo SDK 54, React Native 0.81, React 19, TypeScript.
- Navigation: expo-router.
- Storage: AsyncStorage (MVP); optional Expo SQLite later.
- Animation: react-native-reanimated, react-native-gesture-handler.
- Optional: lottie-react-native (fire animation).
- Optional: react-native-svg for crisp grid.

### Tooling
- ESLint + Prettier.
- Jest + React Native Testing Library.

### Native iOS Widgets
- Expo prebuild to create iOS project.
- WidgetKit extension (Swift).
- Shared App Group storage (UserDefaults or file).
- Native bridge module to:
  - write widget snapshot JSON to app group
  - request WidgetCenter reload timelines

## 5. App Architecture
### 5.1 Folder Structure
- `src/`
- `src/screens/`
- `src/components/`
- `src/store/`
- `src/utils/`
- `docs/`

### 5.2 Navigation
- Expo Router.
- Routes:
  - `app/index.tsx` -> Home (if goal exists) or Onboarding (if not).
  - `app/onboarding.tsx` (optional explicit route).
  - `app/home.tsx` (optional explicit route).
- Prefer a single entry screen that switches based on app state.

### 5.3 State Management
Lightweight store with React Context + hooks (MVP).
- `GoalStore` with:
  - `goal` (nullable)
  - `loadGoal()`
  - `createGoal(goalInput)`
  - `markDone()` (once per day)
  - `resetGoal()`
  - `updateGoal(...)` (if needed)
- Storage backed by AsyncStorage.

### 5.4 Data Model
Single goal:
```
type Goal = {
  title: string;
  totalDays: number;
  completedDays: number;
  lastCompletedDate: string | null; // local date "YYYY-MM-DD"
  createdAt: string; // ISO timestamp
  accentColor?: string;
};
```

### 5.5 Persistence
AsyncStorage key:
- `one-goal/active-goal`

On app start:
- Load goal from AsyncStorage.
- If not found: show onboarding.

Write-through storage:
- Update store in-memory, then persist to AsyncStorage.
- After writes, notify widgets (native bridge).

### 5.6 Local Date Handling
Rule: can mark done once per local calendar day.
- Store `lastCompletedDate` as local date string.
- Compute local date via device locale/timezone.
- `canMarkDone(today, lastCompletedDate)` returns true if:
  - `lastCompletedDate` is null, or
  - `lastCompletedDate` != today

Avoid UTC date mismatch by using local date at time of completion.

## 6. UX / UI Requirements
### 6.1 Onboarding
Inputs:
- Goal title (text input).
- Duration presets: 30 / 66 / 100 (plus custom).
Actions:
- Create goal -> save to storage -> navigate to Home.

### 6.2 Home
Components:
- Large number showing completedDays.
- Progress grid of totalDays cells.
  - completed: green
  - remaining: grey
- Button: "Mark as done"
State rules:
- Disabled if already completed today.

### 6.3 Celebration
Triggered when marking done.
- Fire animation overlay (optional Lottie).
- Haptic feedback.
- Animated number increment.
- Current cell transition: grey -> green with pulse/fill.

### 6.4 Typography & Style
- Minimal UI, big typography.
- Clean layout, high contrast.

## 7. Components
### 7.1 Core Components
- `GoalTitleInput`
- `DurationPicker`
- `PrimaryButton`
- `ProgressGrid`
- `GridCell`
- `CelebrationOverlay`
- `BigNumber`

### 7.2 Progress Grid
Implementation choices:
- Option A: React Native View-based grid (simpler).
- Option B: react-native-svg for crisp grid and fill animation (preferred).

Props:
```
type ProgressGridProps = {
  total: number;
  completed: number;
};
```

Behavior:
- Render total cells.
- Cells [0..completed-1] marked complete.
- Smooth fill animation when a new completion occurs.

### 7.3 Haptics
Use Expo Haptics (if added) or RN native:
- On successful completion, trigger medium impact.

## 8. Widget Architecture (iOS)
### 8.1 App Group Storage
Use App Group identifier, e.g. `group.com.onegoal.app`.

Snapshot payload:
```
type WidgetSnapshot = {
  title: string;
  totalDays: number;
  completedDays: number;
  lastCompletedDate: string | null;
  accentColor?: string;
  updatedAt: string;
};
```

### 8.2 Native Bridge
Implement a small module:
- `writeWidgetSnapshot(snapshot: WidgetSnapshot): void`
- `reloadWidgets(): void`

The module writes JSON to App Group and calls:
```
WidgetCenter.shared.reloadAllTimelines()
```

### 8.3 WidgetKit Extension
- Timeline provider reads snapshot JSON from App Group.
- If missing, display placeholder state.
- Renders:
  - Goal title
  - Big number (completedDays)
  - Compact progress indicator (mini grid or progress bar)

## 9. Data Flow
### 9.1 Create Goal
1. User completes onboarding.
2. Store creates `Goal` with `completedDays = 0`, `lastCompletedDate = null`.
3. Persist to AsyncStorage.
4. Write widget snapshot and reload widgets.

### 9.2 Mark Done
1. Validate `canMarkDone` with local date.
2. Update `completedDays += 1`, `lastCompletedDate = today`.
3. Persist to AsyncStorage.
4. Show celebration animation and haptic.
5. Update widget snapshot and reload widgets.

### 9.3 Reset or Edit Goal
1. Update goal fields.
2. Persist.
3. Update widget snapshot and reload.

## 10. Error Handling & Edge Cases
- If AsyncStorage read fails: show onboarding and log error.
- If `completedDays` == `totalDays`, disable button and show completion state.
- If device date changes (timezone/time travel): use local date string for day-gating.
- If storage is corrupted: fall back to onboarding.

## 11. Testing Strategy
### 11.1 Unit Tests
- `canMarkDone` for day boundary logic.
- Goal store methods (create, markDone, reset).

### 11.2 Component Tests (RNTL)
- Onboarding flow: create goal.
- Home screen: mark done button disabled when already completed today.
- Progress grid: correct count of completed vs remaining cells.

### 11.3 Widget Testing
Manual for MVP:
- Run iOS target, add widget, verify updates after actions.

## 12. Observability (Optional)
Minimal logging for errors (AsyncStorage, widget writes).

## 13. Milestones
### Milestone 1: MVP App Shell
- Setup Expo Router.
- Create screens: Onboarding + Home.
- Basic store + AsyncStorage.

### Milestone 2: Visual Progress + Celebration
- Implement progress grid.
- Add reanimated number increment.
- Add celebration overlay + haptic.

### Milestone 3: Widgets
- Prebuild iOS.
- Add WidgetKit extension.
- Add App Group storage + bridge.
- Verify widget updates.

### Milestone 4: Polish
- Accessibility pass.
- UI spacing, typography.
- Edge-case handling.
