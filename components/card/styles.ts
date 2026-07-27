import styled from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { tokens } from "@/constants/tokens";

type CardVariant = "default" | "category" | "recent";

type CardContainerProps = {
  variant?: CardVariant;
};

const CARD_DIMENSIONS: Record<
  CardVariant,
  { width: number; height: number; radius: number }
> = {
  default: { width: 214, height: 295, radius: tokens.radius.xxl },
  category: { width: 144, height: 144, radius: tokens.radius.circle },
  recent: { width: 214, height: 295, radius: tokens.radius.xxl },
};

export const CardContainer = styled.TouchableOpacity<CardContainerProps>`
  width: ${({ variant = "default" }) => CARD_DIMENSIONS[variant].width}px;
  height: ${({ variant = "default" }) => CARD_DIMENSIONS[variant].height}px;
  border-radius: ${({ variant = "default" }) => CARD_DIMENSIONS[variant].radius}px;
  overflow: hidden;
  margin-bottom: ${tokens.spacing.md}px;
  margin-right: ${tokens.spacing.md}px;
`;

export const ImageCard = styled(Image)`
  flex: 1;
  width: 100%;
`;

export const Gradient = styled(LinearGradient)<CardContainerProps>`
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: ${tokens.spacing.sm}px;
  border-bottom-left-radius: ${({ variant = "default" }) =>
    CARD_DIMENSIONS[variant].radius}px;
  border-bottom-right-radius: ${({ variant = "default" }) =>
    CARD_DIMENSIONS[variant].radius}px;
`;
