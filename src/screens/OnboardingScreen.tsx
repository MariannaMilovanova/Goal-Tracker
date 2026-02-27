import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DurationPicker } from '../components/DurationPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { useGoalStore } from '../store/goalStore';

const PRESET_DURATIONS = [7, 30, 100];

export function OnboardingScreen() {
  const { createGoal } = useGoalStore();
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(PRESET_DURATIONS[0]);
  const [customDays, setCustomDays] = useState('');

  const totalDays = useMemo(() => {
    const custom = Number(customDays);
    if (!Number.isNaN(custom) && custom > 0) {
      return custom;
    }
    return selectedDays ?? 0;
  }, [customDays, selectedDays]);

  const canSubmit = title.trim().length > 0 && totalDays > 0;

  const handleSelectPreset = (value: number) => {
    setSelectedDays(value);
    setCustomDays('');
  };

  const handleCustomChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCustomDays(sanitized);
    if (sanitized.length > 0) {
      setSelectedDays(null);
    } else if (selectedDays === null) {
      setSelectedDays(PRESET_DURATIONS[0]);
    }
  };

  const handleCreateGoal = async () => {
    if (!canSubmit) {
      return;
    }
    await createGoal({
      title: title.trim(),
      totalDays,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Set your one goal</Text>
            <Text style={styles.subtitle}>Pick a focus and commit to a number of days.</Text>

        <Text style={styles.label}>Goal title</Text>
        <TextInput
          placeholder="No sugar"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="sentences"
          returnKeyType="done"
          accessibilityLabel="Goal title"
        />

        <DurationPicker
          presets={PRESET_DURATIONS}
          selected={selectedDays}
          customValue={customDays}
          onSelect={handleSelectPreset}
          onCustomChange={handleCustomChange}
        />

            <View style={styles.footer}>
              <PrimaryButton label="Create goal" onPress={handleCreateGoal} disabled={!canSubmit} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#C7C7C7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  footer: {
    marginTop: 28,
  },
});
