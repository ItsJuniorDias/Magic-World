import { LinearGradient } from "expo-linear-gradient";
import {
  TouchableOpacity,
  Animated,
  Easing,
  StyleProp,
  ImageStyle,
  View, // Adicionado
  StyleSheet,
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

import { useEffect, useRef, useState } from "react";

import { CardContainer, Gradient } from "./styles";
import Text from "../text";
import { Colors } from "@/constants/theme";

export type CardProps = {
  variant?: "default" | "category" | "recent";
  thumbnail?: string;
  title?: string;
  views?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
  thumbnailComponent?: React.ReactNode;
  imageStyle?: StyleProp<ImageStyle>;
  // ✅ Novas props para o Parallax
  index?: number;
  scrollX?: Animated.Value;
  isPro?: boolean;
};

export default function Card({
  variant = "default",
  thumbnail,
  title,
  views,
  isFavorite = false,
  onToggleFavorite,
  onPress,
  thumbnailComponent,
  imageStyle,
  index = 0,
  scrollX,
  isPro,
}: CardProps) {
  const [localFavorite, setLocalFavorite] = useState(isFavorite);

  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeTranslate = useRef(new Animated.Value(-6)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setLocalFavorite(isFavorite);
  }, [isFavorite]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(badgeTranslate, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeScale, {
          toValue: 1.05,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(badgeScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    scaleAnim.setValue(1);

    if (localFavorite) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.4,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [localFavorite]);

  /* =========================
     LÓGICA DE PARALLAX
  ========================== */
  // Largura aproximada do card baseada no seu estilo (ajuste se necessário)
  const CARD_WIDTH = variant === "category" ? 140 : 280;

  const translateX = scrollX
    ? scrollX.interpolate({
        inputRange: [
          (index - 1) * CARD_WIDTH,
          index * CARD_WIDTH,
          (index + 1) * CARD_WIDTH,
        ],
        outputRange: [-30, 0, 30], // Intensidade do movimento
        extrapolate: "clamp",
      })
    : 0;

  return (
    <CardContainer onPress={onPress} activeOpacity={0.85} variant={variant}>
      {/* BADGE PRO - DARK GLASS STYLE */}
      {isPro && variant !== "category" && (
        <Animated.View
          style={[
            styles.badgeOpacity,
            {
              opacity: badgeOpacity,
              transform: [
                { translateY: badgeTranslate },
                { scale: badgeScale },
              ],
            },
          ]}
        >
          <FontAwesome6 name="crown" size={10} color="#fff" />
          <Text
            title="PREMIUM"
            fontFamily="bold"
            fontSize={12}
            color="#fff"
            style={{ marginLeft: 4 }}
          />
        </Animated.View>
      )}

      {/* THUMBNAIL CONTAINER COM OVERFLOW HIDDEN */}
      <View style={{ flex: 1, overflow: "hidden", borderRadius: 16 }}>
        {thumbnailComponent ?? (
          <Animated.Image
            source={{ uri: thumbnail }}
            style={[
              {
                width: "140%", // Maior que o card para permitir o movimento
                height: "100%",
                borderRadius: 16,
                transform: [{ translateX }], // Aplica o Parallax
              },
              imageStyle,
            ]}
            resizeMode="cover"
          />
        )}
      </View>

      {/* FAVORITE BUTTON */}
      {onToggleFavorite && variant !== "category" && (
        <TouchableOpacity
          onPressIn={() => {
            setLocalFavorite((prev) => !prev);
            onToggleFavorite?.();
          }}
          activeOpacity={0.7}
          hitSlop={10}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
          }}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <FontAwesome6
              name="heart"
              size={24}
              solid={localFavorite}
              color={localFavorite ? Colors.light.red : "#fff"}
            />
          </Animated.View>
        </TouchableOpacity>
      )}

      <Gradient
        colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
        variant={variant}
      >
        {title && (
          <Text
            fontFamily="bold"
            fontSize={18}
            color="#fff"
            title={title}
            style={{ textAlign: variant === "category" ? "center" : "left" }}
          />
        )}

        {views !== undefined && variant !== "category" && (
          <Text
            fontFamily="regular"
            fontSize={14}
            color="#fff"
            title={`${views} Views`}
          />
        )}
      </Gradient>
    </CardContainer>
  );
}

const styles = StyleSheet.create({
  badgeOpacity: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 15,
    flexDirection: "row",
    alignItems: "center",
    // Fundo preto translúcido (efeito fumê)
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    // Borda fina para dar profundidade ao "vidro"
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    // Sombra suave para destacar do fundo
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
