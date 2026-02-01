import { requireNativeViewManager } from "expo-modules-core";
import * as React from "react";
import { ViewProps } from "react-native";

export type UnityViewProps = ViewProps;

// Busca o módulo registrado como "Unity"
const NativeView: React.ComponentType<UnityViewProps> =
  requireNativeViewManager("Unity");

export function UnityView(props: UnityViewProps) {
  return <NativeView {...props} />;
}
