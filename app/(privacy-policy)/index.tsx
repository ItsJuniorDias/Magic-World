import { ScrollView, View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "@/components/text";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";

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

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();

  const router = useRouter();

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
        title={tr("legal.privacyPolicyTitle")}
      />

      <View style={{ height: 8 }} />

      {/* Last update */}
      <Text
        fontFamily="regular"
        fontSize={14}
        color={Colors.dark.text}
        title={tr("legal.lastUpdated")}
      />

      <View style={{ height: 32 }} />

      <Section
        title="1. Introduction"
        content="Magic World values your privacy and is committed to protecting personal information. This Privacy Policy explains how information is collected, used, and protected when using the Magic World application."
      />

      <Section
        title="2. Information We Collect"
        content="Magic World does not collect personal data from children. Limited technical information such as device type, app version, and anonymous usage data may be collected to improve performance and stability."
      />

      <Section
        title="3. Children’s Privacy"
        content="Magic World is designed for children and complies with applicable children’s privacy laws. The App does not allow user-generated content, messaging, or social interaction, and does not display advertising."
      />

      <Section
        title="4. Use of Information"
        content="Any collected information is used solely to operate, maintain, and improve the App experience. We do not sell, rent, or share personal data with third parties."
      />

      <Section
        title="5. Third-Party Services"
        content="Magic World may use trusted third-party services such as Apple for payments and analytics. These services operate under their own privacy policies."
      />

      <Section
        title="6. Data Security"
        content="We take reasonable measures to protect information against unauthorized access, loss, or misuse. However, no system can be completely secure."
      />

      <Section
        title="7. Data Retention"
        content="Information is retained only for as long as necessary to fulfill its purpose or comply with legal obligations."
      />

      <Section
        title="8. Changes to This Policy"
        content="This Privacy Policy may be updated from time to time. Continued use of the App indicates acceptance of the updated policy."
      />

      <Section
        title="9. Contact"
        content="If you have questions or concerns about this Privacy Policy, please contact us at: its_juniordias1997@icloud.com"
      />

      {/* Accept Button */}
      <TouchableOpacity
        style={styles.acceptButton}
        onPress={() => router.back()}
      >
        <Text
          fontFamily="bold"
          fontSize={16}
          color="#FFFFFF"
          title={tr("common.accept")}
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
