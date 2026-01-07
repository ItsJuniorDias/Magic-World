import { LinearGradient } from "expo-linear-gradient";

import { CardContainer, ImageCard, Gradient } from "./styles";
import Text from "../text";
import { Colors } from "@/constants/theme";

export type CardProps = {
  variant?: "default" | "category" | "recent";
  thumbnail?: string;
  title?: string;
  views?: number;
  onPress?: () => void;
};

export default function Card({
  variant = "default",
  thumbnail,
  title,
  views,
  onPress,
}: CardProps) {
  return (
    <CardContainer onPress={onPress} activeOpacity={0.7} variant={variant}>
      <ImageCard source={{ uri: thumbnail }} />

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
