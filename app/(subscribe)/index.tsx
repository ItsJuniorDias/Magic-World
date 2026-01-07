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

export default function SubscribeScreen() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Novo estado para controlar a seleção
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
          // Seleciona o primeiro por padrão (opcional)
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

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setLoading(true);
      const purchase = await Purchases.purchasePackage(selectedPackage);
      if (purchase.customerInfo.entitlements.active["Magic World Pro"]) {
        Alert.alert("Success", "Subscription activated!");
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
        // Aplica a borda roxa se estiver selecionado
        style={[styles.card, isSelected && styles.selectedCard]}
        onPress={() => setSelectedPackage(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text
            title={item.product.title}
            fontFamily="bold"
            fontSize={22}
            color={Colors.light.text}
          />

          {/* Indicador visual de seleção (opcional) */}
          {/* <View style={[styles.radio, isSelected && styles.radioSelected]} /> */}
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

        <Text
          fontFamily="bold"
          fontSize={20}
          color={isSelected ? "#5C81F5" : Colors.light.text}
          style={{ marginTop: 12 }}
          title={item.product.priceString}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      <SubscribeContainer contentContainerStyle={{ marginHorizontal: 24 }}>
        <Text
          title="Choose Your Plan"
          fontFamily="bold"
          fontSize={28}
          color="#ffffff"
          style={{ marginBottom: 10 }}
        />
        <Text
          title="Get unlimited access to all chapters and exclusive stories."
          fontFamily="regular"
          fontSize={16}
          color="#cccccc"
          style={{ marginBottom: 20 }}
        />

        {loading && packages.length === 0 ? (
          <ActivityIndicator size="large" color="#5C81F5" />
        ) : (
          <FlatList
            data={packages}
            renderItem={renderPackage}
            keyExtractor={(item) => item.identifier}
            contentContainerStyle={{ gap: 16, paddingBottom: 120 }} // Espaço para o footer
          />
        )}
      </SubscribeContainer>

      {/* Footer Fixo com Botão */}
      {!loading && packages.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handlePurchase}
          >
            <Text
              title="Subscribe Now"
              fontFamily="bold"
              fontSize={18}
              color="#fff"
            />
          </TouchableOpacity>
          <Text
            title="Cancel anytime in your app store settings."
            fontFamily="regular"
            fontSize={12}
            color="#999"
            style={{ marginTop: 8, textAlign: "center" }}
          />
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
    borderWidth: 4,
    borderColor: "transparent", // Borda invisível quando não selecionado
  },
  selectedCard: {
    borderColor: "#5C81F5", // Tom de roxo solicitado
    backgroundColor: "#F8F9FF", // Leve destaque no fundo
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  radio: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#DDD",
  },
  radioSelected: {
    borderColor: "#5C81F5",
    backgroundColor: "#5C81F5",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.background,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  subscribeButton: {
    backgroundColor: "#5C81F5",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
});
