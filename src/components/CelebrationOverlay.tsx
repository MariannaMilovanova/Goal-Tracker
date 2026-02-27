import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type CelebrationOverlayProps = {
  visible: boolean;
};

export function CelebrationOverlay({ visible }: CelebrationOverlayProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (!visible) {
      return;
    }
    opacity.value = 0;
    scale.value = 0.9;
    opacity.value = withDelay(50, withTiming(1, { duration: 180 }));
    scale.value = withDelay(50, withTiming(1, { duration: 220 }));
    opacity.value = withDelay(900, withTiming(0, { duration: 200 }));
  }, [opacity, scale, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, animatedStyle]} pointerEvents="none">
      <Text style={styles.emoji}>🔥</Text>
      <Text style={styles.text}>Nice!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  emoji: {
    fontSize: 56,
  },
  text: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
});
