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
 * O que este plugin faz:
 *   1. Compila os pods `fmt` e `RCT-Folly` em C++17 (consteval
 *      não existe em C++17, então o caminho problemático é
 *      ignorado).
 *   2. Adiciona `FMT_USE_CONSTEVAL=0` no preprocessor pra
 *      forçar fmt a validar format strings em runtime.
 *
 * Zero impacto em produção: as format strings do fmt são todas
 * literais internas e sempre corretas — a validação em runtime
 * é equivalente à de compile-time nesse caso específico.
 *
 * Como remover: quando migrar pra Expo SDK 56+ / RN 0.83.9+,
 * tira este plugin do `app.config.js`. Se buildar sem erro,
 * pode deletar o arquivo.
 *
 * Referências:
 *   - facebook/react-native#55601
 *   - expo/expo#44229
 *   - fmtlib/fmt#4740
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const PATCH_MARKER = "# BEGIN fmt-consteval-fix";
const PATCH_END = "# END fmt-consteval-fix";

const PATCH_SNIPPET = `
    ${PATCH_MARKER}
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
        console.warn("[withFmtConstevalFix] Podfile não encontrado, pulando");
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, "utf8");

      // Idempotência: se já aplicou, não faz nada.
      if (podfileContent.includes(PATCH_MARKER)) {
        return config;
      }

      // Estratégia: injeta o snippet logo antes do `end` que
      // fecha o post_install block padrão do RN/Expo.
      //
      // O post_install do template é:
      //   post_install do |installer|
      //     react_native_post_install(installer, ...)
      //     ...
      //   end
      //
      // Procuramos o post_install e injetamos antes do `end`.
      const postInstallRegex =
        /post_install do \|installer\|([\s\S]*?)^\s*end\s*$/m;
      const match = podfileContent.match(postInstallRegex);

      if (!match) {
        // Sem post_install existente — adiciona um novo no fim.
        podfileContent += `\n\npost_install do |installer|${PATCH_SNIPPET}end\n`;
      } else {
        // Injeta o snippet no final do post_install existente,
        // antes do `end`.
        const fullMatch = match[0];
        const withoutClosingEnd = fullMatch.replace(/^(\s*)end\s*$/m, "");
        const patched = `${withoutClosingEnd}${PATCH_SNIPPET}end\n`;
        podfileContent = podfileContent.replace(fullMatch, patched);
      }

      fs.writeFileSync(podfilePath, podfileContent, "utf8");
      console.log("[withFmtConstevalFix] Podfile patcheado com sucesso");

      return config;
    },
  ]);
};

module.exports = withFmtConstevalFix;
