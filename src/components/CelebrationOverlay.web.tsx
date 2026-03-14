import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type CelebrationOverlayProps = {
  visible: boolean;
  fromValue: number;
  toValue: number;
  onFinish?: () => void;
};

const OVERLAY_FADE_IN_MS = 360;
const OVERLAY_HOLD_MS = 1960;
const OVERLAY_FADE_OUT_MS = 520;
const CONTENT_DELAY_MS = 120;
const CONTENT_FADE_IN_MS = 440;
const NUMBER_SWAP_DELAY_MS = 320;
const OLD_NUMBER_SWAP_MS = 920;
const NEW_NUMBER_SWAP_MS = 1080;
const MESSAGE_DELAY_MS = 260;
const MESSAGE_FADE_IN_MS = 320;
const FINISH_MS = OVERLAY_FADE_IN_MS + OVERLAY_HOLD_MS + OVERLAY_FADE_OUT_MS;
const AFFIRMATIONS = [
  'Nice work.',
  'Another step forward.',
  'You stayed focused today.',
  'That is real progress.',
  'You showed up again.',
] as const;

export function CelebrationOverlay({
  visible,
  fromValue,
  toValue,
  onFinish,
}: CelebrationOverlayProps) {
  const isAnimating = useRef(false);
  const isMounted = useRef(true);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageIndex = useRef<number | null>(null);
  const [message, setMessage] = useState(AFFIRMATIONS[0]);
  const overlayOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.92);
  const fireScale = useSharedValue(0.85);
  const numberScale = useSharedValue(0.9);
  const oldOpacity = useSharedValue(1);
  const newOpacity = useSharedValue(0);
  const oldTranslateY = useSharedValue(0);
  const newTranslateY = useSharedValue(14);
  const messageOpacity = useSharedValue(0);
  const messageTranslateY = useSharedValue(8);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (finishTimer.current) {
        clearTimeout(finishTimer.current);
        finishTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      isAnimating.current = false;
      overlayOpacity.value = 0;
      contentOpacity.value = 0;
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
    contentOpacity.value = 0;
    contentScale.value = 0.92;
    fireScale.value = 0.85;
    numberScale.value = 0.9;
    oldOpacity.value = 1;
    newOpacity.value = 0;
    oldTranslateY.value = 0;
    newTranslateY.value = 14;
    messageOpacity.value = 0;
    messageTranslateY.value = 8;

    let nextIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
    if (AFFIRMATIONS.length > 1 && nextIndex === lastMessageIndex.current) {
      nextIndex = (nextIndex + 1) % AFFIRMATIONS.length;
    }
    lastMessageIndex.current = nextIndex;
    setMessage(AFFIRMATIONS[nextIndex]);

    overlayOpacity.value = withSequence(
      withTiming(1, { duration: OVERLAY_FADE_IN_MS }),
      withDelay(OVERLAY_HOLD_MS, withTiming(0, { duration: OVERLAY_FADE_OUT_MS }))
    );
    contentOpacity.value = withDelay(CONTENT_DELAY_MS, withTiming(1, { duration: CONTENT_FADE_IN_MS }));
    contentScale.value = withDelay(CONTENT_DELAY_MS, withSpring(1, { damping: 14, stiffness: 180 }));
    fireScale.value = withDelay(160, withSpring(1, { damping: 12, stiffness: 200 }));
    numberScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 200 }));

    oldOpacity.value = withDelay(NUMBER_SWAP_DELAY_MS, withTiming(0, { duration: OLD_NUMBER_SWAP_MS }));
    oldTranslateY.value = withDelay(
      NUMBER_SWAP_DELAY_MS,
      withTiming(-14, { duration: OLD_NUMBER_SWAP_MS })
    );
    newOpacity.value = withDelay(NUMBER_SWAP_DELAY_MS, withTiming(1, { duration: NEW_NUMBER_SWAP_MS }));
    newTranslateY.value = withDelay(
      NUMBER_SWAP_DELAY_MS,
      withTiming(0, { duration: NEW_NUMBER_SWAP_MS })
    );
    messageOpacity.value = withDelay(
      MESSAGE_DELAY_MS,
      withTiming(1, { duration: MESSAGE_FADE_IN_MS })
    );
    messageTranslateY.value = withDelay(
      MESSAGE_DELAY_MS,
      withTiming(0, { duration: MESSAGE_FADE_IN_MS })
    );

    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
    }
    finishTimer.current = setTimeout(() => {
      if (!isMounted.current) {
        return;
      }
      isAnimating.current = false;
      onFinish?.();
    }, FINISH_MS);
  }, [
    contentOpacity,
    contentScale,
    fireScale,
    newOpacity,
    newTranslateY,
    oldOpacity,
    oldTranslateY,
    onFinish,
    overlayOpacity,
    numberScale,
    messageOpacity,
    messageTranslateY,
    visible,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  const numberPopStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numberScale.value }],
  }));

  const oldNumberStyle = useAnimatedStyle(() => ({
    opacity: oldOpacity.value,
    transform: [{ translateY: oldTranslateY.value }],
  }));

  const newNumberStyle = useAnimatedStyle(() => ({
    opacity: newOpacity.value,
    transform: [{ translateY: newTranslateY.value }],
  }));

  const messageStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
    transform: [{ translateY: messageTranslateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <View style={styles.backdrop} />
      <Animated.View style={[styles.content, contentStyle]}>
        <Animated.Text style={[styles.emoji, fireStyle]}>🔥</Animated.Text>
        <View style={styles.numberWrapper}>
          <View style={styles.shine} />
          <Animated.View style={[styles.numberStack, numberPopStyle]}>
            <Animated.Text style={[styles.numberText, oldNumberStyle]}>
              {fromValue}
            </Animated.Text>
            <Animated.Text style={[styles.numberText, newNumberStyle]}>
              {toValue}
            </Animated.Text>
          </Animated.View>
        </View>
        <Animated.Text style={[styles.text, messageStyle]}>{message}</Animated.Text>
      </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 56,
  },
  numberWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 8,
    width: 140,
    height: 90,
  },
  shine: {
    position: 'absolute',
    width: 140,
    height: 140,
    elevation: 6,
  },
  numberStack: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    position: 'absolute',
    fontSize: 44,
    fontWeight: '700',
    color: '#111',
  },
  text: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
    maxWidth: 220,
  },
});
