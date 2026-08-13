import { Stack } from "expo-router";
import React from "react";

/**
 * Knight Quest stack layout — same pattern as Spell Storm.
 *
 * Portrait orientation, no header, no gestures. The game uses touch
 * controls that would fight the swipe-back gesture, and the HUD relies
 * on being flush with the safe area (no navigation header).
 *
 * Unlike Spell Storm, Knight Quest is authored PORTRAIT: the top-down
 * camera favours a taller-than-wide viewport, so there's no rotation
 * race and no landscape overlay.
 */
export default function KnightQuestLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        gestureEnabled: false,
        contentStyle: { backgroundColor: "#151024" },
      }}
    />
  );
}
