import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
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

type CelebrationOverlayProps = {
  visible: boolean;
  fromValue: number;
  toValue: number;
  onFinish?: () => void;
};

const LOTTIE_SOURCE = require('../../assets/lottie/goal-pop.json');
const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.appOwnership === 'guest';

export function CelebrationOverlay({
  visible,
  fromValue,
  toValue,
  onFinish,
}: CelebrationOverlayProps) {
  const isAnimating = useRef(false);
  const isMounted = useRef(true);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.92);
  const fireScale = useSharedValue(0.85);
  const numberScale = useSharedValue(0.9);
  const oldOpacity = useSharedValue(1);
  const newOpacity = useSharedValue(0);
  const oldTranslateY = useSharedValue(0);
  const newTranslateY = useSharedValue(14);

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

    overlayOpacity.value = withSequence(
      withTiming(1, { duration: 140 }),
      withDelay(840, withTiming(0, { duration: 220 }))
    );
    contentOpacity.value = withDelay(40, withTiming(1, { duration: 180 }));
    contentScale.value = withDelay(40, withSpring(1, { damping: 14, stiffness: 180 }));
    fireScale.value = withDelay(60, withSpring(1, { damping: 12, stiffness: 200 }));
    numberScale.value = withDelay(80, withSpring(1, { damping: 12, stiffness: 200 }));

    oldOpacity.value = withDelay(120, withTiming(0, { duration: 320 }));
    oldTranslateY.value = withDelay(120, withTiming(-14, { duration: 320 }));
    newOpacity.value = withDelay(120, withTiming(1, { duration: 360 }));
    newTranslateY.value = withDelay(120, withTiming(0, { duration: 360 }));

    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
    }
    finishTimer.current = setTimeout(() => {
      if (!isMounted.current) {
        return;
      }
      isAnimating.current = false;
      onFinish?.();
    }, 1100);
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

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <View style={styles.backdrop} />
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
        <Text style={styles.text}>Nice!</Text>
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
  lottie: {
    width: 120,
    height: 120,
    marginBottom: -18,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
});
