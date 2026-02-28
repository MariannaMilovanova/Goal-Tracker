import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BigNumber } from '../components/BigNumber';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressGrid } from '../components/ProgressGrid';
import { useGoalStore } from '../store/goalStore';
import { canMarkDone, canUndoToday, getLocalDateString } from '../utils/date';

export function HomeScreen() {
  const { goal, markDone, undoToday, updateGoal, resetGoal } = useGoalStore();
  const router = useRouter();
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const previousCompleted = useRef(goal?.completedDays ?? 0);
  const hasInitialized = useRef(false);

  const canCompleteToday = useMemo(() => {
    if (!goal) {
      return false;
    }
    if (goal.completedDays >= goal.totalDays) {
      return false;
    }
    const today = getLocalDateString();
    return canMarkDone(today, goal.lastCompletedDate);
  }, [goal]);

  const canUndo = useMemo(() => {
    if (!goal) {
      return false;
    }
    if (goal.completedDays <= 0) {
      return false;
    }
    const today = getLocalDateString();
    return canUndoToday(today, goal.lastCompletedDate);
  }, [goal]);

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
      setHighlightIndex(goal.completedDays - 1);
      setShowCelebration(true);
      const highlightTimer = setTimeout(() => setHighlightIndex(null), 650);
      const celebrateTimer = setTimeout(() => setShowCelebration(false), 1100);

      previousCompleted.current = goal.completedDays;
      return () => {
        clearTimeout(highlightTimer);
        clearTimeout(celebrateTimer);
      };
    }

    previousCompleted.current = goal.completedDays;
  }, [goal]);

  if (!goal) {
    return null;
  }

  const handleMarkDone = async () => {
    const didMark = await markDone();
    if (didMark) {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <CelebrationOverlay visible={showCelebration} />
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

        <View style={styles.gridSection}>
          <ProgressGrid
            total={goal.totalDays}
            completed={goal.completedDays}
            highlightIndex={highlightIndex}
          />
        </View>

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
              {!canCompleteToday ? <Text style={styles.hint}>Come back tomorrow.</Text> : null}
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
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
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
    marginTop: 32,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 24,
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
