import { tokens } from "@/constants/tokens";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

import { useT } from "@/i18n";

export default function TabLayout() {
  const { t, locale } = useT();

  // NativeTabs renderiza componentes SwiftUI/Material nativos,
  // que só leem props no mount inicial. Quando o locale muda,
  // as labels em memória ficam desatualizadas. Passar `key={locale}`
  // força re-montagem do container inteiro sempre que a linguagem
  // mudar, refletindo os novos títulos.
  return (
    <NativeTabs
      key={locale}
      backgroundColor="transparent"
      rippleColor={tokens.color.dark.bg}
      indicatorColor={tokens.color.dark.bg}
    >
      <NativeTabs.Trigger name="index">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>
          {t("tabs.home")}
        </Label>
        <Icon
          sf={"house.fill"}
          drawable="ic_menu_home"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorite">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>
          {t("tabs.favorite")}
        </Label>
        <Icon
          sf={"heart.fill"}
          drawable="ic_menu_preferences"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="games">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>
          {t("tabs.games")}
        </Label>
        <Icon
          sf={"gamecontroller.fill"}
          drawable="ic_menu_preferences"
          selectedColor={tokens.color.dark.brand}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label selectedStyle={{ color: tokens.color.dark.brand }}>
          {t("tabs.profile")}
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
