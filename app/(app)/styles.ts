import { Colors } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Dimensions } from "react-native";
import styled from "styled-components/native";

const { width, height } = Dimensions.get("window");

export const Container = styled.View`
  flex: 1;
  background-color: ${Colors.dark.background};
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
  margin-bottom: 32px;
`;

export const Content = styled.View`
  gap: 12px;
  padding: 0px 24px;
`;

export const Button = styled.TouchableOpacity`
  margin-top: 24px;
  background-color: #6c8cff;
  padding: 16px;
  border-radius: 14px;
  align-items: center;
`;
