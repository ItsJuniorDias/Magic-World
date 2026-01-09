import { LinearGradient } from "expo-linear-gradient";
import { TouchableOpacity, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

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
};

export default function Card({
  variant = "default",
  thumbnail,
  title,
  views,
  isFavorite = false,
  onToggleFavorite,
  onPress,
}: CardProps) {
  return (
    <CardContainer onPress={onPress} activeOpacity={0.85} variant={variant}>
      <ImageCard source={{ uri: thumbnail }} />

      {/* FAVORITE BUTTON */}
      {onToggleFavorite && variant !== "category" && (
        <TouchableOpacity
          onPress={onToggleFavorite}
          activeOpacity={0.7}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 10,
          }}
        >
          <FontAwesome6
            name={isFavorite ? "heart" : "heart"}
            solid={isFavorite}
            size={24}
            color={isFavorite ? Colors.light.red : "#fff"}
          />
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
            style={{
              textAlign: variant === "category" ? "center" : "left",
            }}
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
