import { LinearGradient } from "expo-linear-gradient";
import styled from "styled-components/native";

// Container da tela
export const Container = styled.ScrollView`
  flex: 1;
  background-color: #15141a;
  padding-top: 64px;
`;

// Card moderno estilo Apple
export const ModernCategoryCard = styled.TouchableOpacity`
  flex: 1;
  max-width: 48%;      /* duas colunas responsivas */
  aspect-ratio: 0.72;  /* mantém proporção do card */
  border-radius: 24px;
  margin-bottom: 16px;
  overflow: hidden;     /* importante para bordas arredondadas da imagem */

  /* sombra suave */
  shadow-color: #000;
  shadow-offset: 0px 6px;
  shadow-opacity: 0.2;
  shadow-radius: 12px;
  elevation: 8;

  background-color: #222129;
  justify-content: flex-end; /* conteúdo vai ficar na parte de baixo */
`;

// Imagem de fundo do card
export const ImageCard = styled.ImageBackground`
  flex: 1;
  width: 100%;
  justify-content: flex-end;
`;

// Overlay do texto sobre a imagem (semelhante a Glass effect)
export const Gradient = styled(LinearGradient)`
  height: 64px;
  padding-left: 16px;
  padding-right: 16px;
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
`;
