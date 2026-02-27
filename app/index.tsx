import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HomeScreen } from '../src/screens/HomeScreen';
import { OnboardingScreen } from '../src/screens/OnboardingScreen';
import { useGoalStore } from '../src/store/goalStore';

export default function IndexScreen() {
  const { goal, isLoading } = useGoalStore();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!goal) {
    return <OnboardingScreen />;
  }

  return <HomeScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
