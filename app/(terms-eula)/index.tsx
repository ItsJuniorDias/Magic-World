import { ScrollView, View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Text from "@/components/text";
import { Colors } from "@/constants/theme";

function Section({ title, content }: { title: string; content: string }) {
  return (
    <View style={styles.section}>
      <Text
        fontFamily="bold"
        fontSize={16}
        color={Colors.dark.text}
        title={title}
      />

      <View style={{ height: 6 }} />

      <Text
        fontFamily="regular"
        fontSize={14}
        color={Colors.dark.text}
        title={content}
      />
    </View>
  );
}

export default function EULAScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function acceptEULA() {
    await AsyncStorage.setItem("eulaAccepted", "true");

    router.back();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text
        fontFamily="bold"
        fontSize={28}
        color={Colors.dark.text}
        title="End User License Agreement (EULA)"
      />

      <View style={{ height: 8 }} />

      {/* Last update */}
      <Text
        fontFamily="regular"
        fontSize={14}
        color={Colors.dark.text}
        title="Last updated: January 2026"
      />

      <View style={{ height: 32 }} />

      <Section
        title="1. License Grant"
        content="Magic World grants you a limited, non-exclusive, non-transferable, and revocable license to use this application for personal and non-commercial purposes, in accordance with Apple’s App Store Terms of Service."
      />

      <Section
        title="2. Restrictions"
        content="You may not copy, modify, distribute, sell, reverse engineer, or misuse any part of the App, nor attempt to access restricted systems or features."
      />

      <Section
        title="3. Children’s Use"
        content="Magic World is intended for children with parental or guardian consent. Parents are responsible for supervising usage. The App contains no social interaction, advertising, or user-generated content."
      />

      <Section
        title="4. Subscriptions"
        content="Subscriptions are processed via Apple ID and renew automatically unless canceled at least 24 hours before the end of the current period."
      />

      <Section
        title="5. Intellectual Property"
        content="All stories, characters, illustrations, audio, and software are owned by Magic World or its licensors and are protected by law."
      />

      <Section
        title="6. Disclaimer"
        content="The App is provided “as is” without warranties of uninterrupted or error-free operation."
      />

      <Section
        title="7. Limitation of Liability"
        content="Magic World shall not be liable for indirect or consequential damages, loss of data, or issues caused by third-party services, including Apple."
      />

      <Section
        title="8. Termination"
        content="This agreement remains effective until terminated. Access may be suspended if these terms are violated."
      />

      <Section
        title="9. Third-Party Beneficiary"
        content="Apple and its subsidiaries are third-party beneficiaries of this EULA and may enforce its terms."
      />

      <Section
        title="10. Contact"
        content="Email: its_juniordias1997@icloud.com"
      />

      {/* Accept Button */}
      <TouchableOpacity style={styles.acceptButton} onPress={acceptEULA}>
        <Text
          fontFamily="bold"
          fontSize={16}
          color="#FFFFFF"
          title="I Agree & Continue"
        />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  section: {
    marginBottom: 20,
  },
  acceptButton: {
    marginTop: 24,
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
});
