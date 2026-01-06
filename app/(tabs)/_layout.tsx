import React from "react";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <NativeTabs
      backgroundColor="transparent"
      rippleColor={Colors.light.background}
      indicatorColor={Colors.light.background}
    >
      <NativeTabs.Trigger name="index">
        <Label
          selectedStyle={{
            color: Colors.light.tint,
          }}
        >
          Home
        </Label>
        <Icon
          sf={"house.fill"}
          drawable="ic_menu_home"
          selectedColor={Colors.light.tint}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <Label
          selectedStyle={{
            color: Colors.light.tint,
          }}
        >
          Explore
        </Label>

        <Icon
          sf={"person.fill"}
          drawable="ic_menu_preferences"
          selectedColor={Colors.light.tint}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
