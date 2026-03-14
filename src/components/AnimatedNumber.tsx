import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type AnimatedNumberProps = {
  value: number;
};

const ENTER_DELAY_MS = 192;
const OLD_NUMBER_MS = 480;
const NEW_NUMBER_MS = 560;
const SETTLE_MS = 280;
const FINISH_MS = ENTER_DELAY_MS + NEW_NUMBER_MS + SETTLE_MS;

export function AnimatedNumber({ value }: AnimatedNumberProps) {
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settledValue, setSettledValue] = useState(value);
  const [transition, setTransition] = useState<{ from: number; to: number } | null>(null);
  const oldOpacity = useSharedValue(1);
  const oldTranslateY = useSharedValue(0);
  const oldScale = useSharedValue(1);
  const newOpacity = useSharedValue(1);
  const newTranslateY = useSharedValue(0);
  const newScale = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (finishTimer.current) {
        clearTimeout(finishTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (value === settledValue) {
      return;
    }

    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
    }

    setTransition({ from: settledValue, to: value });

    oldOpacity.value = 1;
    oldTranslateY.value = 0;
    oldScale.value = 1;
    newOpacity.value = 0;
    newTranslateY.value = 16;
    newScale.value = 0.94;

    oldOpacity.value = withTiming(0, { duration: OLD_NUMBER_MS });
    oldTranslateY.value = withTiming(-14, { duration: OLD_NUMBER_MS });
    oldScale.value = withTiming(0.98, { duration: OLD_NUMBER_MS });
    newOpacity.value = withDelay(ENTER_DELAY_MS, withTiming(1, { duration: NEW_NUMBER_MS }));
    newTranslateY.value = withDelay(ENTER_DELAY_MS, withTiming(0, { duration: NEW_NUMBER_MS }));
    newScale.value = withSequence(
      withDelay(ENTER_DELAY_MS, withTiming(1.04, { duration: NEW_NUMBER_MS })),
      withTiming(1, { duration: SETTLE_MS }),
    );

    finishTimer.current = setTimeout(() => {
      setSettledValue(value);
      setTransition(null);
      finishTimer.current = null;
    }, FINISH_MS);
  }, [
    settledValue,
    value,
    newOpacity,
    newScale,
    newTranslateY,
    oldOpacity,
    oldScale,
    oldTranslateY,
  ]);

  const oldNumberStyle = useAnimatedStyle(() => ({
    opacity: oldOpacity.value,
    transform: [{ translateY: oldTranslateY.value }, { scale: oldScale.value }],
  }));

  const newNumberStyle = useAnimatedStyle(() => ({
    opacity: newOpacity.value,
    transform: [{ translateY: newTranslateY.value }, { scale: newScale.value }],
  }));

  if (!transition) {
    return <Animated.Text style={styles.value}>{settledValue}</Animated.Text>;
  }

  return (
    <View style={styles.stack}>
      <Animated.Text style={[styles.value, styles.absoluteValue, oldNumberStyle]}>
        {transition.from}
      </Animated.Text>
      <Animated.Text style={[styles.value, styles.absoluteValue, newNumberStyle]}>
        {transition.to}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 64,
    fontWeight: '700',
    color: '#111',
    lineHeight: 76,
    textAlign: 'center',
  },
  absoluteValue: {
    position: 'absolute',
  },
});
