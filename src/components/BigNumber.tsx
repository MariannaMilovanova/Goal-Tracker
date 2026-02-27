import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedNumber } from './AnimatedNumber';

type BigNumberProps = {
  value: number;
  label?: string;
};

export function BigNumber({ value, label }: BigNumberProps) {
  return (
    <View style={styles.container}>
      <AnimatedNumber value={value} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
