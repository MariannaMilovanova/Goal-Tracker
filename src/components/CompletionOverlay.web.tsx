import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type CompletionOverlayProps = {
  visible: boolean;
  fromValue: number;
  toValue: number;
  onFinish: () => void;
  label?: string;
};

const ANTICIPATION_MS = 160;
const TOTAL_MS = 3000;
const FADE_IN_MS = 300;
const FADE_OUT_MS = 300;
const HOLD_MS = TOTAL_MS - FADE_IN_MS - FADE_OUT_MS;
const NUMBER_FONT_SIZE = 44;
const NUMBER_LINE_HEIGHT = 52;

export function CompletionOverlay({
  visible,
  fromValue,
  toValue,
  onFinish,
  label = 'Completed!',
}: CompletionOverlayProps) {
  const isAnimating = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overlayOpacity = useSharedValue(0);
  const fireScale = useSharedValue(0.85);
  const glowScale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0);
  const numberTranslateY = useSharedValue(0);
  const oldOpacity = useSharedValue(1);
  const newOpacity = useSharedValue(0);
  const numberScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      isAnimating.current = false;
      overlayOpacity.value = 0;
      if (finishTimer.current) {
        clearTimeout(finishTimer.current);
        finishTimer.current = null;
      }
      return;
    }

    if (isAnimating.current) {
      return;
    }
    isAnimating.current = true;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    overlayOpacity.value = 0;
    fireScale.value = 0.85;
    glowScale.value = 0.8;
    glowOpacity.value = 0;
    numberTranslateY.value = 0;
    oldOpacity.value = 1;
    newOpacity.value = 0;
    numberScale.value = 1;

    overlayOpacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS }),
      withDelay(HOLD_MS, withTiming(0, { duration: FADE_OUT_MS }))
    );

    fireScale.value = withDelay(
      ANTICIPATION_MS,
      withSequence(
        withSpring(1.15, { damping: 10, stiffness: 200 }),
        withSpring(1, { damping: 12, stiffness: 180 })
      )
    );

    glowScale.value = withDelay(
      ANTICIPATION_MS,
      withTiming(1.8, { duration: 420, easing: Easing.out(Easing.quad) })
    );
    glowOpacity.value = withDelay(
      ANTICIPATION_MS,
      withSequence(
        withTiming(0.25, { duration: 160 }),
        withTiming(0, { duration: 260 })
      )
    );

    numberTranslateY.value = withDelay(
      ANTICIPATION_MS,
      withTiming(-NUMBER_LINE_HEIGHT, { duration: 380, easing: Easing.out(Easing.cubic) })
    );
    oldOpacity.value = withDelay(ANTICIPATION_MS + 40, withTiming(0, { duration: 260 }));
    newOpacity.value = withDelay(ANTICIPATION_MS + 60, withTiming(1, { duration: 320 }));

    numberScale.value = withDelay(
      ANTICIPATION_MS,
      withSequence(
        withTiming(1.08, { duration: 140 }),
        withTiming(1, { duration: 180 })
      )
    );

    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
    }
    finishTimer.current = setTimeout(() => {
      isAnimating.current = false;
      onFinish();
    }, TOTAL_MS);
  }, [
    glowOpacity,
    glowScale,
    numberScale,
    numberTranslateY,
    oldOpacity,
    newOpacity,
    overlayOpacity,
    fireScale,
    onFinish,
    visible,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const numberGroupStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numberScale.value }],
  }));

  const numberTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numberTranslateY.value }],
  }));

  const oldNumberStyle = useAnimatedStyle(() => ({
    opacity: oldOpacity.value,
  }));

  const newNumberStyle = useAnimatedStyle(() => ({
    opacity: newOpacity.value,
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <View style={styles.backdrop} />
      <View style={styles.content}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.Text style={[styles.emoji, fireStyle]}>🔥</Animated.Text>
        <Animated.View style={[styles.numberGroup, numberGroupStyle]}>
          <Animated.View style={numberTranslateStyle}>
            <Animated.Text style={[styles.numberText, oldNumberStyle]}>
              {fromValue}
            </Animated.Text>
            <Animated.Text style={[styles.numberText, newNumberStyle, styles.newNumber]}>
              {toValue}
            </Animated.Text>
          </Animated.View>
        </Animated.View>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  emoji: {
    fontSize: 56,
  },
  numberGroup: {
    height: NUMBER_LINE_HEIGHT,
    overflow: 'hidden',
    marginTop: 4,
  },
  numberText: {
    fontSize: NUMBER_FONT_SIZE,
    lineHeight: NUMBER_LINE_HEIGHT,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  newNumber: {
    marginTop: NUMBER_LINE_HEIGHT,
  },
  label: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
});
