import React from 'react';
import { Platform } from 'react-native';

type CelebrationOverlayProps = {
  visible: boolean;
  fromValue: number;
  toValue: number;
  onFinish?: () => void;
};

const CelebrationOverlayImpl =
  Platform.OS === 'web'
    ? require('./CelebrationOverlay.web').CelebrationOverlay
    : require('./CelebrationOverlay.native').CelebrationOverlay;

export function CelebrationOverlay(props: CelebrationOverlayProps) {
  return <CelebrationOverlayImpl {...props} />;
}
