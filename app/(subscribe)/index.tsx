import Text from "@/components/text";
import { SubscribeContainer } from "./styles";
import {
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  View,
} from "react-native";
import { Colors } from "@/constants/theme";
import { useEffect, useState } from "react";
import Purchases from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage"; // 1. Importar
import { useRouter } from "expo-router";

export default function SubscribeScreen() {
  const router = useRouter();

  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  // 2. Função para salvar o status
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
      setLoading(true);
      const purchase = await Purchases.purchasePackage(selectedPackage);

      // Verificando se a assinatura está ativa
      if (purchase.customerInfo.entitlements.active["Magic World Pro"]) {
        await saveProStatus(true); // 3. Salvar no storage
        Alert.alert("Success", "Subscription activated!");
        // Aqui você pode redirecionar o usuário: navigation.goBack();

        router.back();
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert("Error", "An error occurred during purchase.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderPackage = ({ item }: { item: any }) => {
    const isSelected = selectedPackage?.identifier === item.identifier;
    const isMonthly = item.packageType === "MONTHLY";

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.selectedCard]}
        onPress={() => setSelectedPackage(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text
            title={item.packageType === "MONTHLY" ? "Monthly" : "Annual"}
            fontFamily="bold"
            fontSize={22}
            color={Colors.light.text}
          />
        </View>

        <Text
          fontFamily="regular"
          fontSize={15}
          color={Colors.light.text}
          style={{ marginTop: 8 }}
          title={
            isMonthly
              ? "• Unlock all story chapters\n• Ad-free experience\n• Billed monthly"
              : "• Everything in Monthly\n• Best value for long stories\n• Billed annually"
          }
        />

        <View style={styles.priceRow}>
          <Text
            fontFamily="bold"
            fontSize={20}
            color={isSelected ? "#5C81F5" : Colors.light.text}
            title={item.product.priceString}
          />
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Text
                title="Selected"
                fontSize={12}
                color="#fff"
                fontFamily="bold"
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <SubscribeContainer
        contentContainerStyle={{ marginHorizontal: 24, paddingTop: 40 }}
      >
        <Text
          title="Magic World Pro"
          fontFamily="bold"
          fontSize={32}
          color="#ffffff"
          style={{ marginBottom: 8 }}
        />
        <Text
          title="Unlock all chapters and exclusive content."
          fontFamily="regular"
          fontSize={16}
          color="#8E8E93"
          style={{ marginBottom: 24 }}
        />

        {loading && packages.length === 0 ? (
          <ActivityIndicator size="large" color="#5C81F5" />
        ) : (
          <FlatList
            data={packages}
            renderItem={renderPackage}
            keyExtractor={(item) => item.identifier}
            contentContainerStyle={{ gap: 16, paddingBottom: 150 }}
          />
        )}
      </SubscribeContainer>

      {!loading && packages.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handlePurchase}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                title="Subscribe Now"
                fontFamily="bold"
                fontSize={18}
                color="#fff"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 12 }}
          >
            <Text
              title="Maybe Later"
              fontSize={14}
              color="#8E8E93"
              style={{ textAlign: "center" }}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 3,
    borderColor: "transparent",
  },
  selectedCard: {
    borderColor: "#5C81F5",
    backgroundColor: "#F8F9FF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  selectedBadge: {
    backgroundColor: "#5C81F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1C1C1E", // Darker footer
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  subscribeButton: {
    backgroundColor: "#5C81F5",
    borderRadius: 16,
    height: 58,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#5C81F5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
