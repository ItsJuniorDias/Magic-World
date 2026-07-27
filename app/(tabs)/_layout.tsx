
import { tokens } from "@/constants/tokens";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor="transparent"
      rippleColor={tokens.color.dark.bg}
      indicatorColor={tokens.color.dark.bg}
    >
      <NativeTabs.Trigger name="index">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>Home</Label>
        <Icon
          sf={"house.fill"}
          drawable="ic_menu_home"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorite">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>
          Favorite
        </Label>
        <Icon
          sf={"heart.fill"}
          drawable="ic_menu_preferences"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="games">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>Games</Label>
        <Icon
          sf={"gamecontroller.fill"}
          drawable="ic_menu_preferences"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>
          Profile
        </Label>
        <Icon
          sf={"person.fill"}
          drawable="ic_menu_preferences"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
