#!/usr/bin/env bash
# ============================================================
# scripts/fix-fmt-consteval.sh
# ============================================================
# Patch manual pro erro de build fmt/consteval no Xcode 26.4+.
#
# Use isto quando:
#   - `bun run ios` ainda falha com erros em fmt/format-inl.h
#   - você acabou de rodar `pod install` e o patch do plugin
#     ainda não foi aplicado
#   - você não confia no config plugin e quer editar manual
#
# Este script NÃO substitui o plugin — se você rodar
# `pod install` de novo depois, precisa rodar isto de novo.
# O plugin (`plugin/withFmtConstevalFix.js`) faz isto
# automaticamente via post_install do Podfile.
# ============================================================

set -euo pipefail

FMT_BASE_H="ios/Pods/fmt/include/fmt/base.h"

if [ ! -f "$FMT_BASE_H" ]; then
  echo "❌ Não encontrei $FMT_BASE_H"
  echo "   Rode 'cd ios && pod install && cd ..' primeiro"
  exit 1
fi

echo "→ Patcheando $FMT_BASE_H"

# Backup de segurança
cp "$FMT_BASE_H" "${FMT_BASE_H}.bak"

# Perl é mais portável que sed pra este tipo de edit no macOS
perl -i -pe 's/^\s*#\s*define\s+FMT_USE_CONSTEVAL\s+1\s*$/# define FMT_USE_CONSTEVAL 0/' "$FMT_BASE_H"

# Confirma que patcheou
if grep -q "FMT_USE_CONSTEVAL 0" "$FMT_BASE_H"; then
  echo "✓ Patch aplicado com sucesso"
  echo "  (backup salvo em ${FMT_BASE_H}.bak)"
  echo ""
  echo "Agora roda: bun run ios --device"
else
  echo "⚠️  grep não encontrou 'FMT_USE_CONSTEVAL 0' no arquivo."
  echo "    Ou o fmt já foi patcheado ou algo deu errado."
  echo "    Restaurando backup..."
  mv "${FMT_BASE_H}.bak" "$FMT_BASE_H"
  exit 1
fi
