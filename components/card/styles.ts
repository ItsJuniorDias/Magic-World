import styled from "styled-components/native";

import Image from "expo-image";

import { LinearGradient } from "expo-linear-gradient";

export const CardContainer = styled.TouchableOpacity`
  height: 295px;
  width: 214px;
  background-color: #222129;
  margin-bottom: 16px;
  border-radius: 24px;
  margin-top: 8px;
  margin-right: 24px;

`;

export const ImageCard = styled.Image`
  width: 214px;
  height: 295px;
  border-radius: 24px;
`;

export const Gradient = styled(LinearGradient)`
  width: 100%;
  
  position: absolute;
  bottom: 0;
  padding-top: 8px;
  padding-right: 16px;  
  padding-left: 16px;
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
  padding-bottom: 16px;
`;