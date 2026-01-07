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
  background-color: #222129;
  margin-bottom: 16px;

  /* Sombra */
  shadow-color: #000;
  shadow-offset: 0px 6px;
  shadow-opacity: 0.2;
  shadow-radius: 12px;
  elevation: 8;
`;

export const ImageCard = styled.ImageBackground`
  flex: 1;
  width: 100%;
 
  /* justify-content: flex-end; */
`;

export const Gradient = styled(LinearGradient)`
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 12px;
  border-bottom-left-radius: ${(props) => (props.variant === "category" ? "100px" : "24px")};
  border-bottom-right-radius: ${(props) => (props.variant === "category" ? "100px" : "24px")};
`;
