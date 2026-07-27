/**
 * withFmtConstevalFix.js
 * ============================================================
 * Patch pro erro de build do iOS com Xcode 26.4+ (Apple Clang 21):
 *
 *   ios/Pods/fmt/include/fmt/format-inl.h:59:24
 *   call to consteval function 'fmt::basic_format_string<...>'
 *   is not a constant expression
 *
 * Causa: fmt 11.0.2 (vendored via React Native / RCT-Folly)
 * usa `FMT_STRING(...)` de um jeito que Clang 21 recusa por
 * strict consteval. Fix upstream chegou em fmt 12.1.0, que só
 * entra em React Native ≥ 0.83.9 / Expo SDK 56.
 *
 * ABORDAGEM (v2 — source-level, mais robusta):
 * -------------------------------------------
 * A v1 deste plugin tentava mudar build_settings (`c++17` +
 * `FMT_USE_CONSTEVAL=0`) no target `fmt` via post_install.
 * Isso pode falhar por vários motivos: (a) CocoaPods sobrescreve
 * as build_settings depois; (b) o pod compila em contexto que
 * ignora essas flags; (c) meu regex pode não achar o post_install.
 *
 * A v2 edita DIRETAMENTE o arquivo fonte do fmt (`base.h`) no
 * post_install do Podfile, forçando `FMT_USE_CONSTEVAL 0`. Como
 * o patch é source-level e roda DEPOIS de o CocoaPods baixar o
 * pod, o compilador não tem como ignorar. Também aplica as
 * build_settings como cinto+suspensório.
 *
 * Zero impacto em produção: as format strings do fmt são todas
 * literais internas e sempre corretas — validação em runtime é
 * equivalente à de compile-time nesse caso.
 *
 * Referências:
 *   - facebook/react-native#55601
 *   - expo/expo#44229
 *   - fmtlib/fmt#4740
 *   - github.com/joaoalvess/expo-fmt-consteval-fix (mesmo approach)
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const PATCH_MARKER = "# BEGIN fmt-consteval-fix v2";
const PATCH_END = "# END fmt-consteval-fix v2";

// Snippet Ruby que:
//   1. Edita ios/Pods/fmt/include/fmt/base.h → FMT_USE_CONSTEVAL 0
//   2. Ajusta build_settings dos pods fmt e RCT-Folly (fallback)
const PATCH_SNIPPET = `
  ${PATCH_MARKER}
  # Fix pro erro de build fmt/consteval no Xcode 26.4+ (Apple Clang 21).
  # Ver facebook/react-native#55601. Remover ao subir pra Expo SDK 56+.
  fmt_base_h = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base_h)
    original = File.read(fmt_base_h)
    patched = original.gsub(/^\\s*#\\s*define\\s+FMT_USE_CONSTEVAL\\s+1\\s*$/, '# define FMT_USE_CONSTEVAL 0')
    if original != patched
      File.write(fmt_base_h, patched)
      Pod::UI.puts "[fmt-consteval-fix] Patched \#{fmt_base_h}"
    end
  end
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt' || target.name == 'RCT-Folly'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        unless config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'].include?('FMT_USE_CONSTEVAL=0')
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FMT_USE_CONSTEVAL=0'
        end
      end
    end
  end
  ${PATCH_END}
`;

const withFmtConstevalFix = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn(
          "[withFmtConstevalFix] Podfile não encontrado em " + podfilePath,
        );
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf8");

      // Remove versões antigas do patch (v1) se existirem, pra
      // permitir "upgrade" limpo do plugin sem edição manual.
      const OLD_MARKER_START = "# BEGIN fmt-consteval-fix";
      const OLD_MARKER_END = "# END fmt-consteval-fix";
      if (
        podfileContent.includes(OLD_MARKER_START) &&
        !podfileContent.includes(PATCH_MARKER)
      ) {
        const oldPatchRegex = new RegExp(
          `\\s*${escapeRegex(OLD_MARKER_START)}[\\s\\S]*?${escapeRegex(OLD_MARKER_END)}\\s*`,
          "g",
        );
        podfileContent = podfileContent.replace(oldPatchRegex, "\n");
      }

      // Idempotência: se v2 já foi aplicado, não faz nada.
      if (podfileContent.includes(PATCH_MARKER)) {
        fs.writeFileSync(podfilePath, podfileContent, "utf8");
        return config;
      }

      // Estratégia: procura o `post_install do |installer|` e
      // injeta o snippet logo APÓS a linha de abertura (não antes
      // do `end`). Isso garante que o patch rode mesmo se o corpo
      // do post_install tiver `return` ou outras condicionais.
      //
      // Se não achar post_install, cria um novo no final do arquivo.
      const openingRegex = /(post_install\s+do\s+\|installer\|\s*\n)/;
      const openingMatch = podfileContent.match(openingRegex);

      if (openingMatch) {
        // Injeta logo após a abertura
        podfileContent = podfileContent.replace(
          openingRegex,
          `$1${PATCH_SNIPPET}\n`,
        );
        console.log(
          "[withFmtConstevalFix] Snippet injetado no post_install existente",
        );
      } else {
        // Sem post_install — cria um novo no fim do arquivo
        podfileContent += `\n\npost_install do |installer|\n${PATCH_SNIPPET}\nend\n`;
        console.log(
          "[withFmtConstevalFix] post_install criado do zero (Podfile não tinha um)",
        );
      }

      fs.writeFileSync(podfilePath, podfileContent, "utf8");
      console.log("[withFmtConstevalFix] Podfile patcheado com sucesso ✓");

      return config;
    },
  ]);
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = withFmtConstevalFix;
