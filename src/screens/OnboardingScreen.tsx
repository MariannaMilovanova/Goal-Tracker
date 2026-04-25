import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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

import { DurationPicker } from '../components/DurationPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGoalStore } from '../store/goalStore';

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
  const { createGoal } = useGoalStore();
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(PRESET_DURATIONS[0]);
  const [customDays, setCustomDays] = useState('');
  const [trackedWeekdays, setTrackedWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const totalDays = useMemo(() => {
    const custom = Number(customDays);
    if (!Number.isNaN(custom) && custom > 0) {
      return custom;
    }
    return selectedDays ?? 0;
  }, [customDays, selectedDays]);

  const canSubmit = title.trim().length > 0 && totalDays > 0 && trackedWeekdays.length > 0;

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

  const handleCreateGoal = async () => {
    if (!canSubmit) {
      return;
    }
    await createGoal({
      title: title.trim(),
      totalDays,
      trackedWeekdays,
    });
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
