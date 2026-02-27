import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type AnimatedNumberProps = {
  value: number;
};

export function AnimatedNumber({ value }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const animatedValue = useSharedValue(value);
  const scale = useSharedValue(1);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: 450 });
    scale.value = withSequence(
      withTiming(1.12, { duration: 140 }),
      withTiming(1, { duration: 180 }),
    );
  }, [animatedValue, scale, value]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplayValue)(current);
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.value, animatedStyle]}>{displayValue}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 64,
    fontWeight: '700',
    color: '#111',
  },
});
