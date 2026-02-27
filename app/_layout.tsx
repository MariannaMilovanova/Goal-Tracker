import { Stack } from 'expo-router';
import { GoalProvider } from '../src/store/goalStore';

export default function RootLayout() {
  return (
    <GoalProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GoalProvider>
  );
}
