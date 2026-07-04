import React, { useMemo } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '../components/PrimaryButton';
import { MAX_GOALS } from '../store/goalConfig';
import { useGoalStore } from '../store/goalStore';
import { Goal } from '../store/goalTypes';
import { getGoalStreak } from '../utils/goalMetrics';

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
}) {
  const { t } = useTranslation();
  const streak = getGoalStreak(goal);
  const progress = goal.totalDays > 0 ? goal.completedDays / goal.totalDays : 0;

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.card, isSelected ? styles.cardSelected : null]}
      accessibilityRole="button"
    >
      {isTrueFocus ? (
        <View style={styles.cardHeader}>
          <View style={styles.focusBadge}>
            <Text style={styles.focusBadgeText}>{`🔥 ${t('goals.trueFocus')}`}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.goalTitleRow}>
        <Text style={styles.goalTitle}>{goal.title}</Text>
        {!isTrueFocus ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            style={styles.iconAction}
            accessibilityRole="button"
            accessibilityLabel={t('goals.deleteGoalAccessibility', { title: goal.title })}
          >
            <Ionicons name="trash-outline" size={16} color="#B42318" />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.metaText}>
        {t('goals.daysCompleted', {
          completed: goal.completedDays,
          total: goal.totalDays,
        })}
      </Text>
      <Text style={styles.metaText}>{t('goals.streak', { count: streak })}</Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
      </View>

      {!isTrueFocus ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onMakeTrueFocus();
          }}
          style={styles.secondaryAction}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryActionText}>{t('goals.makeTrueFocus')}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function GoalsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    goals,
    trueFocusGoalId,
    selectedGoalId,
    setSelectedGoal,
    setTrueFocusGoal,
    deleteGoal,
    canCreateMoreGoals,
  } = useGoalStore();

  const orderedGoals = useMemo(() => {
    return [...goals].sort((left, right) => {
      if (left.id === trueFocusGoalId) {
        return -1;
      }
      if (right.id === trueFocusGoalId) {
        return 1;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [goals, trueFocusGoalId]);

  const handleOpenGoal = (goalId: string) => {
    setSelectedGoal(goalId);
    router.back();
  };

  const handleMakeTrueFocus = async (goalId: string) => {
    await setTrueFocusGoal(goalId);
  };

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert(
      t('goals.deleteGoalTitle'),
      t('goals.deleteGoalDescription', { title: goal.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void deleteGoal(goal.id);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={18} color="#4A4A4A" />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('goals.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {orderedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isTrueFocus={goal.id === trueFocusGoalId}
              isSelected={goal.id === selectedGoalId}
              onOpen={() => handleOpenGoal(goal.id)}
              onMakeTrueFocus={() => {
                void handleMakeTrueFocus(goal.id);
              }}
              onDelete={() => handleDeleteGoal(goal)}
            />
          ))}

          <View style={styles.createSection}>
            <PrimaryButton
              label={t('common.createGoal')}
              onPress={() => router.push('/new-goal')}
              disabled={!canCreateMoreGoals}
            />
            {!canCreateMoreGoals ? (
              <Text style={styles.limitText}>{t('goals.limit', { count: MAX_GOALS })}</Text>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#4A4A4A',
    marginLeft: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  headerSpacer: {
    width: 64,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  cardSelected: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  cardHeader: {
    marginBottom: 8,
  },
  focusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FFF4E8',
    borderWidth: 1,
    borderColor: '#F2CFB1',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  focusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8D4C15',
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  goalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  iconAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ECECEC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22C56E',
  },
  secondaryAction: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7D7D7',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  createSection: {
    marginTop: 8,
    gap: 10,
  },
  limitText: {
    fontSize: 13,
    color: '#7A7A7A',
    textAlign: 'center',
  },
});
