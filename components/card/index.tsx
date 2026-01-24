import { LinearGradient } from "expo-linear-gradient";
import {
  TouchableOpacity,
  Animated,
  StyleProp,
  ImageStyle,
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
  imageStyle?: StyleProp<ImageStyle>; // ✅ corrigido
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

  return (
    <CardContainer onPress={onPress} activeOpacity={0.85} variant={variant}>
      {/* THUMBNAIL */}
      {thumbnailComponent ?? (
        <Animated.Image
          source={{ uri: thumbnail }}
          style={[
            { width: "100%", height: "100%", borderRadius: 16 },
            imageStyle,
          ]}
          resizeMode="cover"
        />
      )}

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
        colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.9)"]}
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

        {views !== undefined && (
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
