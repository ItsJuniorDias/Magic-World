import styled from 'styled-components/native';

export const Container = styled.ScrollView`
  flex: 1;
  background-color: #15141a;
  padding-top: 64px;
`;

export const ModernCategoryCard = styled.TouchableOpacity`
  flex: 1;
  max-width: 48%; /* para duas colunas com espaçamento */
  aspect-ratio: 0.72; /* mantém proporção aproximada de 214x295 */
  background-color: #222129;
  border-radius: 24px;
  margin-bottom: 16px;

  /* Sombra suave estilo Apple */
  shadow-color: #000;
  shadow-offset: 0px 6px;
  shadow-opacity: 0.2;
  shadow-radius: 12px;
  elevation: 8;

  justify-content: center;
  align-items: center;
  padding: 16px;
`;
