import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type DurationPickerProps = {
  presets: number[];
  selected: number | null;
  customValue: string;
  onSelect: (value: number) => void;
  onCustomChange: (value: string) => void;
};

export function DurationPicker({
  presets,
  selected,
  customValue,
  onSelect,
  onCustomChange,
}: DurationPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choose duration</Text>
      <View style={styles.pills}>
        {presets.map((value) => {
          const isSelected = selected === value;
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              style={[styles.pill, isSelected && styles.pillSelected]}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {value} days
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        placeholder="Custom days"
        value={customValue}
        onChangeText={onCustomChange}
        keyboardType="number-pad"
        style={styles.input}
        accessibilityLabel="Custom duration in days"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pills: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: 1,
    borderColor: '#C7C7C7',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillSelected: {
    borderColor: '#111',
    backgroundColor: '#111',
  },
  pillText: {
    color: '#111',
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#C7C7C7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
});
