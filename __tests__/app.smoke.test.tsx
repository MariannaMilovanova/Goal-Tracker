import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

describe('smoke', () => {
  it('renders a basic view', () => {
    const { getByText } = render(
      <View>
        <Text>Smoke Test</Text>
      </View>,
    );

    expect(getByText('Smoke Test')).toBeTruthy();
  });
});
