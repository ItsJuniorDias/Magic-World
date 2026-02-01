import { requireNativeView } from 'expo';
import * as React from 'react';

import { UnityViewProps } from './Unity.types';

const NativeView: React.ComponentType<UnityViewProps> =
  requireNativeView('Unity');

export default function UnityView(props: UnityViewProps) {
  return <NativeView {...props} />;
}
