import { LinearGradient } from "expo-linear-gradient";
import { Dimensions } from "react-native";
import styled from "styled-components/native";
import { tokens } from "@/constants/tokens";

const { width, height } = Dimensions.get("window");

export const Container = styled.View`
  flex: 1;
  background-color: ${tokens.color.dark.bg};
`;

export const HeaderImage = styled.ImageBackground`
  width: ${width}px;
  height: ${height}px;
`;

export const Gradient = styled(LinearGradient)`
  position: absolute;
  bottom: 0;
  width: ${width}px;
  height: ${height * 0.3}px;
`;

export const GradientImage = styled(LinearGradient)`
  width: ${width}px;
  height: ${height * 0.5}px;
  position: absolute;
  top: 0;
  margin-bottom: ${tokens.spacing.xl}px;
`;

export const Content = styled.View`
  gap: ${tokens.spacing.sm}px;
  padding: 0px ${tokens.spacing.lg}px;
`;
