import styled from "styled-components/native";
import { tokens } from "@/constants/tokens";

export const Container = styled.ScrollView`
  flex: 1;
  background-color: ${tokens.color.dark.bg};
  padding-top: ${tokens.spacing.xxxl}px;
`;

export const ModernCategoryCard = styled.TouchableOpacity`
  flex: 1;
  max-width: 48%;
  aspect-ratio: 0.72;
  background-color: ${tokens.color.dark.surface};
  border-radius: ${tokens.radius.xxl}px;
  margin-bottom: ${tokens.spacing.md}px;

  shadow-color: #000;
  shadow-offset: 0px 6px;
  shadow-opacity: 0.2;
  shadow-radius: 12px;
  elevation: 8;

  justify-content: center;
  align-items: center;
  padding: ${tokens.spacing.md}px;
`;
