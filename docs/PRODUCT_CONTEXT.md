# One Goal App Context

## Product summary
- Name (working): One Goal / ONE
- Platform: iOS (iPhone-first)
- Core promise: Focus on one goal. Track daily. Feel progress.

## Core user flow

### Onboarding
- Enter goal title (e.g., "No sugar", "Read 20 min")
- Choose duration (preset like 30/66/100 + optional custom)
- Create goal

### Home
- Big number: completedDays
- Progress grid: totalDays cells
- Completed cells = green
- Remaining cells = grey
- Button: Mark as done
- Rule: can mark done only once per local calendar day

### Celebration on completion
- Fire animation overlay (Duolingo-like vibe)
- Haptic feedback
- Smooth number increment animation (e.g., 55 -> 56)
- Current cell transitions from grey -> green (pulse/fill)

## Key feature: iOS Widgets
We want nice big widgets (Home Screen + Lock Screen) that reflect the same progress:
- Goal title
- Big completed days number
- Compact progress representation (mini grid or simplified indicator)

Widgets must update after:
- Creating a goal
- Marking done
- Resetting/editing goal

## Tech stack (Path A)

### Main app
- Expo + React Native
- TypeScript
- ESLint
- Jest (+ React Native Testing Library)

### Animations/UI
- react-native-reanimated (number + cell animations)
- Optional: lottie-react-native for fire animation
- Optional: react-native-svg for crisp grid rendering

### Persistence
- AsyncStorage for MVP

### Widgets (native iOS "island")
- Expo prebuild to generate iOS project
- WidgetKit extension in Swift
- Shared App Group storage (UserDefaults or shared file)
- Small native bridge module from RN -> iOS to:
  - write widget snapshot JSON to App Group
  - trigger WidgetCenter reload timelines

## Data model (MVP)
A single active goal:
- title
- totalDays
- completedDays
- lastCompletedDate (local date string)
- createdAt
- optional accentColor

## Non-goals (MVP)
- Multiple goals at once
- Showing "days remaining" (explicitly not desired)
- Complex analytics, streak repair, social features
- Android widgets (later)

## Quality constraints
- Minimal UI, big typography, clean design
- Simple and reliable "once per day" rule (timezone-safe at local day level)
- Widget always reflects latest snapshot after updates
