import { Redirect } from "expo-router";

/**
 * app/+not-found.tsx
 * ==================================================================
 * Fallback silencioso pra deep links / paths desconhecidos.
 *
 * Convenção do expo-router: qualquer path que não bata em nenhuma
 * rota declarada em `app/` cai neste componente. Sem ele, o router
 * mostra a tela default de "não encontrado" (útil em dev, mas em
 * produção fica esquisito — vira "tela cinza" pro usuário final).
 *
 * Escolha: redirecionar pra `(tabs)` em vez de mostrar UI de erro.
 * Racional:
 *   1. Deep link ruim vindo de push notification / e-mail /
 *      campanha é problema NOSSO, não do usuário — não faz sentido
 *      punir ele com "página não encontrada".
 *   2. Cair na home preserva a sessão do app (i18n, sub status,
 *      progresso do Spell Storm) e permite ao usuário continuar
 *      usando o app normalmente.
 *   3. Se acontecer em produção, aparece nos analytics como
 *      "usuário aberto por deep link mas acabou na home" — sinal
 *      claro pra gente auditar quais URLs estamos divulgando.
 *
 * Quando trocar isso por uma tela de erro real: se alguma vez
 * quisermos tratamento diferente pra deep links "quase certos"
 * (ex.: `magicworld://storie/<id>` com id inválido). Aí faz
 * sentido mostrar mensagem específica ao invés de silenciar.
 */
export default function NotFound() {
  return <Redirect href="/(tabs)" />;
}
