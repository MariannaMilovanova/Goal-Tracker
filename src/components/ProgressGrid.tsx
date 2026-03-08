import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GoalDayState } from '../store/goalTypes';

type ProgressGridProps = {
  total: number;
  timeline: GoalDayState[];
  highlightIndex?: number | null;
  onFrozenCellPress?: () => void;
};

const GRID_PADDING = 24;
const GRID_COLUMNS = 7;
const CELL_SIZE = 40;
const CELL_GAP = 6;
const CELL_RADIUS = 12;
const FROZEN_CELL_SOURCE = require('../../assets/frozen-cell.png');
const GRID_WIDTH = GRID_COLUMNS * CELL_SIZE + (GRID_COLUMNS - 1) * CELL_GAP;

function GridCell({
  state,
  isHighlighted,
  index,
  onFrozenCellPress,
}: {
  state: GoalDayState | 'future';
  isHighlighted: boolean;
  index: number;
  onFrozenCellPress?: () => void;
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
  const frozenScaleBoost = isFrozen ? 1.08 : 1;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * frozenScaleBoost }],
  }));

  if (isFrozen) {
    return (
      <Animated.View style={[styles.cell, styles.frozenCell, animatedStyle]}>
        <Pressable
          onPress={onFrozenCellPress}
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
        isComplete ? styles.cellComplete : styles.cellInactive,
        animatedStyle,
      ]}
    >
      <View style={[styles.fill, isComplete ? null : styles.fillInactive]}>
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
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ProgressGrid({ total, timeline, highlightIndex, onFrozenCellPress }: ProgressGridProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {Array.from({ length: total }).map((_, index) => {
          const state = timeline[index] ?? 'future';
          const isHighlighted = highlightIndex === index;
          return (
            <GridCell
              key={index}
              index={index}
              state={state}
              isHighlighted={isHighlighted}
              onFrozenCellPress={onFrozenCellPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: GRID_PADDING,
    alignItems: 'center',
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
  frozenCell: {
    overflow: 'hidden',
  },
  frozenPressable: {
    width: '100%',
    height: '100%',
  },
  frozenImage: {
    width: '100%',
    height: '100%',
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
  checkIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -12,
  },
});
