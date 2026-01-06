import styled from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/theme";

export const Container = styled.View`
  flex: 1;
  background-color: ${Colors.dark.background};
`;

export const Header = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  z-index: 10;
`;

export const HeaderImage = styled.Image`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 550px;
`;


export const ContainerStorie = styled.View`
  padding: 24px;
  z-index: 1;
  gap: 16
`;
