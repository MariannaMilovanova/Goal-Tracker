import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type ProgressGridProps = {
  total: number;
  completed: number;
  highlightIndex?: number | null;
};

const GRID_PADDING = 24;
const CELL_SIZE = 16;
const CELL_GAP = 6;

function GridCell({ isComplete, isHighlighted }: { isComplete: boolean; isHighlighted: boolean }) {
  const progress = useSharedValue(isComplete ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isComplete ? 1 : 0, { duration: 280 });
  }, [isComplete, progress]);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    scale.value = withSequence(
      withTiming(1.25, { duration: 160 }),
      withTiming(1, { duration: 200 }),
    );
  }, [isHighlighted, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#D9D9D9', '#2ECC71']),
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.cell, animatedStyle]} />;
}

export function ProgressGrid({ total, completed, highlightIndex }: ProgressGridProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {Array.from({ length: total }).map((_, index) => {
          const isComplete = index < completed;
          const isHighlighted = highlightIndex === index;
          return (
            <GridCell key={index} isComplete={isComplete} isHighlighted={isHighlighted} />
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 4,
  },
});
