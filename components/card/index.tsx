import { LinearGradient } from "expo-linear-gradient";
import {
  TouchableOpacity,
  Animated,
  StyleProp,
  ImageStyle,
  View, // Adicionado
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

import { useEffect, useRef, useState } from "react";

import { CardContainer, ImageCard, Gradient } from "./styles";
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
}: CardProps) {
  const [localFavorite, setLocalFavorite] = useState(isFavorite);

  useEffect(() => {
    setLocalFavorite(isFavorite);
  }, [isFavorite]);

  const scaleAnim = useRef(new Animated.Value(1)).current;

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
