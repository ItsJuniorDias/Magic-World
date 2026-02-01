import * as React from 'react';

import { UnityViewProps } from './Unity.types';

export default function UnityView(props: UnityViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
