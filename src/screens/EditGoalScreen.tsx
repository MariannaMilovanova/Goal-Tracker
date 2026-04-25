import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton } from '../components/PrimaryButton';
import { useGoalStore } from '../store/goalStore';
import { addDaysToDateString, getLocalDateString } from '../utils/date';

const WEEKDAY_OPTIONS = [
  { key: 1, translationKey: 'weekdays.short.mon' },
  { key: 2, translationKey: 'weekdays.short.tue' },
  { key: 3, translationKey: 'weekdays.short.wed' },
  { key: 4, translationKey: 'weekdays.short.thu' },
  { key: 5, translationKey: 'weekdays.short.fri' },
  { key: 6, translationKey: 'weekdays.short.sat' },
  { key: 0, translationKey: 'weekdays.short.sun' },
];

const CALENDAR_WEEKDAY_KEYS = [
  'weekdays.narrow.mon',
  'weekdays.narrow.tue',
  'weekdays.narrow.wed',
  'weekdays.narrow.thu',
  'weekdays.narrow.fri',
  'weekdays.narrow.sat',
  'weekdays.narrow.sun',
];

function getGoalStartDateValue(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return getLocalDateString();
  }
  return getLocalDateString(parsed);
}

function getMonthStart(value: string): Date {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toLocalNoonISOString(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0).toISOString();
}

function toLocalDisplayDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function buildCalendarCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; date: string | null; dayNumber: number | null }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-${index}`, date: null, dayNumber: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = getLocalDateString(new Date(year, month, day));
    cells.push({ key: date, date, dayNumber: day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, date: null, dayNumber: null });
  }

  return cells;
}

export function EditGoalScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { goal, resetGoal, updateGoal } = useGoalStore();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [totalDays, setTotalDays] = useState(goal ? String(goal.totalDays) : '');
  const [trackedWeekdays, setTrackedWeekdays] = useState<number[]>(
    goal?.trackedWeekdays ?? [0, 1, 2, 3, 4, 5, 6],
  );
  const [startDate, setStartDate] = useState(
    goal ? getGoalStartDateValue(goal.createdAt) : getLocalDateString(),
  );
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    goal
      ? getMonthStart(getGoalStartDateValue(goal.createdAt))
      : getMonthStart(getLocalDateString()),
  );
  const language = i18n.resolvedLanguage;

  const totalDaysValue = useMemo(() => {
    const parsed = Number(totalDays);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return parsed;
  }, [totalDays]);

  const today = getLocalDateString();
  const latestAllowedStartDate =
    goal && goal.timeline.length > 0
      ? addDaysToDateString(today, -(goal.timeline.length - 1))
      : today;
  const startDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [language],
  );
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        month: 'long',
        year: 'numeric',
      }),
    [language],
  );
  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
  const startDateIsValid = startDate <= latestAllowedStartDate;

  const canSubmit =
    title.trim().length > 0 && totalDaysValue > 0 && trackedWeekdays.length > 0 && startDateIsValid;
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

  const toggleTrackedWeekday = (weekday: number) => {
    setTrackedWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((value) => value !== weekday);
      }
      return [...current, weekday].sort((a, b) => a - b);
    });
  };

  const handleSave = async () => {
    if (!canSubmit) {
      return;
    }

    const updates = {
      title: title.trim(),
      totalDays: totalDaysValue,
      trackedWeekdays,
      createdAt: toLocalNoonISOString(startDate),
    };

    const updated = await updateGoal(updates);
    if (!updated) {
      Alert.alert(
        t('editGoal.startDateUnavailableTitle'),
        t('editGoal.startDateUnavailableDescription'),
      );
      return;
    }
    router.back();
  };

  const handleReset = () => {
    Alert.alert(t('editGoal.resetGoalTitle'), t('editGoal.resetGoalDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: async () => {
          await resetGoal();
          router.replace('/');
        },
      },
    ]);
  };

  const openCalendar = () => {
    setCalendarMonth(getMonthStart(startDate));
    setIsCalendarVisible(true);
  };

  const closeCalendar = () => {
    setIsCalendarVisible(false);
  };

  const handleSelectStartDate = (value: string) => {
    if (value > latestAllowedStartDate) {
      return;
    }
    setStartDate(value);
    setCalendarMonth(getMonthStart(value));
    setIsCalendarVisible(false);
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
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBack}
                accessibilityLabel={t('common.back')}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={18} color="#4A4A4A" />
                <Text style={styles.backText}>{t('common.back')}</Text>
              </Pressable>
              <Text style={styles.title}>{t('editGoal.title')}</Text>
              <View style={styles.headerSpacer} />
            </View>

            <Text style={styles.label}>{t('editGoal.goalTitle')}</Text>
            <TextInput
              placeholder={t('editGoal.goalPlaceholder')}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="sentences"
              returnKeyType="done"
              accessibilityLabel={t('editGoal.goalTitle')}
            />

            <Text style={styles.label}>{t('editGoal.totalDays')}</Text>
            <TextInput
              placeholder="30"
              value={totalDays}
              onChangeText={handleTotalDaysChange}
              style={styles.input}
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel={t('editGoal.totalDays')}
            />

            <Text style={styles.label}>{t('editGoal.startDate')}</Text>
            <Pressable style={styles.dateField} onPress={openCalendar} accessibilityRole="button">
              <Text style={styles.dateFieldValue}>
                {startDateFormatter.format(toLocalDisplayDate(startDate))}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#4A4A4A" />
            </Pressable>
            <Text style={styles.helperText}>
              {goal.timeline.length > 0
                ? t('editGoal.latestAvailableStartDate', {
                    date: startDateFormatter.format(toLocalDisplayDate(latestAllowedStartDate)),
                  })
                : t('editGoal.chooseDayGoalBegan')}
            </Text>

            <Text style={styles.label}>{t('editGoal.trackOn')}</Text>
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
            {!startDateIsValid ? (
              <Text style={styles.errorText}>{t('editGoal.startDateValidation')}</Text>
            ) : null}

            <View style={styles.footer}>
              <Pressable
                onPress={handleReset}
                accessibilityRole="button"
                style={styles.resetButton}
              >
                <Ionicons name="refresh-outline" size={16} color="#B42318" />
                <Text style={styles.resetText}>{t('editGoal.resetGoal')}</Text>
              </Pressable>
              <View style={styles.footerPrimary}>
                <PrimaryButton
                  label={t('common.save')}
                  onPress={handleSave}
                  disabled={!canSubmit}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={isCalendarVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCalendar} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setCalendarMonth((current) => addMonths(current, -1))}
                style={styles.monthNavButton}
              >
                <Ionicons name="chevron-back" size={18} color="#4A4A4A" />
              </Pressable>
              <Text style={styles.modalTitle}>{monthFormatter.format(calendarMonth)}</Text>
              <Pressable
                onPress={() => setCalendarMonth((current) => addMonths(current, 1))}
                style={styles.monthNavButton}
              >
                <Ionicons name="chevron-forward" size={18} color="#4A4A4A" />
              </Pressable>
            </View>

            <View style={styles.calendarWeekdays}>
              {CALENDAR_WEEKDAY_KEYS.map((translationKey) => (
                <Text key={translationKey} style={styles.calendarWeekdayLabel}>
                  {t(translationKey)}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                if (!cell.date || !cell.dayNumber) {
                  return <View key={cell.key} style={styles.calendarCellPlaceholder} />;
                }

                const disabled = cell.date > latestAllowedStartDate;
                const selected = cell.date === startDate;

                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => handleSelectStartDate(cell.date!)}
                    disabled={disabled}
                    style={[
                      styles.calendarCell,
                      selected ? styles.calendarCellSelected : null,
                      disabled ? styles.calendarCellDisabled : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarCellLabel,
                        selected ? styles.calendarCellLabelSelected : null,
                        disabled ? styles.calendarCellLabelDisabled : null,
                      ]}
                    >
                      {cell.dayNumber}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.modalHelperText}>
              {t('editGoal.selectPastDateUpTo', {
                date: startDateFormatter.format(toLocalDisplayDate(latestAllowedStartDate)),
              })}
            </Text>

            <View style={styles.modalActions}>
              <Pressable onPress={closeCalendar} style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryButtonLabel}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    width: 56,
  },
  backButton: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#4A4A4A',
    fontSize: 16,
    marginLeft: 2,
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
  dateField: {
    borderWidth: 1,
    borderColor: '#C7C7C7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldValue: {
    fontSize: 16,
    color: '#111111',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7A7A7A',
    marginBottom: 20,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
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
    marginTop: -8,
    marginBottom: 8,
    color: '#B42318',
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerPrimary: {
    minWidth: 120,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7B3AD',
    backgroundColor: '#FFF4F2',
  },
  resetText: {
    color: '#B42318',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.22)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F4',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarWeekdayLabel: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#909090',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCellPlaceholder: {
    width: '14.2857%',
    aspectRatio: 1,
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 6,
  },
  calendarCellSelected: {
    backgroundColor: '#111111',
  },
  calendarCellDisabled: {
    opacity: 0.28,
  },
  calendarCellLabel: {
    fontSize: 15,
    color: '#222222',
    fontWeight: '500',
  },
  calendarCellLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarCellLabelDisabled: {
    color: '#909090',
  },
  modalHelperText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: '#6F6F6F',
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalSecondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalSecondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A4A4A',
  },
});
