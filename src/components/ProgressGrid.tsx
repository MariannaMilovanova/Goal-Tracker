import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type ProgressGridProps = {
  total: number;
  completed: number;
  highlightIndex?: number | null;
};

const GRID_PADDING = 24;
const CELL_SIZE = 24;
const CELL_GAP = 8;
const CELL_RADIUS = 8;

function GridCell({
  isComplete,
  isHighlighted,
  index,
}: {
  isComplete: boolean;
  isHighlighted: boolean;
  index: number;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    scale.value = 0.85;
    scale.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.7 });
  }, [isHighlighted, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const gradientId = `progressGradient-${index}`;

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
            <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={styles.checkIcon} />
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ProgressGrid({ total, completed, highlightIndex }: ProgressGridProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {Array.from({ length: total }).map((_, index) => {
          const isComplete = index < completed;
          const isHighlighted = highlightIndex === index;
          return (
            <GridCell
              key={index}
              index={index}
              isComplete={isComplete}
              isHighlighted={isHighlighted}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_RADIUS,
  },
  cellInactive: {
    backgroundColor: 'transparent',
  },
  cellComplete: {
    shadowColor: '#1FAE63',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
    marginTop: -8,
  },
});
