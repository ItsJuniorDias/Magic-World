/**
 * ParentalGate — challenge de multiplicação pra gate ações de "commerce"
 * e links externos no app (Kids Category, Guideline 1.3).
 * ============================================================
 *
 * Uso na tela consumidora:
 *
 *   const gateRef = useRef<(() => void) | null>(null);
 *   const [gateOpen, setGateOpen] = useState(false);
 *
 *   const runBehindGate = (action: () => void) => {
 *     gateRef.current = action;
 *     setGateOpen(true);
 *   };
 *
 *   // No lugar de chamar `handlePurchase()`, `handleRestore()`, ou
 *   // `openLink(...)` direto:
 *   onPress={() => runBehindGate(handlePurchase)}
 *
 *   // E renderiza o gate no final da tela:
 *   <ParentalGate
 *     visible={gateOpen}
 *     onSuccess={() => {
 *       setGateOpen(false);
 *       const action = gateRef.current;
 *       gateRef.current = null;
 *       action?.();
 *     }}
 *     onCancel={() => {
 *       setGateOpen(false);
 *       gateRef.current = null;
 *     }}
 *   />
 *
 * Por que multiplicação de 4..9 e não "swipe pra desbloquear":
 *   - "Aperte e segure 3 segundos" ou "swipe" são reconhecidos pela
 *     Apple como gates fracos e frequentemente rejeitados. Cálculo
 *     de duas casas é o padrão de referência (Kidoodle, Sago Mini,
 *     KIDOZ), aceito consistentemente pelo App Review.
 *   - Faixa 4..9 evita 0/1 (multiplicação trivial) e evita 2/3
 *     (fáceis de acertar no chute). Também evita 10+ (crianças
 *     mais velhas já resolvem por memorização).
 *
 * O problema regenera a cada erro pra que múltiplos chutes não
 * levem à resposta certa por eliminação.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { useThemedTokens } from "@/hooks/use-tokens";
import { useT } from "@/i18n";

type Problem = { a: number; b: number; answer: number };

function newProblem(): Problem {
  // 4..9 inclusive
  const a = 4 + Math.floor(Math.random() * 6);
  const b = 4 + Math.floor(Math.random() * 6);
  return { a, b, answer: a * b };
}

type ParentalGateProps = {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function ParentalGate({
  visible,
  onSuccess,
  onCancel,
}: ParentalGateProps) {
  const t = useThemedTokens();
  const { t: tr } = useT();

  const [problem, setProblem] = useState<Problem>(() => newProblem());
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Regenera problema toda vez que o modal reabre. Evita que um
  // usuário memorize a conta de uma tentativa anterior.
  useEffect(() => {
    if (visible) {
      setProblem(newProblem());
      setInput("");
      setError(null);
    }
  }, [visible]);

  const questionText = useMemo(
    () =>
      tr("parentalGate.question", {
        a: problem.a,
        b: problem.b,
      }),
    [problem, tr],
  );

  const handleSubmit = () => {
    const parsed = parseInt(input.trim(), 10);
    if (!Number.isFinite(parsed)) {
      setError(tr("parentalGate.wrongAnswer"));
      setProblem(newProblem());
      setInput("");
      return;
    }
    if (parsed === problem.answer) {
      onSuccess();
      return;
    }
    // Errou — regenera e informa
    setError(tr("parentalGate.wrongAnswer"));
    setProblem(newProblem());
    setInput("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={tr("common.close")}
      >
        {/* Pressable interno pra não fechar quando toca no card */}
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            {
              backgroundColor: t.color.surface,
              borderRadius: t.radius.xl,
              padding: t.spacing.xl,
            },
          ]}
        >
          <Text
            variant="heading"
            size="xl"
            color={t.color.textPrimary}
            style={{ marginBottom: t.spacing.xs, textAlign: "center" }}
          >
            {tr("parentalGate.title")}
          </Text>
          <Text
            variant="body"
            color={t.color.textSecondary}
            style={{ marginBottom: t.spacing.lg, textAlign: "center" }}
          >
            {tr("parentalGate.subtitle")}
          </Text>

          <Text
            variant="display"
            color={t.color.textPrimary}
            style={{ textAlign: "center", marginBottom: t.spacing.md }}
          >
            {questionText}
          </Text>

          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setError(null);
            }}
            onSubmitEditing={handleSubmit}
            placeholder={tr("parentalGate.placeholder")}
            placeholderTextColor={t.color.textSecondary}
            keyboardType="number-pad"
            returnKeyType="done"
            autoFocus
            style={[
              styles.input,
              {
                color: t.color.textPrimary,
                borderColor: error ? t.color.danger : t.color.brand,
                borderRadius: t.radius.lg,
                padding: t.spacing.md,
                marginBottom: t.spacing.sm,
              },
            ]}
          />

          {error ? (
            <Text
              variant="caption"
              color={t.color.danger}
              style={{ textAlign: "center", marginBottom: t.spacing.sm }}
            >
              {error}
            </Text>
          ) : null}

          <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
            <Button
              label={tr("common.continue")}
              size="lg"
              fullWidth
              onPress={handleSubmit}
            />
            <Button
              label={tr("common.cancel")}
              variant="ghost"
              size="md"
              fullWidth
              onPress={onCancel}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
  },
  input: {
    fontSize: 22,
    textAlign: "center",
    borderWidth: 2,
  },
});
