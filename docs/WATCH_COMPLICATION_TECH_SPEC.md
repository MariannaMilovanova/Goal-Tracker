# Apple Watch Complication (Watch Face Widget) — Technical Specification

## 1. Purpose

Add a watch face **complication** for True Focus so the user can:

- see the current True Focus goal progress (days completed / streak) directly on the watch face
- tap it to instantly open the Watch app on the goal screen

On watchOS 9+ complications are built with **WidgetKit** (accessory widget families). This is the same technology as the existing iOS home screen widget (`OneGoalWidget`), so most concepts carry over.

## 2. Goals

- New **watchOS Widget Extension** target embedded in the existing `OneGoalWatch` app.
- Support the accessory families:
  - `accessoryCircular` — small circle (Top Left / Bottom slots on Modular face): day count inside a progress gauge
  - `accessoryCorner` — corner slots on Infograph faces: day count + flame
  - `accessoryRectangular` — the large "Middle" slot on Modular: goal title, Day X of Y, streak
  - `accessoryInline` — one-line text slot above the time: `🔥 42 days · Morning Run`
- Data comes from the **same snapshot the Watch app already caches** — no new networking.
- Tap on the complication opens the Watch app (system behavior, free).
- Complication refreshes when the Watch app receives a new snapshot from iPhone, and at midnight (so "Day X" rolls over).

## 3. Non-goals

- No tracking actions from the complication (WidgetKit complications cannot run actions; tap only launches the app).
- No goal selection from the complication — it always shows the **True Focus goal**.
- No legacy ClockKit support (watchOS < 9).
- No Smart Stack / relevance tuning in v1.

## 4. Current state & what must change

### 4.1 Data sharing problem

Today `WatchConnectivityController` caches the snapshot in `UserDefaults.standard`:

```swift
UserDefaults.standard.set(data, forKey: "watchSnapshot")
```

A widget extension is a **separate process** and cannot read the app's standard defaults. The snapshot must move to an **App Group** container shared between the Watch app and its widget extension.

> Note: the watch App Group is separate from the iPhone one. Reuse the same identifier `group.com.mj.onegoal` — App Groups are per-platform sandboxes, but one identifier keeps provisioning simple.

### 4.2 Required changes in existing code

`WatchConnectivityController.swift`:

```swift
private let sharedDefaults = UserDefaults(suiteName: "group.com.mj.onegoal")

private func cacheSnapshot(_ snapshot: WatchAppSnapshot) {
  guard let data = try? encoder.encode(snapshot) else { return }
  sharedDefaults?.set(data, forKey: snapshotKey)
  WidgetCenter.shared.reloadAllTimelines()   // ← refresh complication
}

private func loadCachedSnapshot() -> WatchAppSnapshot? {
  guard let data = sharedDefaults?.data(forKey: snapshotKey) else { return nil }
  return try? decoder.decode(WatchAppSnapshot.self, from: data)
}
```

Migration: on first launch read the old `UserDefaults.standard` value if the shared one is empty, copy it over.

## 5. New target: `OneGoalWatchComplication`

### 5.1 Xcode setup

| Item | Value |
|---|---|
| Target type | Widget Extension (watchOS), `com.apple.product-type.app-extension` |
| Bundle ID | `com.mj.onegoal.watchkitapp.complication` |
| Embedded in | `OneGoalWatch.app` (Embed Foundation Extensions phase) |
| Deployment target | watchOS 10.0 (match the app) |
| Frameworks | WidgetKit, SwiftUI |

Since the project is managed by hand (`project.pbxproj` edits, as with the watch app itself), the target is added the same way the `OneGoalWatch` target was: new native target + build phases + `Embed Foundation Extensions` copy phase in the watch app.

### 5.2 Entitlements

Two new entitlement files (App Group `group.com.mj.onegoal`):

- `OneGoalWatch/OneGoalWatch.entitlements` — the watch **app** (does not have one today)
- `OneGoalWatchComplication/OneGoalWatchComplication.entitlements` — the extension

Both targets get `CODE_SIGN_ENTITLEMENTS` build setting. EAS/App Store provisioning must include the app group capability for both new bundle IDs.

### 5.3 Files

```
ios/onegoal/OneGoalWatchComplication/
├── Info.plist                      (NSExtensionPointIdentifier = com.apple.widgetkit-extension)
├── OneGoalWatchComplication.swift  (widget + views for all 4 families)
├── ComplicationProvider.swift      (TimelineProvider + snapshot loading)
└── OneGoalWatchComplication.entitlements
```

## 6. Implementation

### 6.1 Timeline provider

```swift
struct ComplicationEntry: TimelineEntry {
  let date: Date
  let goal: WatchGoalSnapshot?   // nil → placeholder "Open True Focus"
}

struct ComplicationProvider: TimelineProvider {
  func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
    let goal = SharedSnapshotStore.loadTrueFocusGoal()  // App Group read
    let entry = ComplicationEntry(date: .now, goal: goal)
    let midnight = Calendar.current.startOfDay(
      for: Calendar.current.date(byAdding: .day, value: 1, to: .now)!)
    completion(Timeline(entries: [entry], policy: .after(midnight)))
  }
  // placeholder(in:) and getSnapshot(in:) return mock "Morning Run, 42 days"
}
```

`WatchModels.swift` is added to **both** targets (shared source, same pattern as the app — no framework needed).

### 6.2 Widget definition

```swift
@main
struct OneGoalWatchComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TrueFocusComplication", provider: ComplicationProvider()) {
      ComplicationView(entry: $0)
    }
    .configurationDisplayName("True Focus")
    .description("Days completed for your True Focus goal.")
    .supportedFamilies([.accessoryCircular, .accessoryCorner,
                        .accessoryRectangular, .accessoryInline])
  }
}
```

### 6.3 Views per family

| Family | Layout |
|---|---|
| `accessoryCircular` | `Gauge(value: completedDays, in: 0...totalDays)` circular style, **"42"** in the center, "d" as unit label |
| `accessoryCorner` | Text **"42"** with `.widgetCurvesContent()`, gauge along the corner, 🔥 icon |
| `accessoryRectangular` | 3 lines: **Morning Run** (headline) / Day 43 of 66 / 🔥 12 day streak |
| `accessoryInline` | `🔥 42 days · Morning Run` (truncates automatically) |

All views must support `.widgetAccentable()` and look correct in both tinted and full-color rendering modes (`\.widgetRenderingMode`).

Empty state (no snapshot yet): circle shows the app icon glyph, rectangular shows "Open True Focus".

### 6.4 Tap → open app

Accessory widgets on watchOS launch their app on tap automatically. Set `.widgetURL(URL(string: "onegoalwatch://truefocus"))` anyway so the app can guarantee the True Focus goal is selected on open (handle in `OneGoalWatchApp` with `.onOpenURL`, reset `selectedGoalId` to `trueFocusGoalId`).

### 6.5 Refresh triggers

| Trigger | Mechanism |
|---|---|
| New snapshot from iPhone | `WidgetCenter.shared.reloadAllTimelines()` in `cacheSnapshot` |
| Local demo action (simulator) | same path (`applySnapshot` → `cacheSnapshot`) |
| Midnight rollover | timeline policy `.after(startOfTomorrow)` |

Watch complication reload budget is generous when the app is in the Dock/recently used; snapshot pushes are rare (a few per day), so no budget concerns.

## 7. Testing plan

1. **Simulator**: build `OneGoalWatch` scheme; long-press watch face → Edit → add "True Focus" complication in a Modular slot.
2. Inject mock snapshot (existing flow) → complication shows 42/66.
3. Tap complication → app opens on True Focus goal.
4. Mark done in app (simulator demo mode) → complication updates to 43 within seconds.
5. Change simulator date past midnight → "Day X" advances.
6. Tinted watch face → text stays legible (rendering-mode check).

## 8. Risks & notes

- **pbxproj is hand-maintained** — adding an extension target by hand is fiddly; copy the structure of the existing `TrueFocusWidget` iOS target as a template.
- **Provisioning**: two new bundle IDs (`…watchkitapp.complication`) + app group capability must be registered; EAS credentials need a resync.
- **WCSession in extension — no.** The extension never talks to the iPhone; it only reads the App Group cache. Keeps it trivial and battery-friendly.
- Complication shows **stale data** if the user never opens the watch app — acceptable for v1; a future improvement is `transferCurrentComplicationUserInfo` from the iPhone for higher-priority pushes.

## 9. Estimate

| Task | Size |
|---|---|
| App Group + defaults migration in watch app | S |
| pbxproj: new extension target, embed phase, entitlements | M (manual, error-prone) |
| Provider + 4 family views | M |
| Deep link + selected-goal handling | S |
| Simulator testing + polish (tint modes) | S–M |

Total: roughly **1–2 days** of focused work.
