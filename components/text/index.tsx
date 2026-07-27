/**
 * Compat shim — antigo `@/components/text` agora re-exporta o
 * componente do design system em `@/components/ui/Text`.
 *
 * Isso preserva os ~40 imports existentes sem migração forçada.
 * Migre pra `@/components/ui/Text` gradualmente conforme
 * mexer nas telas.
 */

export { default } from "@/components/ui/Text";
export * from "@/components/ui/Text";
