import { Stack } from "expo-router";
import React from "react";

/**
 * Spell Storm stack layout — the arena chrome, no orientation lock.
 *
 * WHY NO orientation PROP ANYMORE
 *
 * The arcade game is authored horizontal: the mage runs sideways, the arena
 * is wider than it is tall, and playing it in portrait crops the world in
 * half. The obvious move is to hand native-stack `orientation: "landscape"`
 * and let iOS rotate on push — one line, no new dependency, no manual
 * unlock on unmount.
 *
 * That one line was the source of the black-screen-on-first-entry bug.
 * The sequence is worth writing down because it took a while to find:
 *
 *   1. Route pushes with `orientation: "landscape"`.
 *   2. iOS begins the ~300–500ms rotation animation.
 *   3. In parallel, the JS side races through progress-load in ~50ms.
 *   4. GLView mounts and `onContextCreate` fires WHILE THE DEVICE IS
 *      STILL ROTATING. `gl.drawingBufferWidth/Height` at that instant
 *      are still portrait.
 *   5. expo-gl fixes the backing framebuffer at THAT size and doesn't
 *      resize it after — even if the container grows landscape.
 *   6. Rotation finishes, container is landscape, the scene renders into
 *      a portrait-shaped viewport in the corner of a landscape surface,
 *      the rest keeps the clear colour, and the player sees "black".
 *
 * Second entry worked because CoreAnimation was warm — the rotation
 * completed before progress-load did, so onContextCreate captured
 * landscape dimensions.
 *
 * The fix lives in `index.tsx`: the <GLView /> is not mounted until
 * `onLayout` has confirmed a landscape container. In portrait the screen
 * shows a "rotate your phone" overlay. No forced rotation, no race, no
 * black screen — and no orientation prop here.
 *
 * If a landscape lock is ever wanted again, use
 * `expo-screen-orientation` from a useEffect inside the screen so the
 * lock can be sequenced AGAINST the GL bring-up rather than raced
 * against it by the framework.
 */
export default function SpellStormLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
