import React, { useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { addDaysToDateString, getLocalDateString, isTrackedOnDate } from '../utils/date';
import { GoalDayState } from '../store/goalTypes';

export type ProgressGridCellState = GoalDayState | 'future' | 'past' | 'today';

export type ProgressGridCellPressPayload = {
  date: string;
  state: ProgressGridCellState;
  isTracked: boolean;
};

type ProgressGridProps = {
  total: number;
  timeline: GoalDayState[];
  elapsedDays: number;
  highlightIndex?: number | null;
  startDate?: string;
  trackedWeekdays?: number[];
  onCellPress?: (payload: ProgressGridCellPressPayload) => void;
};

const GRID_PADDING = 24;
const GRID_COLUMNS = 7;
const CELL_SIZE = 40;
const CELL_GAP = 6;
const CELL_RADIUS = 12;
const FROZEN_CELL_SOURCE = require('../../assets/frozen-cell.png');
const GRID_WIDTH = GRID_COLUMNS * CELL_SIZE + (GRID_COLUMNS - 1) * CELL_GAP;

function parseStartDate(startDate?: string): Date | null {
  if (!startDate) {
    return null;
  }
  const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (localDateMatch) {
    const year = Number(localDateMatch[1]);
    const month = Number(localDateMatch[2]) - 1;
    const day = Number(localDateMatch[3]);
    return new Date(year, month, day);
  }
  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function GridCell({
  state,
  isHighlighted,
  index,
  date,
  isTracked,
  onCellPress,
}: {
  state: ProgressGridCellState;
  isHighlighted: boolean;
  index: number;
  date: string;
  isTracked: boolean;
  onCellPress?: (payload: ProgressGridCellPressPayload) => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    scale.value = 0.85;
    scale.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.7 });
  }, [isHighlighted, scale]);

  const gradientId = `progressGradient-${index}`;
  const isComplete = state === 'completed';
  const isFrozen = state === 'skipped';
  const isPast = state === 'past';
  const isOff = state === 'off';
  const isToday = state === 'today';
  const frozenScaleBoost = isFrozen ? 1.08 : 1;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * frozenScaleBoost }],
  }));

  const handlePress = () => {
    onCellPress?.({ date, state, isTracked });
  };

  if (isFrozen) {
    return (
      <Animated.View style={[styles.cell, styles.frozenCell, animatedStyle]}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Skipped day"
          style={styles.frozenPressable}
        >
          <Image source={FROZEN_CELL_SOURCE} style={styles.frozenImage} resizeMode="cover" />
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.cell,
        isComplete ? styles.cellComplete : null,
        isPast ? styles.cellPast : null,
        isOff ? styles.cellOff : null,
        isToday ? styles.cellToday : null,
        !isComplete && !isPast && !isOff && !isToday ? styles.cellInactive : null,
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Day ${date}`}
        style={styles.cellPressable}
      >
        <View
          style={[
            styles.fill,
            isToday ? styles.todayFill : null,
            !isComplete && !isPast && !isOff && !isToday ? styles.fillInactive : null,
          ]}
        >
          {isComplete || isPast || isOff ? (
            <>
              {isComplete ? (
                <>
                  <Svg width="100%" height="100%">
                    <Defs>
                      <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#46E08C" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#1FAE63" stopOpacity="1" />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      width="100%"
                      height="100%"
                      rx={CELL_RADIUS}
                      ry={CELL_RADIUS}
                      fill={`url(#${gradientId})`}
                    />
                  </Svg>
                  <Ionicons name="checkmark-sharp" size={24} color="#FFFFFF" style={styles.checkIcon} />
                </>
              ) : (
                <>
                  {isPast ? (
                    <>
                      <View style={styles.pastFill} />
                      <Ionicons name="close" size={20} color="#7D7D7D" style={styles.pastIcon} />
                    </>
                  ) : (
                    <>
                      <View style={styles.offFill} />
                    </>
                  )}
                </>
              )}
            </>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ProgressGrid({
  total,
  timeline,
  elapsedDays,
  highlightIndex,
  startDate,
  trackedWeekdays = [],
  onCellPress,
}: ProgressGridProps) {
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: 'long' }),
    [],
  );
  const monthSections = useMemo(() => {
    const safeTotal = Math.max(0, Math.floor(total));
    if (safeTotal === 0) {
      return [];
    }

    const baseDate = parseStartDate(startDate) ?? new Date();
    const normalizedBaseDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
    );
    const startDateString = getLocalDateString(normalizedBaseDate);

    const sections: Array<{
      key: string;
      monthLabel: string;
      leadingOffset: number;
      trailingOffset: number;
      days: Array<{
        key: string;
        dayIndex: number;
        state: ProgressGridCellState;
        date: string;
        isTracked: boolean;
        isHighlighted: boolean;
      }>;
    }> = [];
    const sectionIndexByMonth = new Map<string, number>();

    for (let dayIndex = 0; dayIndex < safeTotal; dayIndex += 1) {
      const date = new Date(normalizedBaseDate);
      date.setDate(normalizedBaseDate.getDate() + dayIndex);

      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      let sectionIndex = sectionIndexByMonth.get(monthKey);
      if (sectionIndex === undefined) {
        sectionIndex = sections.length;
        sectionIndexByMonth.set(monthKey, sectionIndex);
        sections.push({
          key: monthKey,
          monthLabel: monthFormatter.format(date),
          leadingOffset: 0,
          trailingOffset: 0,
          days: [],
        });
      }

      const timelineState = timeline[dayIndex];
      const dateString = addDaysToDateString(startDateString, dayIndex);
      const isTracked = isTrackedOnDate(dateString, trackedWeekdays);
      const state: ProgressGridCellState =
        timelineState === 'skipped'
          ? 'skipped'
          : timelineState === 'completed'
            ? 'completed'
            : timelineState === 'off'
              ? 'off'
            : dayIndex === elapsedDays - 1
              ? 'today'
            : !isTracked
              ? 'off'
            : dayIndex < elapsedDays
              ? 'past'
              : 'future';

      sections[sectionIndex].days.push({
        key: `day-${dayIndex}`,
        dayIndex,
        date: dateString,
        isTracked,
        state,
        isHighlighted: highlightIndex === dayIndex,
      });
    }

    sections.forEach((section) => {
      const firstDayIndex = section.days[0]?.dayIndex;
      if (firstDayIndex === undefined) {
        return;
      }
      const firstDate = new Date(normalizedBaseDate);
      firstDate.setDate(normalizedBaseDate.getDate() + firstDayIndex);
      const firstWeekday = (firstDate.getDay() + 6) % 7;
      section.leadingOffset = firstWeekday;
      const filledCount = section.leadingOffset + section.days.length;
      section.trailingOffset = (GRID_COLUMNS - (filledCount % GRID_COLUMNS)) % GRID_COLUMNS;
    });

    return sections;
  }, [elapsedDays, highlightIndex, monthFormatter, startDate, timeline, total, trackedWeekdays]);

  return (
    <View style={styles.wrapper}>
      {monthSections.map((section) => (
        <View key={section.key} style={styles.monthSection}>
          <View style={styles.monthLabelRow}>
            <Text style={styles.monthLabel}>{section.monthLabel}</Text>
          </View>
          <View style={styles.grid}>
            {Array.from({ length: section.leadingOffset }, (_, index) => (
              <View key={`empty-leading-${section.key}-${index}`} style={styles.emptyCell} />
            ))}
            {section.days.map((day) => (
              <GridCell
                key={day.key}
                index={day.dayIndex}
                date={day.date}
                isTracked={day.isTracked}
                state={day.state}
                isHighlighted={day.isHighlighted}
                onCellPress={onCellPress}
              />
            ))}
            {Array.from({ length: section.trailingOffset }, (_, index) => (
              <View key={`empty-trailing-${section.key}-${index}`} style={styles.emptyCell} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: GRID_PADDING,
    alignItems: 'center',
  },
  monthSection: {
    width: GRID_WIDTH,
    marginBottom: 8,
  },
  monthLabelRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  monthLabel: {
    fontSize: 11,
    color: '#7B7B7B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
    width: GRID_WIDTH,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_RADIUS,
  },
  emptyCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cellPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenCell: {
    overflow: 'hidden',
  },
  frozenPressable: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenImage: {
    width: '108%',
    height: '108%',
    borderRadius: CELL_RADIUS,
  },
  cellInactive: {
    backgroundColor: 'transparent',
  },
  cellComplete: {
    shadowColor: '#1FAE63',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cellPast: {
    shadowColor: '#A0A0A0',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cellOff: {
    shadowColor: '#BEBEBE',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cellToday: {
    shadowColor: '#2F80ED',
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: CELL_RADIUS,
    overflow: 'hidden',
  },
  fillInactive: {
    backgroundColor: '#E6E6E6',
    borderWidth: 1,
    borderColor: '#D5D5D5',
  },
  pastFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E9E9E9',
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: CELL_RADIUS,
  },
  offFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: CELL_RADIUS,
  },
  todayFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E6E6E6',
    borderWidth: 1,
    borderColor: '#2D6CDF',
    borderRadius: CELL_RADIUS,
  },
  checkIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -12,
  },
  pastIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -10,
  },
});
