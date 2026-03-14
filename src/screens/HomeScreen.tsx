import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BigNumber } from '../components/BigNumber';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressGrid, ProgressGridCellPressPayload } from '../components/ProgressGrid';
import { useGoalStore } from '../store/goalStore';
import {
  canMarkDone,
  canUndoToday,
  getDateDiffInDays,
  getLocalDateString,
  getNextTrackedDate,
  isTrackedOnDate,
} from '../utils/date';

export function HomeScreen() {
  const { goal, markDone, undoToday, updateGoal, resetGoal } = useGoalStore();
  const router = useRouter();
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [celebrationCellIndex, setCelebrationCellIndex] = useState<number | null>(null);
  const [celebrationToken, setCelebrationToken] = useState(0);
  const [displayCompletedDays, setDisplayCompletedDays] = useState(goal?.completedDays ?? 0);
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationValues, setCelebrationValues] = useState({ from: 0, to: 0 });
  const sequenceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skippedDays = useMemo(
    () => goal?.timeline.reduce((count, state) => (state === 'skipped' ? count + 1 : count), 0) ?? 0,
    [goal?.timeline],
  );
  const visibleTotalDays = useMemo(
    () => (goal ? goal.totalDays + skippedDays : 0),
    [goal, skippedDays],
  );
  const today = useMemo(() => getLocalDateString(), []);
  const isTrackedToday = useMemo(
    () => (goal ? isTrackedOnDate(today, goal.trackedWeekdays) : false),
    [goal, today],
  );
  const nextTrackedDate = useMemo(
    () => (goal ? getNextTrackedDate(today, goal.trackedWeekdays) : null),
    [goal, today],
  );
  const nextTrackedLabel = useMemo(() => {
    if (!nextTrackedDate) {
      return null;
    }
    const parsed = new Date(`${nextTrackedDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(parsed);
  }, [nextTrackedDate]);
  const cellDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }),
    [],
  );
  const startedLabel = useMemo(() => {
    if (!goal) {
      return '';
    }

    const parsed = new Date(goal.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed);
  }, [goal]);
  const elapsedDays = useMemo(() => {
    if (!goal) {
      return 0;
    }
    const start = getLocalDateString(new Date(goal.createdAt));
    const dayDiff = getDateDiffInDays(start, today);
    const inclusiveDays = dayDiff + 1;
    return Math.max(0, Math.min(inclusiveDays, visibleTotalDays));
  }, [goal, visibleTotalDays]);
  const streakDays = useMemo(() => {
    if (!goal || goal.timeline.length === 0) {
      return 0;
    }

    let streak = 0;

    for (let index = goal.timeline.length - 1; index >= 0; index -= 1) {
      const state = goal.timeline[index];

      if (state === 'off') {
        continue;
      }

      if (state === 'completed') {
        streak += 1;
        continue;
      }

      break;
    }

    return streak;
  }, [goal]);

  const canCompleteToday = useMemo(() => {
    if (!goal) {
      return false;
    }
    if (goal.completedDays >= goal.totalDays) {
      return false;
    }
    return canMarkDone(today, goal.lastCompletedDate);
  }, [goal, today]);

  const canUndo = useMemo(() => {
    if (!goal) {
      return false;
    }
    if (goal.completedDays <= 0) {
      return false;
    }
    return canUndoToday(today, goal.lastCompletedDate);
  }, [goal, today]);

  useEffect(() => {
    if (!goal) {
      setDisplayCompletedDays(0);
      return;
    }
    if (!isMarkingDone && !showCelebration) {
      setDisplayCompletedDays(goal.completedDays);
    }
  }, [goal, isMarkingDone, showCelebration]);

  useEffect(() => {
    return () => {
      sequenceTimers.current.forEach((timer) => clearTimeout(timer));
      sequenceTimers.current = [];
    };
  }, []);

  if (!goal) {
    return null;
  }

  const handleMarkDone = async () => {
    if (isMarkingDone || showCelebration) {
      return;
    }
    const startDate = getLocalDateString(new Date(goal.createdAt));
    const todayIndex = getDateDiffInDays(startDate, today);
    const fromValue = goal.completedDays;
    const toValue = fromValue + 1;
    setIsMarkingDone(true);
    sequenceTimers.current.forEach((timer) => clearTimeout(timer));
    sequenceTimers.current = [];
    setHighlightIndex(todayIndex >= 0 ? todayIndex : null);
    setCelebrationCellIndex(todayIndex >= 0 ? todayIndex : null);
    setCelebrationToken(Date.now());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const didMark = await markDone();
    if (!didMark) {
      setIsMarkingDone(false);
      setHighlightIndex(null);
      setCelebrationCellIndex(null);
      setDisplayCompletedDays(goal.completedDays);
      return;
    }

    setCelebrationValues({ from: fromValue, to: toValue });
    sequenceTimers.current.push(setTimeout(() => setDisplayCompletedDays(toValue), 160));
    sequenceTimers.current.push(setTimeout(() => setShowCelebration(true), 220));
    sequenceTimers.current.push(
      setTimeout(() => {
        setHighlightIndex(null);
        setCelebrationCellIndex(null);
      }, 760),
    );
  };

  const handleUndoToday = async () => {
    const didUndo = await undoToday();
    if (didUndo) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleStartAgain = async () => {
    const updated = await updateGoal({ completedDays: 0 });
    if (updated) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleNewGoal = async () => {
    await resetGoal();
  };

  const handleCellPress = ({ date, state, isTracked }: ProgressGridCellPressPayload) => {
    const formattedDate = cellDateFormatter.format(new Date(`${date}T00:00:00`));

    if (state === 'skipped') {
      Alert.alert('Skipped day', `${formattedDate} was a tracked day, but it was skipped. The chain continues today.`);
      return;
    }

    if (state === 'completed') {
      if (date === today && canUndo) {
        Alert.alert('Undo today?', `Undo today's completion for ${formattedDate}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Undo',
            style: 'destructive',
            onPress: () => {
              void handleUndoToday();
            },
          },
        ]);
        return;
      }

      Alert.alert('Completed day', `${formattedDate} was completed.`);
      return;
    }

    if (!isTracked) {
      const title = state === 'today' ? 'Rest day today' : 'Not scheduled';
      const description =
        state === 'today'
          ? `${formattedDate} is outside your tracking schedule, but you can still mark it done.`
          : `${formattedDate} is outside your tracking schedule.`;
      Alert.alert(title, description);
      return;
    }

    if (state === 'today') {
      Alert.alert('Tracked today', `${formattedDate} is one of your tracked days. Mark it done when you complete it.`);
      return;
    }

    if (state === 'future') {
      Alert.alert('Upcoming tracked day', `${formattedDate} is one of your tracked days.`);
      return;
    }

    Alert.alert('Tracked day', `${formattedDate} was one of your tracked days.`);
  };

  const handleCelebrationFinish = () => {
    sequenceTimers.current.forEach((timer) => clearTimeout(timer));
    sequenceTimers.current = [];
    setShowCelebration(false);
    setIsMarkingDone(false);
    setHighlightIndex(null);
    setCelebrationCellIndex(null);
    setDisplayCompletedDays(goal.completedDays);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <CelebrationOverlay
          visible={showCelebration}
          fromValue={celebrationValues.from}
          toValue={celebrationValues.to}
          onFinish={handleCelebrationFinish}
        />
        <View style={styles.fixedHeaderSection}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              <Pressable
                onPress={() => router.push('/edit-goal')}
                accessibilityLabel="Edit goal"
                style={styles.editButton}
              >
                <Ionicons name="settings-outline" size={24} color="#4A4A4A" />
              </Pressable>
            </View>
            <Text style={styles.caption}>
              {`Day ${Math.min(displayCompletedDays + 1, goal.totalDays)} of ${goal.totalDays}${
                startedLabel ? ` · Started ${startedLabel}` : ''
              }`}
            </Text>
          </View>

          <BigNumber
            value={displayCompletedDays}
            label={displayCompletedDays === 1 ? 'day completed' : 'days completed'}
          />
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gridSection}>
            <View style={[styles.streakPill, streakDays === 0 ? styles.streakPillInactive : null]}>
              <Text style={[styles.streakText, streakDays === 0 ? styles.streakTextInactive : null]}>
                {`🔥 ${streakDays} day${streakDays === 1 ? '' : 's'} streak`}
              </Text>
            </View>
            <ProgressGrid
              total={visibleTotalDays}
              timeline={goal.timeline}
              elapsedDays={elapsedDays}
              highlightIndex={highlightIndex}
              celebrationCellIndex={celebrationCellIndex}
              celebrationToken={celebrationToken}
              startDate={goal.createdAt}
              trackedWeekdays={goal.trackedWeekdays}
              onCellPress={handleCellPress}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {goal.completedDays >= goal.totalDays ? (
            <View style={styles.completedCard}>
              <Text style={styles.completedTitle}>🎉 Goal completed</Text>
              <PrimaryButton label="Start again" onPress={handleStartAgain} />
              <Pressable
                onPress={handleNewGoal}
                accessibilityRole="button"
                style={styles.newGoalButton}
              >
                <Text style={styles.newGoalText}>New goal</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <PrimaryButton
                label="Mark as done"
                onPress={handleMarkDone}
                disabled={!canCompleteToday || isMarkingDone || showCelebration}
              />
              {!isTrackedToday ? (
                <Text style={styles.hint}>
                  {`Rest day.${nextTrackedLabel ? ` Next check-in ${nextTrackedLabel}.` : ''}`}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 24,
    paddingLeft: 24,
    backgroundColor: '#FFFFFF',
  },
  fixedHeaderSection: {
    flexShrink: 0,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  header: {
    marginTop: 8,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalTitle: {
    fontSize: 28,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  editButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: 6,
    color: '#6B6B6B',
  },
  gridSection: {
    marginTop: 8,
  },
  streakPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: '#F4D2B2',
    marginBottom: 12,
  },
  streakPillInactive: {
    backgroundColor: '#F0F0F0',
    borderColor: '#DDDDDD',
  },
  streakText: {
    color: '#6F3E13',
    fontSize: 13,
    fontWeight: '700',
  },
  streakTextInactive: {
    color: '#777777',
  },
  footer: {
    flexShrink: 0,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  completedCard: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  newGoalButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  newGoalText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    marginTop: 12,
    color: '#6B6B6B',
  },
});
