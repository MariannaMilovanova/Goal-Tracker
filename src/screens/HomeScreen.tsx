import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BigNumber } from '../components/BigNumber';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressGrid } from '../components/ProgressGrid';
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationValues, setCelebrationValues] = useState({ from: 0, to: 0 });
  const previousCompleted = useRef(goal?.completedDays ?? 0);
  const isCompleting = useRef(false);
  const hasInitialized = useRef(false);
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
  const elapsedDays = useMemo(() => {
    if (!goal) {
      return 0;
    }
    const start = getLocalDateString(new Date(goal.createdAt));
    const dayDiff = getDateDiffInDays(start, today);
    const inclusiveDays = dayDiff + 1;
    return Math.max(0, Math.min(inclusiveDays, visibleTotalDays));
  }, [goal, visibleTotalDays]);

  const canCompleteToday = useMemo(() => {
    if (!goal) {
      return false;
    }
    if (!isTrackedToday) {
      return false;
    }
    if (goal.completedDays >= goal.totalDays) {
      return false;
    }
    return canMarkDone(today, goal.lastCompletedDate);
  }, [goal, isTrackedToday, today]);

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
      hasInitialized.current = false;
      previousCompleted.current = 0;
      return;
    }

    if (!hasInitialized.current) {
      previousCompleted.current = goal.completedDays;
      hasInitialized.current = true;
      return;
    }

    const prev = previousCompleted.current;
    if (goal.completedDays > prev) {
      const latestCompletedIndex = goal.timeline.lastIndexOf('completed');
      if (latestCompletedIndex >= 0) {
        setHighlightIndex(latestCompletedIndex);
      }
      const highlightTimer = setTimeout(() => setHighlightIndex(null), 650);

      previousCompleted.current = goal.completedDays;
      return () => {
        clearTimeout(highlightTimer);
      };
    }

    previousCompleted.current = goal.completedDays;
  }, [goal]);

  if (!goal) {
    return null;
  }

  const handleMarkDone = async () => {
    if (isCompleting.current || showCelebration) {
      return;
    }
    if (!goal) {
      return;
    }
    isCompleting.current = true;
    const fromValue = goal.completedDays;
    const toValue = fromValue + 1;
    const didMark = await markDone();
    isCompleting.current = false;
    if (didMark) {
      setCelebrationValues({ from: fromValue, to: toValue });
      setShowCelebration(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
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

  const handleFrozenCellPress = () => {
    Alert.alert('Day skipped', 'The chain continues today.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <CelebrationOverlay
          visible={showCelebration}
          fromValue={celebrationValues.from}
          toValue={celebrationValues.to}
          onFinish={() => setShowCelebration(false)}
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
                <Ionicons name="settings-outline" size={22} color="#4A4A4A" />
              </Pressable>
            </View>
            <Text style={styles.caption}>
              Day {Math.min(goal.completedDays + 1, goal.totalDays)} of {goal.totalDays}
            </Text>
          </View>

          <BigNumber value={goal.completedDays} label="Completed" />
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <View style={styles.gridSection}>
            <ProgressGrid
              total={visibleTotalDays}
              timeline={goal.timeline}
              elapsedDays={elapsedDays}
              highlightIndex={highlightIndex}
              startDate={goal.createdAt}
              onFrozenCellPress={handleFrozenCellPress}
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
              {canUndo ? (
                <Pressable
                  onPress={handleUndoToday}
                  accessibilityRole="button"
                  style={styles.undoButton}
                >
                  <Text style={styles.undoText}>Undo today</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              <PrimaryButton
                label="Mark as done"
                onPress={handleMarkDone}
                disabled={!canCompleteToday}
              />
              {canUndo ? (
                <Pressable
                  onPress={handleUndoToday}
                  accessibilityRole="button"
                  style={styles.undoButton}
                >
                  <Text style={styles.undoText}>Undo today</Text>
                </Pressable>
              ) : null}
              {!canCompleteToday ? (
                <Text style={styles.hint}>
                  {isTrackedToday
                    ? 'Come back tomorrow.'
                    : `Rest day.${nextTrackedLabel ? ` Next check-in ${nextTrackedLabel}.` : ''}`}
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
    marginTop: 16,
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
  undoButton: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  undoText: {
    color: '#4A4A4A',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    marginTop: 12,
    color: '#6B6B6B',
  },
});
