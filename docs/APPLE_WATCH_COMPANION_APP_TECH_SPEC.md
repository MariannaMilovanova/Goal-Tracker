# Apple Watch Companion App MVP - Technical Specification

## 1. Purpose

Add a minimal native Apple Watch companion app for True Focus.

The Watch app is a fast check-in surface only. It must not replace the iPhone app. The iPhone app remains the source of truth and the only place where users can:

- create goals
- edit goals
- change schedules
- delete goals
- choose True Focus
- manage settings

The Watch app should let users quickly view the current True Focus goal and track today's progress.

## 2. Goals

- Add a watchOS target inside the existing `ios/onegoal.xcodeproj`.
- Build the Watch UI with native SwiftUI, not React Native or Expo.
- Show the current True Focus goal by default.
- Support once-per-day goals with `Mark as done` / `Done today`.
- Support multiple-times-per-day goals with today's count, dots, and `Track one` / `Done today`.
- Send tracking actions to the iPhone app through WatchConnectivity.
- Let the iPhone app update the existing React Native goal store.
- Refresh the Watch UI from the latest iPhone-owned goal snapshot.
- Preserve normal Expo iPhone app behavior.

## 3. Non-goals

- No goal creation on Watch.
- No goal editing on Watch.
- No schedule management on Watch.
- No full calendar grid on Watch.
- No Watch complications.
- No Watch face widgets.
- No Watch-originated notifications.
- No standalone Watch-only data model.
- No separate repo.

## 4. Current Repo Context

The repo already contains a native iOS project:

```text
one-goal/
├─ app/                         Expo Router app
├─ src/                         React Native app code
├─ ios/
│  ├─ onegoal/                  iPhone app target files
│  ├─ onegoal/OneGoalWidget/    existing WidgetKit extension files
│  └─ onegoal.xcodeproj/        Xcode project
```

Existing native pieces:

- `ios/onegoal/OneGoalWidgetBridge.swift`
  - writes widget snapshot JSON to `UserDefaults(suiteName: "group.com.mj.onegoal")`
  - reloads WidgetKit timelines
- `src/native/widgetBridge.ts`
  - React Native wrapper around the Swift bridge
- `src/utils/widgetSnapshot.ts`
  - builds the widget payload from the current True Focus goal
- `src/store/goalStore.tsx`
  - source of truth for goal state and mutations
  - persists through AsyncStorage
  - currently exposes `markDone`, `trackOneToday`, `undoTodayProgress`, etc. through React context

Important constraint:

Swift should not read or mutate React Native AsyncStorage directly. The Watch MVP must use the iPhone React Native store as the mutation owner. Native iOS code should transport Watch requests and snapshots, not implement an independent goal database.

## 5. Proposed Native Structure

Add a new watchOS target under the existing iOS project:

```text
ios/
├─ onegoal/
│  ├─ OneGoalWidget/
│  ├─ OneGoalWatch/
│  │  ├─ OneGoalWatchApp.swift
│  │  ├─ WatchRootView.swift
│  │  ├─ WatchGoalDetailView.swift
│  │  ├─ WatchGoalsListView.swift          optional MVP+
│  │  ├─ WatchConnectivityController.swift
│  │  ├─ WatchModels.swift
│  │  └─ Assets.xcassets
│  ├─ OneGoalWatchBridge.swift             iOS app target
│  └─ OneGoalWidgetBridge.swift
└─ onegoal.xcodeproj
```

Target naming:

- iPhone app target: existing `onegoal`
- Widget target: existing `TrueFocusWidget`
- Watch app target: new `OneGoalWatch`

Bundle identifiers should be derived from the existing app bundle:

```text
iOS app:   com.mj.onegoal
Watch app: com.mj.onegoal.watch
```

If Xcode creates a separate Watch extension product for the selected watchOS template, use:

```text
Watch app:       com.mj.onegoal.watchkitapp
Watch extension: com.mj.onegoal.watchkitapp.watchkitextension
```

Use the bundle structure produced by the current Xcode version, but keep naming stable in the project.

## 6. Architecture

### 6.1 Source of Truth

The iPhone React Native store remains the source of truth:

```text
Watch UI
  -> WatchConnectivity message
    -> iOS native bridge
      -> React Native store action
        -> AsyncStorage
        -> widget snapshot
        -> Watch snapshot update
```

The Watch app only stores a cached snapshot for display. It does not persist authoritative progress.

### 6.2 Snapshot Flow

The iPhone app publishes a Watch snapshot whenever goal state changes:

- app load
- goal created
- goal updated
- goal deleted
- selected/True Focus goal changed
- mark done
- track one
- undo last
- restart goal

Recommended implementation:

1. Add `buildWatchSnapshot(state)` in `src/utils/watchSnapshot.ts`.
2. Add `src/native/watchBridge.ts` to call a new native module.
3. Add `OneGoalWatchBridge.swift` in the iOS app target.
4. `GoalProvider` publishes the Watch snapshot after every committed state change.
5. Native iOS sends that snapshot to Watch with WatchConnectivity application context.
6. Watch stores the latest context in Watch-side state/UserDefaults and renders it.

### 6.3 Action Flow

The Watch sends quick actions to iPhone:

```text
markDone(goalId)
trackOne(goalId)
undoLast(goalId) optional
```

Recommended MVP behavior:

- Use immediate WatchConnectivity messaging for actions when the iPhone app is reachable.
- If the phone is not reachable, show a disabled/offline state or a short "Open True Focus on iPhone" message.
- Do not queue Watch actions in MVP unless testing confirms background delivery is reliable enough.

Reason:

The iPhone native layer cannot safely mutate AsyncStorage without React Native. Queued actions are possible later, but require a robust pending-action queue that the React Native app drains when active.

## 7. Data Contracts

### 7.1 Watch Goal Snapshot

Use a minimal, Watch-specific payload. Do not reuse the widget snapshot because the Watch needs multiple goals and action metadata.

```ts
export type WatchGoalSnapshot = {
  id: string;
  title: string;
  isTrueFocus: boolean;
  type: 'oncePerDay' | 'multipleTimesPerDay';
  completedDays: number;
  totalDays: number;
  streak: number;
  todayCount: number;
  dailyTarget: number;
  isCompletedToday: boolean;
  canTrackToday: boolean;
};
```

### 7.2 Watch App Snapshot

```ts
export type WatchAppSnapshot = {
  version: 1;
  generatedAt: string;
  trueFocusGoalId: string | null;
  goals: WatchGoalSnapshot[];
};
```

Rules:

- The first screen should use the goal where `isTrueFocus = true`.
- If `trueFocusGoalId` is missing or stale, use the first goal.
- If `goals.length === 0`, show an empty state that asks the user to create a goal on iPhone.

### 7.3 Watch Action Request

```ts
export type WatchActionRequest = {
  version: 1;
  actionId: string;
  action: 'getGoalsSnapshot' | 'markDone' | 'trackOne' | 'undoLast';
  goalId?: string;
  sentAt: string;
};
```

### 7.4 Watch Action Response

```ts
export type WatchActionResponse = {
  version: 1;
  actionId: string;
  ok: boolean;
  reason?: 'notReachable' | 'goalNotFound' | 'alreadyDone' | 'notTrackableToday' | 'unknown';
  snapshot?: WatchAppSnapshot;
  message?: string;
};
```

## 8. React Native Changes

### 8.1 New Watch Snapshot Utility

Add:

```text
src/utils/watchSnapshot.ts
```

Responsibilities:

- convert `GoalsState` into `WatchAppSnapshot`
- calculate `streak` with existing `getGoalStreak`
- calculate `todayCount`
- calculate `isCompletedToday`
- calculate `canTrackToday`
- mark True Focus goal

Pseudo-code:

```ts
export function buildWatchSnapshot(state: GoalsState): WatchAppSnapshot {
  const today = getLocalDateString();
  const trueFocusGoalId = resolveTrueFocusGoalId(state);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    trueFocusGoalId,
    goals: state.goals.map((goal) => {
      const dailyTarget = getGoalDailyTarget(goal);
      const todayCount =
        goal.type === 'multipleTimesPerDay'
          ? getRecordCount(goal, today)
          : goal.lastCompletedDate === today
            ? 1
            : 0;

      return {
        id: goal.id,
        title: goal.title,
        isTrueFocus: goal.id === trueFocusGoalId,
        type: goal.type,
        completedDays: goal.completedDays,
        totalDays: goal.totalDays,
        streak: getGoalStreak(goal),
        todayCount,
        dailyTarget,
        isCompletedToday: todayCount >= dailyTarget,
        canTrackToday: deriveCanTrack(goal, today, todayCount, dailyTarget),
      };
    }),
  };
}
```

### 8.2 Native Watch Bridge Wrapper

Add:

```text
src/native/watchBridge.ts
```

API:

```ts
export type WatchActionHandler = (request: WatchActionRequest) => Promise<WatchActionResponse>;

export function publishWatchSnapshot(snapshot: WatchAppSnapshot): Promise<void>;
export function addWatchActionListener(handler: WatchActionHandler): () => void;
export function completeWatchAction(actionId: string, response: WatchActionResponse): void;
```

Implementation details:

- Wrap a native module named `OneGoalWatchBridge`.
- Use `NativeEventEmitter` for incoming Watch actions.
- Keep responses keyed by `actionId`.
- Native iOS holds the WatchConnectivity reply handler until JS completes the action.
- Add a native timeout, for example 8 seconds, to avoid keeping reply handlers forever.

### 8.3 Goal Store Integration

Inside `GoalProvider`, register a Watch action handler.

Action mapping:

```text
getGoalsSnapshot -> return buildWatchSnapshot(current state)
markDone(goalId) -> markDone(goalId)
trackOne(goalId) -> trackOneToday(goalId)
undoLast(goalId) -> undoTodayProgress(goalId)
```

After a successful mutation:

1. Persist goal state.
2. Sync widget snapshot.
3. Publish Watch snapshot.
4. Reply to Watch with updated snapshot.

Refactor recommendation:

Rename internal `syncWidget(nextState)` to `syncNativeSurfaces(nextState)`:

```ts
async function syncNativeSurfaces(nextState: GoalsState) {
  await syncWidget(nextState);
  await syncWatch(nextState);
}
```

This avoids forgetting to update Watch when future goal actions are added.

## 9. iOS Native Bridge

### 9.1 File

Add:

```text
ios/onegoal/OneGoalWatchBridge.swift
```

Responsibilities:

- configure `WCSession.default`
- send latest `WatchAppSnapshot` to Watch
- receive Watch action messages
- emit action events to React Native
- hold reply handlers until JS replies
- return timeout errors if JS does not reply

### 9.2 Native Module Surface

Expose methods to React Native:

```swift
@objc(publishSnapshot:resolver:rejecter:)
func publishSnapshot(_ json: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock)

@objc(completeAction:responseJson:)
func completeAction(_ actionId: String, responseJson: String)
```

Expose events:

```swift
watchActionReceived
watchReachabilityChanged
```

### 9.3 WatchConnectivity Message Keys

Use JSON strings for type-safe versioning:

```swift
[
  "kind": "watchAction",
  "payload": "{...WatchActionRequest JSON...}"
]
```

Snapshot application context:

```swift
[
  "kind": "watchSnapshot",
  "payload": "{...WatchAppSnapshot JSON...}"
]
```

### 9.4 Reachability Policy

For MVP:

- If `WCSession.isSupported()` is false, no-op the bridge.
- If Watch is not paired or not installed, no-op publishing.
- If Watch sends action while iPhone JS cannot answer within timeout, reply with:

```json
{
  "ok": false,
  "reason": "notReachable",
  "message": "Open True Focus on iPhone to sync."
}
```

## 10. Watch App Implementation

### 10.1 Files

Add:

```text
ios/onegoal/OneGoalWatch/OneGoalWatchApp.swift
ios/onegoal/OneGoalWatch/WatchConnectivityController.swift
ios/onegoal/OneGoalWatch/WatchModels.swift
ios/onegoal/OneGoalWatch/WatchRootView.swift
ios/onegoal/OneGoalWatch/WatchGoalDetailView.swift
ios/onegoal/OneGoalWatch/WatchGoalsListView.swift
```

### 10.2 Watch State

Watch-side state:

```swift
final class WatchConnectivityController: NSObject, ObservableObject {
  @Published var snapshot: WatchAppSnapshot?
  @Published var selectedGoalId: String?
  @Published var isSendingAction: Bool = false
  @Published var statusMessage: String?
}
```

Persist the latest snapshot in Watch `UserDefaults` so the app can render immediately before the iPhone responds.

### 10.3 Root Screen

Default screen:

- if snapshot has True Focus goal: show detail screen for that goal
- if snapshot has goals but no valid True Focus: show first goal
- if no snapshot yet: show loading state
- if empty goals: show "Create a goal on iPhone"

### 10.4 Goal Detail UI

For once-per-day goals:

```text
Gym Training

21
days completed

20 day streak

[Mark as done]
```

Button states:

- `Mark as done`: enabled when `canTrackToday = true`
- `Done today`: disabled when `isCompletedToday = true`
- `Syncing...`: disabled while request is in flight

For multiple-times-per-day goals:

```text
Meaningful Eating

1 / 3 today
● ○ ○

[Track one]
```

Button states:

- `Track one`: enabled when `todayCount < dailyTarget`
- `Done today`: disabled when `todayCount >= dailyTarget`
- `Syncing...`: disabled while request is in flight

Dot rules:

- render up to 10 dots
- filled dots = `todayCount`
- empty dots = `dailyTarget - todayCount`

### 10.5 Success Feedback

After a successful action:

- trigger light haptic on Watch
- briefly show one of:
  - `Nice work.`
  - `Progress saved.`
- update UI from response snapshot

Use concise feedback and auto-clear it after about 1.5 seconds.

### 10.6 Optional Goals List

If implementation cost is low, add a simple second screen:

```text
⭐ Gym Training
Meaningful Eating
No Sugar
```

Rules:

- list all goals from snapshot
- True Focus goal has a star
- tapping a row opens detail for that goal
- no edit/create/delete actions

Navigation options:

- Use `NavigationStack`.
- Add a small list button in the detail screen toolbar.
- Keep True Focus as the initial selected goal.

## 11. UI Requirements

- Native SwiftUI only.
- Large readable title and numbers.
- One primary action button.
- No calendar grid.
- No editing controls.
- No long explanatory text.
- Avoid dense layouts.
- Support small Watch sizes by using vertical scrolling.
- Use system fonts and standard button styling.
- Use system haptics for successful actions.

Recommended layout:

```swift
ScrollView {
  VStack(spacing: 10) {
    Text(goal.title)
    Text(primaryMetric)
    Text(metricLabel)
    Text(streakLabel)
    progressDotsIfNeeded
    Button(...)
    statusMessageIfNeeded
  }
}
```

## 12. Build System and Project Configuration

### 12.1 Xcode Project

Add the watchOS target through Xcode, then commit the generated project changes:

- `ios/onegoal.xcodeproj/project.pbxproj`
- Watch source files
- Watch `Info.plist`
- Watch asset catalog
- any generated entitlements
- updated schemes if needed

The iPhone target must embed the Watch app product.

### 12.2 EAS Build

The repo already uses EAS with:

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "environment": "production"
    }
  }
}
```

Because the native iOS project is committed, EAS should build the Watch target as part of the iOS app archive once the Xcode project embeds it correctly.

### 12.3 Expo Prebuild Risk

Manual Xcode targets can be lost or damaged by a clean prebuild.

Rules:

- Do not run `expo prebuild --clean` unless the Watch target is represented by a config plugin or the native changes are reapplied.
- Commit all native project files.
- If future automation is needed, create a custom Expo config plugin that adds/repairs the Watch target.

## 13. Data Consistency

### 13.1 iPhone App Active

Best-case path:

1. Watch sends action.
2. iPhone bridge receives action.
3. React Native store mutates goal state.
4. AsyncStorage persists.
5. Widget snapshot updates.
6. Watch snapshot updates.
7. Watch displays success.

### 13.2 iPhone App Not Reachable

MVP path:

- Watch still displays cached snapshot.
- Action button can be disabled or return "Open True Focus on iPhone to sync."
- Do not optimistically mutate Watch UI unless iPhone confirms success.

Future enhancement:

- queue action with `transferUserInfo`
- iPhone drains queue when app wakes
- conflict-resolution rules decide what happens if the day already changed

Do not include queued background actions in MVP unless there is time to test them thoroughly.

### 13.3 Date Boundary

The iPhone store owns local date logic.

Watch must not independently decide whether a goal can be completed today. It should render `canTrackToday` and `isCompletedToday` from the iPhone snapshot.

## 14. Error States

Watch should handle:

- no snapshot yet
- no goals
- iPhone not reachable
- action rejected because already completed
- action rejected because goal was deleted
- action timed out

Suggested messages:

```text
Open True Focus on iPhone.
Goal unavailable.
Done today.
Try again.
```

Keep messages short.

## 15. Security and Privacy

- Do not send analytics or sensitive metadata in Watch messages.
- Snapshot contains only goal title and progress metadata.
- Use existing app identifiers and signing team.
- No new network transport is required.

## 16. Testing Plan

### 16.1 JavaScript Unit Tests

Add tests for `buildWatchSnapshot`:

- empty goals
- True Focus goal selection
- once-per-day completed today
- once-per-day not completed today
- multiple-times target below target
- multiple-times target reached
- streak value matches `getGoalStreak`
- deleted True Focus fallback

Add store-level tests if the Watch action handler is implemented in JS:

- `markDone` action by goal ID
- `trackOne` action by goal ID
- action response includes updated snapshot
- invalid goal ID returns failure response

### 16.2 Native iOS Tests

Manual or unit-level:

- `OneGoalWatchBridge` initializes `WCSession`
- publishing snapshot does not crash when no Watch is paired
- action timeout returns a failure response

### 16.3 Watch Simulator QA

Use Xcode with paired iPhone + Watch simulators.

Scenarios:

- first launch with no goals
- current True Focus goal appears
- once-per-day goal marks done
- once-per-day goal shows `Done today`
- multiple-times goal increments `0/3 -> 1/3 -> 2/3 -> Done today`
- haptic triggers after successful action on device
- optional goals list opens non-focus goal
- deleting a goal on iPhone removes it from Watch snapshot
- iPhone app still launches and tracks normally

### 16.4 Build Verification

- Build iPhone app target from Xcode.
- Build Watch app target from Xcode.
- Archive iOS app and verify Watch app is embedded.
- Run EAS internal build if possible.
- Run EAS production build before App Store submission.

## 17. Acceptance Criteria

- Apple Watch target exists in the same iOS project.
- Watch app builds from Xcode.
- Watch app is embedded in the iPhone app archive.
- Watch app shows the current True Focus goal by default.
- Once-per-day goal can be marked done from Watch.
- Multiple-times-per-day goal can increment today count from Watch.
- Completed state is shown correctly.
- Watch triggers haptic feedback after successful action.
- iPhone app data updates after Watch action.
- Widget/shared snapshot still updates after Watch action.
- Watch app does not allow goal creation/editing/deletion.
- Existing Expo iPhone app works normally.
- Existing widget target still builds.

## 18. Implementation Workstreams

### Workstream A - Watch Snapshot in React Native

- Add `WatchAppSnapshot` and `WatchGoalSnapshot` types.
- Add `buildWatchSnapshot`.
- Add unit tests.

### Workstream B - iOS Watch Bridge

- Add `OneGoalWatchBridge.swift`.
- Configure `WCSession`.
- Implement snapshot publishing.
- Implement action event emission to JS.
- Implement action response/timeout handling.

### Workstream C - Goal Store Integration

- Register Watch action listener in `GoalProvider`.
- Route actions to existing goal mutations.
- Publish Watch snapshot after state changes.
- Return updated snapshot in action responses.

### Workstream D - Watch App Target

- Add watchOS target.
- Add SwiftUI app files.
- Add Watch models matching JSON contracts.
- Add WatchConnectivity controller.

### Workstream E - Watch UI

- Implement default True Focus detail view.
- Implement once-per-day state.
- Implement multiple-times-per-day state.
- Implement haptics and short success feedback.
- Add optional goals list if time permits.

### Workstream F - Build and QA

- Verify Xcode project target embedding.
- Run paired simulator QA.
- Run Jest tests.
- Run iOS build/archive.
- Run EAS build if credentials are ready.

## 19. Open Decisions

1. Should MVP require iPhone reachability for Watch actions?
   - Recommended: yes. It is safer with the current AsyncStorage/React Native source of truth.
2. Should optional goals list be included in the first Watch release?
   - Recommended: include only if the single-goal flow is stable.
3. Should `undoLast` be exposed on Watch?
   - Recommended: not in MVP UI. Keep the action contract optional for a later version.
4. Should the Watch app support offline queued actions?
   - Recommended: no for MVP. Add later with explicit conflict rules.
5. Should Watch snapshot publishing include all goals or only True Focus?
   - Recommended: include all goals because it enables the optional list and future-proofs the payload.

## 20. Recommended MVP Cut

Ship the smallest reliable version:

- Watch target
- cached snapshot display
- True Focus detail screen
- once-per-day `Mark as done`
- multiple-times `Track one`
- haptic + short success message
- no goals list
- no undo
- no queued offline actions

Then add the goals list in the next iteration if WatchConnectivity and build/archive are stable.
