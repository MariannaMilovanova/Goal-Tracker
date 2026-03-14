import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import LottieView from 'lottie-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getCelebrationMessage } from './celebrationPhrases';

type CelebrationOverlayProps = {
  visible: boolean;
  fromValue: number;
  toValue: number;
  onFinish?: () => void;
};

const LOTTIE_SOURCE = require('../../assets/lottie/goal-pop.json');
const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.appOwnership === 'guest';
const OVERLAY_FADE_IN_MS = 180;
const OVERLAY_HOLD_MS = 780;
const OVERLAY_FADE_OUT_MS = 320;
const CONTENT_DELAY_MS = 20;
const CONTENT_FADE_IN_MS = 220;
const NUMBER_SWAP_DELAY_MS = 40;
const OLD_NUMBER_SWAP_MS = 220;
const NEW_NUMBER_SWAP_MS = 260;
const MESSAGE_DELAY_MS = 320;
const MESSAGE_FADE_IN_MS = 220;
const FINISH_MS = OVERLAY_FADE_IN_MS + OVERLAY_HOLD_MS + OVERLAY_FADE_OUT_MS;
export function CelebrationOverlay({
  visible,
  fromValue,
  toValue,
  onFinish,
}: CelebrationOverlayProps) {
  const isAnimating = useRef(false);
  const isMounted = useRef(true);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessage = useRef<string | null>(null);
  const [message, setMessage] = useState<string>('Nice work.');
  const backdropOpacity = useSharedValue(0);
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
      backdropOpacity.value = 0;
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

    backdropOpacity.value = 0;
    contentOpacity.value = 0;
    contentScale.value = 0.92;
    fireScale.value = 0.9;
    numberScale.value = 0.9;
    oldOpacity.value = 1;
    newOpacity.value = 0;
    oldTranslateY.value = 0;
    newTranslateY.value = 14;
    messageOpacity.value = 0;
    messageTranslateY.value = 8;

    const nextMessage = getCelebrationMessage(toValue, lastMessage.current);
    lastMessage.current = nextMessage;
    setMessage(nextMessage);

    backdropOpacity.value = withSequence(
      withTiming(1, { duration: OVERLAY_FADE_IN_MS }),
      withDelay(OVERLAY_HOLD_MS, withTiming(0, { duration: OVERLAY_FADE_OUT_MS }))
    );
    contentOpacity.value = withDelay(CONTENT_DELAY_MS, withTiming(1, { duration: CONTENT_FADE_IN_MS }));
    contentScale.value = withDelay(CONTENT_DELAY_MS, withSpring(1, { damping: 14, stiffness: 180 }));
    fireScale.value = withDelay(
      60,
      withSequence(
        withTiming(1.1, { duration: 180 }),
        withTiming(1, { duration: 170 })
      )
    );
    numberScale.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 210 }));

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
    backdropOpacity,
    numberScale,
    messageOpacity,
    messageTranslateY,
    toValue,
    visible,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
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
    <View style={styles.overlay} pointerEvents="auto">
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <Animated.View style={[styles.content, contentStyle]}>
        {!isExpoGo ? (
          <LottieView
            key={`celebration-${fromValue}-${toValue}`}
            source={LOTTIE_SOURCE}
            style={styles.lottie}
            autoPlay
            loop={false}
          />
        ) : null}
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
    </View>
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
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 120,
    height: 120,
    marginBottom: -18,
  },
  emoji: {
    fontSize: 56,
    textShadowColor: '#FF8A00',
    textShadowRadius: 25,
  },
  numberWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
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
    color: '#111111',
  },
  text: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '600',
    color: '#555555',
    textAlign: 'center',
    maxWidth: 220,
  },
});
