import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { DurationPicker } from '../components/DurationPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGoalStore } from '../store/goalStore';
import {
  DEFAULT_MULTIPLE_DAILY_TARGET,
  MAX_DAILY_TARGET,
  MAX_GOALS,
  MIN_MULTIPLE_DAILY_TARGET,
} from '../store/goalConfig';
import { GoalType } from '../store/goalTypes';

const PRESET_DURATIONS = [7, 30, 100];
const WEEKDAY_OPTIONS = [
  { key: 1, translationKey: 'weekdays.short.mon' },
  { key: 2, translationKey: 'weekdays.short.tue' },
  { key: 3, translationKey: 'weekdays.short.wed' },
  { key: 4, translationKey: 'weekdays.short.thu' },
  { key: 5, translationKey: 'weekdays.short.fri' },
  { key: 6, translationKey: 'weekdays.short.sat' },
  { key: 0, translationKey: 'weekdays.short.sun' },
];

export function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { createGoal, goals } = useGoalStore();
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(PRESET_DURATIONS[0]);
  const [customDays, setCustomDays] = useState('');
  const [trackedWeekdays, setTrackedWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [goalType, setGoalType] = useState<GoalType>('oncePerDay');
  const [dailyTarget, setDailyTarget] = useState(String(DEFAULT_MULTIPLE_DAILY_TARGET));

  const totalDays = useMemo(() => {
    const custom = Number(customDays);
    if (!Number.isNaN(custom) && custom > 0) {
      return custom;
    }
    return selectedDays ?? 0;
  }, [customDays, selectedDays]);
  const dailyTargetValue = useMemo(() => {
    const parsed = Number(dailyTarget);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.floor(parsed);
  }, [dailyTarget]);
  const dailyTargetIsValid =
    goalType === 'oncePerDay' ||
    (dailyTargetValue >= MIN_MULTIPLE_DAILY_TARGET && dailyTargetValue <= MAX_DAILY_TARGET);

  const canSubmit =
    title.trim().length > 0 &&
    totalDays > 0 &&
    trackedWeekdays.length > 0 &&
    dailyTargetIsValid &&
    goals.length < MAX_GOALS;

  const handleSelectPreset = (value: number) => {
    setSelectedDays(value);
    setCustomDays('');
  };

  const handleCustomChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCustomDays(sanitized);
    if (sanitized.length > 0) {
      setSelectedDays(null);
    } else if (selectedDays === null) {
      setSelectedDays(PRESET_DURATIONS[0]);
    }
  };

  const handleGoalTypeChange = (value: GoalType) => {
    setGoalType(value);
    if (value === 'multipleTimesPerDay' && dailyTarget.length === 0) {
      setDailyTarget(String(DEFAULT_MULTIPLE_DAILY_TARGET));
    }
  };

  const handleDailyTargetChange = (value: string) => {
    setDailyTarget(value.replace(/[^0-9]/g, ''));
  };

  const handleCreateGoal = async () => {
    if (!canSubmit) {
      return;
    }
    const created = await createGoal({
      title: title.trim(),
      totalDays,
      trackedWeekdays,
      type: goalType,
      dailyTarget: goalType === 'multipleTimesPerDay' ? dailyTargetValue : 1,
    });
    if (!created) {
      Alert.alert('Goal limit reached', 'You can track up to 10 goals.');
      return;
    }
    router.replace('/');
  };

  const toggleTrackedWeekday = (weekday: number) => {
    setTrackedWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((value) => value !== weekday);
      }
      return [...current, weekday].sort((a, b) => a - b);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>{t('onboarding.title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>

            <Text style={styles.label}>{t('onboarding.goalTitle')}</Text>
            <TextInput
              placeholder={t('onboarding.goalPlaceholder')}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="sentences"
              returnKeyType="done"
              accessibilityLabel={t('onboarding.goalTitle')}
            />

            <DurationPicker
              presets={PRESET_DURATIONS}
              selected={selectedDays}
              customValue={customDays}
              onSelect={handleSelectPreset}
              onCustomChange={handleCustomChange}
            />

            <Text style={styles.label}>{t('goalType.label')}</Text>
            <View style={styles.segmentedControl}>
              {(['oncePerDay', 'multipleTimesPerDay'] as GoalType[]).map((typeOption) => {
                const selected = goalType === typeOption;
                return (
                  <Pressable
                    key={typeOption}
                    onPress={() => handleGoalTypeChange(typeOption)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.segmentButton, selected ? styles.segmentButtonSelected : null]}
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        selected ? styles.segmentButtonTextSelected : null,
                      ]}
                    >
                      {t(
                        typeOption === 'oncePerDay'
                          ? 'goalType.oncePerDay'
                          : 'goalType.multipleTimesPerDay',
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {goalType === 'multipleTimesPerDay' ? (
              <>
                <Text style={styles.label}>{t('goalType.timesPerDay')}</Text>
                <TextInput
                  placeholder={String(DEFAULT_MULTIPLE_DAILY_TARGET)}
                  value={dailyTarget}
                  onChangeText={handleDailyTargetChange}
                  style={styles.input}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel={t('goalType.timesPerDay')}
                />
                {!dailyTargetIsValid ? (
                  <Text style={styles.errorText}>
                    {t('goalType.timesPerDayValidation', {
                      min: MIN_MULTIPLE_DAILY_TARGET,
                      max: MAX_DAILY_TARGET,
                    })}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Text style={styles.label}>{t('onboarding.trackOn')}</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAY_OPTIONS.map((weekday) => {
                const selected = trackedWeekdays.includes(weekday.key);
                const label = t(weekday.translationKey);
                return (
                  <Pressable
                    key={weekday.key}
                    onPress={() => toggleTrackedWeekday(weekday.key)}
                    style={[styles.weekdayChip, selected ? styles.weekdayChipSelected : null]}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Text
                      style={[
                        styles.weekdayChipLabel,
                        selected ? styles.weekdayChipLabelSelected : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {trackedWeekdays.length === 0 ? (
              <Text style={styles.errorText}>{t('onboarding.trackedDaysError')}</Text>
            ) : null}
            {goals.length >= MAX_GOALS ? (
              <Text style={styles.errorText}>You can track up to 10 goals.</Text>
            ) : null}

            <View style={styles.footer}>
              <PrimaryButton
                label={t('common.createGoal')}
                onPress={handleCreateGoal}
                disabled={!canSubmit}
              />
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
    justifyContent: 'center',
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    marginBottom: 24,
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
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
    backgroundColor: '#F6F6F6',
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  segmentButtonSelected: {
    backgroundColor: '#111111',
  },
  segmentButtonText: {
    color: '#4A4A4A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentButtonTextSelected: {
    color: '#FFFFFF',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  weekdayChip: {
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  weekdayChipSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  weekdayChipLabel: {
    color: '#4A4A4A',
    fontSize: 13,
    fontWeight: '600',
  },
  weekdayChipLabelSelected: {
    color: '#FFFFFF',
  },
  errorText: {
    marginTop: 2,
    marginBottom: 8,
    color: '#B42318',
  },
  footer: {
    marginTop: 24,
  },
});
