import { Stack } from 'expo-router';
import { AppI18nProvider } from '../src/i18n/I18nProvider';
import { GoalProvider } from '../src/store/goalStore';

export default function RootLayout() {
  return (
    <AppI18nProvider>
      <GoalProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </GoalProvider>
    </AppI18nProvider>
  );
}
