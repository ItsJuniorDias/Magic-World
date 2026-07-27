import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Purchases from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { useThemedTokens } from "@/hooks/use-tokens";
import { SubscribeContainer } from "./styles";
import { logEvent } from "@/services/analyticsHelper";

export default function SubscribeScreen() {
  const router = useRouter();
  const t = useThemedTokens();

  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const offerings = await Purchases.getOfferings();

        if (offerings.current) {
          const availablePackages: any[] = [];

          if (offerings.current.monthly)
            availablePackages.push(offerings.current.monthly);
          if (offerings.current.annual)
            availablePackages.push(offerings.current.annual);

          setPackages(availablePackages);

          if (availablePackages.length > 0)
            setSelectedPackage(availablePackages[0]);
        }
      } catch (error) {
        Alert.alert("Erro", "Não foi possível carregar os planos.");
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);

  const saveProStatus = async (status: boolean) => {
    try {
      await AsyncStorage.setItem("@user_is_pro", JSON.stringify(status));
    } catch (e) {
      console.error("Erro ao salvar status Pro", e);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setPurchasing(true);

      await logEvent("purchase_started", {
        source: "subscribe_screen",
        plan: selectedPackage.packageType === "MONTHLY" ? "monthly" : "annual",
        package: selectedPackage.identifier,
      });

      const purchase = await Purchases.purchasePackage(selectedPackage);

      if (purchase.customerInfo.entitlements.active["Magic World Pro"]) {
        await logEvent("purchase_successful", {
          source: "subscribe_screen",
          plan:
            selectedPackage.packageType === "MONTHLY" ? "monthly" : "annual",
          package: selectedPackage.identifier,
        });

        await saveProStatus(true);
        Alert.alert("Success", "Subscription activated!");
        router.back();
      }
    } catch (error: any) {
      if (error.userCancelled) {
        await logEvent("purchase_cancelled", {
          source: "subscribe_screen",
          plan:
            selectedPackage?.packageType === "MONTHLY" ? "monthly" : "annual",
          package: selectedPackage?.identifier,
          reason: "apple_sheet_closed",
        });
      } else {
        Alert.alert("Error", "An error occurred during purchase.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const renderPackage = ({ item }: { item: any }) => {
    const isSelected = selectedPackage?.identifier === item.identifier;
    const isMonthly = item.packageType === "MONTHLY";

    return (
      <TouchableOpacity
        style={[
          {
            backgroundColor: t.color.surface,
            borderRadius: t.radius.xl,
            padding: t.spacing.lg,
            borderWidth: 2,
            borderColor: isSelected ? t.color.brand : "transparent",
          },
          isSelected && {
            backgroundColor: t.color.brandSubtle,
          },
        ]}
        onPress={() => setSelectedPackage(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Text
            variant="heading"
            size="xxl"
            color={t.color.textPrimary}
          >
            {isMonthly ? "Monthly" : "Annual"}
          </Text>
        </View>

        <Text
          variant="body"
          color={t.color.textPrimary}
          style={{ marginTop: t.spacing.xs }}
        >
          {isMonthly
            ? "• Unlock all story chapters\n• Ad-free experience\n• Billed monthly"
            : "• Everything in Monthly\n• Best value for long stories\n• Billed annually"}
        </Text>

        <View style={[styles.priceRow, { marginTop: t.spacing.sm }]}>
          <Text
            variant="heading"
            size="xl"
            color={isSelected ? t.color.brand : t.color.textPrimary}
          >
            {item.product.priceString}
          </Text>
          {isSelected && (
            <View
              style={{
                backgroundColor: t.color.brand,
                paddingHorizontal: t.spacing.xs + 2,
                paddingVertical: t.spacing.xxs,
                borderRadius: t.radius.sm,
              }}
            >
              <Text variant="label" color={t.color.textOnBrand}>
                Selected
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <SubscribeContainer
        contentContainerStyle={{
          marginHorizontal: t.spacing.lg,
          paddingTop: t.spacing.xxl,
        }}
      >
        <Text
          variant="display"
          color={t.color.textPrimary}
          style={{ marginBottom: t.spacing.xs }}
        >
          Magic World Pro
        </Text>
        <Text
          variant="body"
          color={t.color.textSecondary}
          style={{ marginBottom: t.spacing.lg }}
        >
          Unlock all chapters and exclusive content.
        </Text>

        {loading && packages.length === 0 ? (
          <ActivityIndicator size="large" color={t.color.brand} />
        ) : (
          <FlatList
            data={packages}
            renderItem={renderPackage}
            keyExtractor={(item) => item.identifier}
            contentContainerStyle={{
              gap: t.spacing.md,
              paddingBottom: 150,
            }}
          />
        )}
      </SubscribeContainer>

      {!loading && packages.length > 0 && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: t.color.surface,
            padding: t.spacing.lg,
            paddingBottom: t.spacing.xxl,
            borderTopLeftRadius: t.radius.xxl,
            borderTopRightRadius: t.radius.xxl,
          }}
        >
          <Button
            label="Subscribe Now"
            size="lg"
            fullWidth
            loading={purchasing}
            onPress={handlePurchase}
          />

          <TouchableOpacity
            onPress={async () => {
              await logEvent("purchase_cancelled", {
                source: "subscribe_screen",
                reason: "maybe_later",
              });
              router.back();
            }}
            style={{ marginTop: t.spacing.sm }}
          >
            <Text
              variant="caption"
              color={t.color.textSecondary}
              style={{ textAlign: "center" }}
            >
              Maybe Later
            </Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: t.spacing.md,
            }}
          >
            <TouchableOpacity onPress={() => router.push("/(privacy-policy)")}>
              <Text
                variant="caption"
                color={t.color.textSecondary}
                style={{ textDecorationLine: "underline" }}
              >
                Privacy Policy
              </Text>
            </TouchableOpacity>

            <Text
              variant="caption"
              color={t.color.textSecondary}
              style={{ marginHorizontal: t.spacing.xs - 2 }}
            >
              {" • "}
            </Text>

            <TouchableOpacity onPress={() => router.push("/(terms-eula)")}>
              <Text
                variant="caption"
                color={t.color.textSecondary}
                style={{ textDecorationLine: "underline" }}
              >
                Terms of Use (EULA)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
