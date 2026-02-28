import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '../components/PrimaryButton';
import { useGoalStore } from '../store/goalStore';

export function EditGoalScreen() {
  const router = useRouter();
  const { goal, resetGoal, updateGoal } = useGoalStore();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [totalDays, setTotalDays] = useState(goal ? String(goal.totalDays) : '');
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [completedDays, setCompletedDays] = useState(goal ? String(goal.completedDays) : '0');

  const totalDaysValue = useMemo(() => {
    const parsed = Number(totalDays);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return parsed;
  }, [totalDays]);

  const maxCompletedDays = useMemo(() => {
    if (totalDaysValue > 0) {
      return Math.floor(totalDaysValue);
    }
    return Math.max(1, Math.floor(goal?.totalDays ?? 1));
  }, [goal, totalDaysValue]);

  const completedDaysValue = useMemo(() => {
    const parsed = Number(completedDays);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return parsed;
  }, [completedDays]);

  const normalizedCompletedDays = useMemo(() => {
    return Math.max(0, Math.floor(completedDaysValue));
  }, [completedDaysValue]);

  const completedDaysTooHigh = advancedEnabled && normalizedCompletedDays > maxCompletedDays;
  const canSubmit = title.trim().length > 0 && totalDaysValue > 0 && !completedDaysTooHigh;
  if (!goal) {
    return null;
  }

  const handleBack = () => {
    router.back();
  };

  const handleTotalDaysChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setTotalDays(sanitized);
  };

  const handleCompletedDaysChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCompletedDays(sanitized);
  };

  const handleSave = async () => {
    if (!canSubmit) {
      return;
    }

    const updates = {
      title: title.trim(),
      totalDays: totalDaysValue,
      ...(advancedEnabled ? { completedDays: normalizedCompletedDays } : {}),
    };

    await updateGoal(updates);
    router.back();
  };

  const handleReset = () => {
    Alert.alert('Reset goal?', 'This will remove your current goal and progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetGoal();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Pressable onPress={handleBack} accessibilityLabel="Go back">
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Text style={styles.title}>Edit Goal</Text>
              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.label}>Goal title</Text>
            <TextInput
              placeholder="No sugar"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="sentences"
              returnKeyType="done"
              accessibilityLabel="Goal title"
            />

            <Text style={styles.label}>Total days</Text>
            <TextInput
              placeholder="30"
              value={totalDays}
              onChangeText={handleTotalDaysChange}
              style={styles.input}
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel="Total days"
            />

            <View style={styles.advancedRow}>
              <View>
                <Text style={styles.advancedTitle}>Advanced</Text>
                <Text style={styles.advancedSubtitle}>Edit completed days</Text>
              </View>
              <Switch value={advancedEnabled} onValueChange={setAdvancedEnabled} />
            </View>

            {advancedEnabled ? (
              <View style={styles.advancedSection}>
                <Text style={styles.label}>Completed days</Text>
                <TextInput
                  placeholder="0"
                  value={completedDays}
                  onChangeText={handleCompletedDaysChange}
                  style={styles.input}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel="Completed days"
                />
                {completedDaysTooHigh ? (
                  <Text style={styles.errorText}>
                    Completed days must be less than or equal to total days.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.footer}>
              <PrimaryButton label="Save" onPress={handleSave} disabled={!canSubmit} />
              <Pressable onPress={handleReset} accessibilityRole="button">
                <Text style={styles.resetText}>Reset goal</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerSpacer: {
    width: 40,
  },
  backText: {
    color: '#4A4A4A',
    fontSize: 16,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#C7C7C7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  advancedSubtitle: {
    marginTop: 2,
    color: '#6B6B6B',
    fontSize: 13,
  },
  advancedSection: {
    marginTop: 8,
  },
  footer: {
    marginTop: 12,
    alignItems: 'center',
    gap: 16,
  },
  resetText: {
    color: '#B42318',
    fontWeight: '600',
  },
  errorText: {
    marginTop: -8,
    color: '#B42318',
  },
});
