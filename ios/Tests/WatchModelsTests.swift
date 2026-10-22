// Run from the repository root: bash ios/Tests/run-watch-model-tests.sh
import Foundation
import XCTest

final class WatchModelsTests: XCTestCase {
  private let buenosAires = TimeZone(identifier: "America/Argentina/Buenos_Aires")!

  private func date(_ value: String) -> Date {
    ISO8601DateFormatter().date(from: value)!
  }

  private func snapshot(
    type: WatchGoalType = .oncePerDay,
    todayCount: Int = 1,
    totalDays: Int = 30,
    localDate: String? = "2026-10-21",
    generatedAt: String = "2026-10-22T02:55:00.000Z"
  ) -> WatchAppSnapshot {
    let target = type == .oncePerDay ? 1 : 3
    return WatchAppSnapshot(
      version: 1,
      generatedAt: generatedAt,
      trueFocusGoalId: "goal-1",
      goals: [
        WatchGoalSnapshot(
          id: "goal-1", title: "Read", isTrueFocus: true, type: type,
          completedDays: 1, totalDays: totalDays, streak: 1, todayCount: todayCount,
          dailyTarget: target, isCompletedToday: todayCount >= target,
          canTrackToday: todayCount < target && totalDays > 1
        )
      ],
      localDate: localDate
    )
  }

  @objc func testOncePerDayResetsAtLocalMidnightWithoutLosingProgress() {
    let saved = snapshot()
    let today = saved.forCurrentDay(at: date("2026-10-22T03:00:00Z"), timeZone: buenosAires)
    XCTAssertFalse(today.goals[0].isCompletedToday)
    XCTAssertTrue(today.goals[0].canTrackToday)
    XCTAssertEqual(today.goals[0].todayCount, 0)
    XCTAssertEqual(today.goals[0].completedDays, 1)
    XCTAssertEqual(today.goals[0].streak, 1)
    XCTAssertEqual(today.generatedAt, saved.generatedAt)
    XCTAssertEqual(today.localDate, saved.localDate)
    XCTAssertEqual(saved.goals[0].todayCount, 1)
  }

  @objc func testDoesNotResetAtUTCMidnightOrOnRepeatedRefresh() {
    let saved = snapshot()
    let now = date("2026-10-22T02:59:59Z")
    XCTAssertEqual(saved.forCurrentDay(at: now, timeZone: buenosAires), saved)
    let tomorrow = date("2026-10-22T03:00:00Z")
    let projected = saved.forCurrentDay(at: tomorrow, timeZone: buenosAires)
    XCTAssertEqual(projected.forCurrentDay(at: tomorrow, timeZone: buenosAires), projected)
  }

  @objc func testResetsPartialAndCompletedMultiCountDays() {
    for count in [1, 3] {
      let today = snapshot(type: .multipleTimesPerDay, todayCount: count)
        .forCurrentDay(at: date("2026-10-22T13:53:00Z"), timeZone: buenosAires)
      XCTAssertEqual(today.goals[0].todayCount, 0)
      XCTAssertEqual(today.goals[0].dailyTarget, 3)
      XCTAssertFalse(today.goals[0].isCompletedToday)
      XCTAssertTrue(today.goals[0].canTrackToday)
    }
  }

  @objc func testFinishedGoalRemainsUntrackable() {
    let today = snapshot(totalDays: 1)
      .forCurrentDay(at: date("2026-10-22T13:53:00Z"), timeZone: buenosAires)
    XCTAssertFalse(today.goals[0].canTrackToday)
    XCTAssertFalse(today.goals[0].isCompletedToday)
    XCTAssertEqual(today.goals[0].completedDays, 1)
  }

  @objc func testOldCachedPayloadWithoutLocalDateStillDecodesAndExpires() throws {
    for timestamp in ["2026-10-22T02:55:00.000Z", "2026-10-22T02:55:00Z"] {
      let data = try JSONEncoder().encode(snapshot(localDate: nil, generatedAt: timestamp))
      let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
      XCTAssertNil(json["localDate"])
      let saved = try JSONDecoder().decode(WatchAppSnapshot.self, from: data)
      XCTAssertNotNil(saved.generatedDate)
      XCTAssertTrue(saved.forCurrentDay(at: date("2026-10-22T03:00:00Z"), timeZone: buenosAires)
        .goals[0].canTrackToday)
    }
  }

  @objc func testUsesPhoneCalendarDayInsteadOfReinterpretingTimestampAfterTimeZoneChange() {
    // The phone's snapshot was for Oct 21, even though it was already Oct 22 in Tokyo.
    let tokyo = TimeZone(identifier: "Asia/Tokyo")!
    let today = snapshot().forCurrentDay(at: date("2026-10-22T03:00:00Z"), timeZone: tokyo)
    XCTAssertFalse(today.goals[0].isCompletedToday)
    XCTAssertTrue(today.goals[0].canTrackToday)
  }

  @objc func testMidnightAfterDaylightSavingChangeUsesCalendarDayNot24Hours() {
    let newYork = TimeZone(identifier: "America/New_York")!
    let saved = snapshot(localDate: "2026-03-08", generatedAt: "2026-03-08T05:05:00.000Z")
    XCTAssertEqual(saved.forCurrentDay(at: date("2026-03-09T03:59:59Z"), timeZone: newYork), saved)
    XCTAssertFalse(saved.forCurrentDay(at: date("2026-03-09T04:00:00Z"), timeZone: newYork)
      .goals[0].isCompletedToday)
  }

  @objc func testMovingClockBackDoesNotUnlockAnotherCheckIn() {
    let saved = snapshot(localDate: "2026-10-23")
    XCTAssertEqual(saved.forCurrentDay(at: date("2026-10-22T13:53:00Z"), timeZone: buenosAires), saved)
  }
}

@main
enum WatchModelsTestRunner {
  static func main() {
    let suite = XCTestSuite(forTestCaseClass: WatchModelsTests.self)
    suite.run()
    guard let result = suite.testRun else {
      fatalError("Watch model tests did not run.")
    }
    print("Watch models: \(result.executionCount) tests, \(result.totalFailureCount) failures")
    exit(result.hasSucceeded && result.executionCount > 0 ? 0 : 1)
  }
}
