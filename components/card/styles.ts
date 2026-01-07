import styled from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";

type CardContainerProps = {
  variant?: "default" | "category" | "recent";
};

export const CardContainer = styled.TouchableOpacity<CardContainerProps>`
  width: ${(props) => (props.variant === "category" ? "144px" : "214px")};
  height: ${(props) => (props.variant === "category" ? "144px" : "295px")};
  border-radius: ${(props) => (props.variant === "category" ? "100px" : "24px")};
  overflow: hidden;
  margin-bottom: 16px;
  margin-right: 16px;
`;

export const ImageCard = styled.ImageBackground`
  flex: 1;
  width: 100%;
`;

export const Gradient = styled(LinearGradient)`
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 12px;
  border-bottom-left-radius: ${(props) => (props.variant === "category" ? "100px" : "24px")};
  border-bottom-right-radius: ${(props) => (props.variant === "category" ? "100px" : "24px")};
`;
