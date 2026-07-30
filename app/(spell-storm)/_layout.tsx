import { Stack } from "expo-router";
import React from "react";

/**
 * Lock the Spell Storm route to landscape.
 *
 * WHY THIS FILE EXISTS
 *
 * The rest of Magic World is a kids-book app that reads best in portrait —
 * the storybook pages are authored tall and the App Store screenshots are
 * portrait. The arcade game is the exception: the mage runs sideways, the
 * arena is wider than it is tall, and playing it in portrait crops the
 * world in half. A per-screen orientation lock lets the game go landscape
 * without dragging the rest of the app with it.
 *
 * WHY NO NEW DEPENDENCY
 *
 * `expo-router` uses `@react-navigation/native-stack` under the hood, and
 * native-stack exposes `orientation` as a first-class screen option that
 * lands directly on the underlying `UIViewController` / Android activity
 * config. No `expo-screen-orientation` import, no useEffect that races the
 * navigation animation, no manual unlock on unmount — the framework does
 * the whole thing.
 *
 * Values worth knowing:
 *
 *   "landscape"        either landscape orientation, whichever the device is in
 *   "landscape_left"   pins home button / notch to the left specifically
 *   "landscape_right"  pins home button / notch to the right specifically
 *
 * Plain "landscape" is what the player wants: rotate the phone to match
 * their grip. Pinning one side would fight left-handers.
 */
export default function SpellStormLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        orientation: "landscape",
        // Statusbar and gesture chrome fight the game's own overlays.
        // Hide them here rather than doing it from inside the screen, so
        // the layout is the single source of truth for what the frame
        // around this route looks like.
        animation: "fade",
        gestureEnabled: false,
        contentStyle: { backgroundColor: "#05030A" },
      }}
    />
  );
}
