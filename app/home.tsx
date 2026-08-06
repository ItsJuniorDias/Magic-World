import { Redirect } from "expo-router";

/**
 * app/home.tsx
 * ==================================================================
 * Alias de rota pro deep link `magicworld://home`.
 *
 * Contexto: a tela home real vive em `app/(tabs)/index.tsx`. No
 * expo-router, grupos entre parênteses (`(tabs)`) não fazem parte
 * do path público — a home é servida em `/`, não em `/home`. Isso
 * significa que um deep link `magicworld://home` chega ao router
 * como path `/home` e cai em "não encontrado" (tela em branco em
 * produção, já que não temos `+not-found.tsx`).
 *
 * Esse arquivo intercepta o path `/home` e redireciona pro grupo
 * de tabs, mantendo o deep link estável pra tudo que já foi
 * divulgado externamente:
 *
 *   - Push notifications (payload `data.screen = "home"` também
 *     resolve pra cá via `useNotifications.ts`, mas por caminho
 *     interno; o deep link URL depende deste alias).
 *   - In-app events do App Store Connect que apontem pra tela
 *     inicial via custom URL.
 *   - Links de campanha, e-mails, mensagens compartilhadas.
 *
 * `<Redirect />` faz `router.replace` no primeiro render, então
 * o usuário nunca vê essa "tela" — pula direto pras tabs.
 *
 * Se um dia adicionarmos uma tela home "de boas-vindas" fora do
 * grupo de tabs (ex.: onboarding), este arquivo vira o lugar
 * natural pra colocar essa lógica.
 */
export default function HomeAlias() {
  return <Redirect href="/(tabs)" />;
}
