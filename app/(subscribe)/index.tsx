import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases, {
  CustomerInfo,
  PurchasesPackage,
} from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import { useThemedTokens } from "@/hooks/use-tokens";
import { SubscribeContainer } from "./styles";
import { logEvent } from "@/services/analyticsHelper";

const ENTITLEMENT_ID = "Magic World Pro";
const PRO_STORAGE_KEY = "@user_is_pro";

// Legal links — served from Notion so we can update them without a new build.
// IMPORTANT: these must be the *public* Notion URLs (Share → Publish → "Publish to web"),
// otherwise Apple review will hit a login wall and reject the submission.
const TERMS_URL =
  "https://app.notion.com/p/Terms-of-Use-Magic-World-39fbd4163b3b81018e64d954d4800b5b?source=copy_link";
const PRIVACY_URL =
  "https://app.notion.com/p/Privacy-Policy-Magic-World-3abbd4163b3b80a496affc2d58cefb32?source=copy_link";

// Featured review — set to null until you have a real quote from the App Store.
// One strong parent quote beats a star count when review volume is thin.
const FEATURED_REVIEW: { quote: string; author: string } | null = null;
// Example once you have one:
// const FEATURED_REVIEW = {
//   quote: "My 3-year-old asks for a new story every single night. Lifesaver at bedtime.",
//   author: "Sarah M., parent",
// };

const VALUE_PROPS = [
  { icon: "🌙", label: "Screen-free bedtime stories" },
  { icon: "📚", label: "New audiobooks every week" },
  { icon: "👶", label: "Made for little listeners, ages 0–10" },
  { icon: "🔒", label: "100% ad-free & kid-safe" },
];

/** Reads a free trial length from a RC package. Returns null if there's no free trial. */
function parseTrialDays(pkg: PurchasesPackage | null): number | null {
  if (!pkg) return null;
  const intro = pkg.product?.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits;
  const unit = intro.periodUnit;
  if (!n || !unit) return null;
  if (unit === "DAY") return n;
  if (unit === "WEEK") return n * 7;
  if (unit === "MONTH") return n * 30;
  if (unit === "YEAR") return n * 365;
  return n;
}

/** Formats an annual package as its monthly-equivalent price string. */
function formatMonthlyEquivalent(pkg: PurchasesPackage | null): string | null {
  if (!pkg) return null;
  const p = pkg.product?.price;
  const cs = pkg.product?.currencyCode ?? "USD";
  if (!p) return null;
  const perMonth = p / 12;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cs,
    }).format(perMonth);
  } catch {
    return `${cs} ${perMonth.toFixed(2)}`;
  }
}

/** Returns savings % of annual vs monthly*12. Returns null if annual isn't actually cheaper. */
function annualSavingsPercent(
  monthly: PurchasesPackage | null,
  annual: PurchasesPackage | null,
): number | null {
  if (!monthly || !annual) return null;
  const m = monthly.product?.price;
  const a = annual.product?.price;
  if (!m || !a) return null;
  const yearAtMonthly = m * 12;
  if (a >= yearAtMonthly) return null;
  return Math.round((1 - a / yearAtMonthly) * 100);
}

export default function SubscribeScreen() {
  const router = useRouter();
  const t = useThemedTokens();
  const insets = useSafeAreaInsets();

  const [monthly, setMonthly] = useState<PurchasesPackage | null>(null);
  const [annual, setAnnual] = useState<PurchasesPackage | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const trialDays = useMemo(() => parseTrialDays(selected), [selected]);
  const savings = useMemo(
    () => annualSavingsPercent(monthly, annual),
    [monthly, annual],
  );
  const monthlyEq = useMemo(() => formatMonthlyEquivalent(annual), [annual]);

  const loadOfferings = async () => {
    try {
      setError(null);
      setLoading(true);
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) throw new Error("No current offering");

      const m = current.monthly ?? null;
      const a = current.annual ?? null;
      setMonthly(m);
      setAnnual(a);

      // Default to annual only if it's actually the better deal, otherwise monthly.
      const defaultPick =
        a && m && a.product.price < m.product.price * 12 ? a : (m ?? a ?? null);
      setSelected(defaultPick);

      await logEvent("paywall_viewed", {
        source: "subscribe_screen",
        has_monthly: !!m,
        has_annual: !!a,
        default_selection: defaultPick?.identifier ?? null,
      });
    } catch (e) {
      setError(
        "Couldn't load subscription plans. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfferings();
  }, []);

  /** Sync AsyncStorage from RC's source of truth. Fixes the "locked out after cancel" bug. */
  const syncProStatus = async (info: CustomerInfo) => {
    const isActive = !!info.entitlements.active[ENTITLEMENT_ID];
    try {
      await AsyncStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(isActive));
    } catch (e) {
      console.error("Failed to sync pro status", e);
    }
    return isActive;
  };

  const handleSelect = async (pkg: PurchasesPackage) => {
    setSelected(pkg);
    await logEvent("paywall_plan_selected", {
      source: "subscribe_screen",
      plan: pkg.packageType === "MONTHLY" ? "monthly" : "annual",
      package: pkg.identifier,
    });
  };

  const handlePurchase = async () => {
    if (!selected) return;
    try {
      setPurchasing(true);
      const plan = selected.packageType === "MONTHLY" ? "monthly" : "annual";

      await logEvent("purchase_started", {
        source: "subscribe_screen",
        plan,
        package: selected.identifier,
        trial_days: trialDays,
      });

      const purchase = await Purchases.purchasePackage(selected);
      const isActive = await syncProStatus(purchase.customerInfo);

      if (isActive) {
        await logEvent("purchase_successful", {
          source: "subscribe_screen",
          plan,
          package: selected.identifier,
        });
        Alert.alert("You're in!", "Enjoy every story, every night.");
        router.back();
      }
    } catch (err: any) {
      if (err.userCancelled) {
        await logEvent("purchase_cancelled", {
          source: "subscribe_screen",
          plan: selected.packageType === "MONTHLY" ? "monthly" : "annual",
          package: selected.identifier,
          reason: "apple_sheet_closed",
        });
      } else {
        Alert.alert("Something went wrong", "Please try again in a moment.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      const info = await Purchases.restorePurchases();
      const isActive = await syncProStatus(info);
      await logEvent("purchase_restored", {
        source: "subscribe_screen",
        active: isActive,
      });
      if (isActive) {
        Alert.alert("Welcome back!", "Your subscription has been restored.");
        router.back();
      } else {
        Alert.alert(
          "No purchases found",
          "We couldn't find an active subscription on this Apple ID.",
        );
      }
    } catch (e) {
      Alert.alert("Restore failed", "Please try again in a moment.");
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = async () => {
    await logEvent("paywall_dismissed", { source: "subscribe_screen" });
    router.back();
  };

  const openLegalLink = async (kind: "privacy" | "terms") => {
    const url = kind === "privacy" ? PRIVACY_URL : TERMS_URL;
    try {
      await logEvent("paywall_link_opened", {
        source: "subscribe_screen",
        link: kind,
      });
      // Prefer the in-app browser (SFSafariViewController on iOS) — better UX,
      // keeps the user in the app, and is what Apple review expects.
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(
          "Couldn't open link",
          "Please check your connection and try again.",
        );
      }
    }
  };

  const ctaLabel = trialDays
    ? `Start ${trialDays}-Day Free Trial`
    : selected?.packageType === "ANNUAL"
      ? "Continue Yearly"
      : "Continue Monthly";

  const ctaFinePrint = trialDays
    ? `Then ${selected?.product.priceString} ${
        selected?.packageType === "MONTHLY" ? "/ month" : "/ year"
      }. Cancel anytime.`
    : "Auto-renews until cancelled. Cancel anytime in Settings.";

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      {/* Close */}
      <View
        style={{
          paddingTop: insets.top + t.spacing.xs,
          paddingHorizontal: t.spacing.lg,
          flexDirection: "row",
          justifyContent: "flex-end",
        }}
      >
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={16}
          accessibilityLabel="Close paywall"
        >
          <Text variant="heading" size="lg" color={t.color.textSecondary}>
            ✕
          </Text>
        </TouchableOpacity>
      </View>

      <SubscribeContainer
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.md,
          paddingBottom: 280,
        }}
      >
        {/* Hero */}
        <Text
          variant="display"
          color={t.color.textPrimary}
          style={{ marginBottom: t.spacing.xs }}
        >
          Unlock every magical story
        </Text>
        <Text
          variant="body"
          color={t.color.textSecondary}
          style={{ marginBottom: t.spacing.lg }}
        >
          Screen-free bedtime tales that grow with your little one.
        </Text>

        {/* Featured review */}
        {FEATURED_REVIEW && (
          <View
            style={{
              backgroundColor: t.color.surface,
              padding: t.spacing.lg,
              borderRadius: t.radius.xl,
              marginBottom: t.spacing.lg,
            }}
          >
            <Text variant="label" color={t.color.brand}>
              ★★★★★
            </Text>
            <Text
              variant="body"
              color={t.color.textPrimary}
              style={{ marginTop: t.spacing.xs, fontStyle: "italic" }}
            >
              "{FEATURED_REVIEW.quote}"
            </Text>
            <Text
              variant="caption"
              color={t.color.textSecondary}
              style={{ marginTop: t.spacing.xs }}
            >
              — {FEATURED_REVIEW.author}
            </Text>
          </View>
        )}

        {/* Value props */}
        <View
          style={{
            backgroundColor: t.color.surface,
            padding: t.spacing.lg,
            borderRadius: t.radius.xl,
            marginBottom: t.spacing.lg,
          }}
        >
          {VALUE_PROPS.map((v, i) => (
            <View
              key={v.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: i === 0 ? 0 : t.spacing.sm,
              }}
            >
              <Text
                variant="heading"
                size="lg"
                color={t.color.textPrimary}
                style={{ marginRight: t.spacing.sm }}
              >
                {v.icon}
              </Text>
              <Text
                variant="body"
                color={t.color.textPrimary}
                style={{ flex: 1 }}
              >
                {v.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Trial timeline (only if RC package actually has a free trial) */}
        {trialDays ? <TrialTimeline trialDays={trialDays} t={t} /> : null}

        {/* Plans */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={t.color.brand}
            style={{ marginTop: t.spacing.xxl }}
          />
        ) : error ? (
          <View
            style={{
              backgroundColor: t.color.surface,
              padding: t.spacing.lg,
              borderRadius: t.radius.xl,
              marginTop: t.spacing.md,
            }}
          >
            <Text
              variant="body"
              color={t.color.textPrimary}
              style={{ marginBottom: t.spacing.md }}
            >
              {error}
            </Text>
            <Button label="Try again" onPress={loadOfferings} />
          </View>
        ) : (
          <View style={{ marginTop: t.spacing.lg, gap: t.spacing.md }}>
            <Text
              variant="heading"
              size="md"
              color={t.color.textPrimary}
              style={{ marginBottom: t.spacing.xxs }}
            >
              Choose your plan
            </Text>
            {annual && (
              <PlanCard
                pkg={annual}
                isSelected={selected?.identifier === annual.identifier}
                onSelect={() => handleSelect(annual)}
                savings={savings}
                monthlyEq={monthlyEq}
                t={t}
              />
            )}
            {monthly && (
              <PlanCard
                pkg={monthly}
                isSelected={selected?.identifier === monthly.identifier}
                onSelect={() => handleSelect(monthly)}
                savings={null}
                monthlyEq={null}
                t={t}
              />
            )}
          </View>
        )}
      </SubscribeContainer>

      {/* Sticky CTA */}
      {!loading && !error && selected && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: t.color.surface,
            paddingTop: t.spacing.lg,
            paddingHorizontal: t.spacing.lg,
            paddingBottom: insets.bottom + t.spacing.md,
            borderTopLeftRadius: t.radius.xxl,
            borderTopRightRadius: t.radius.xxl,
          }}
        >
          <Button
            label={ctaLabel}
            size="lg"
            fullWidth
            loading={purchasing}
            onPress={handlePurchase}
          />
          <Text
            variant="caption"
            color={t.color.textSecondary}
            style={{ textAlign: "center", marginTop: t.spacing.xs }}
          >
            {ctaFinePrint}
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: t.spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <TouchableOpacity onPress={handleRestore} disabled={restoring}>
              <Text
                variant="caption"
                color={t.color.textSecondary}
                style={{ textDecorationLine: "underline" }}
              >
                {restoring ? "Restoring…" : "Restore"}
              </Text>
            </TouchableOpacity>
            <Dot t={t} />
            <TouchableOpacity onPress={() => openLegalLink("privacy")}>
              <Text
                variant="caption"
                color={t.color.textSecondary}
                style={{ textDecorationLine: "underline" }}
              >
                Privacy
              </Text>
            </TouchableOpacity>
            <Dot t={t} />
            <TouchableOpacity onPress={() => openLegalLink("terms")}>
              <Text
                variant="caption"
                color={t.color.textSecondary}
                style={{ textDecorationLine: "underline" }}
              >
                Terms (EULA)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ────────────── Sub-components ──────────────

function Dot({ t }: { t: ReturnType<typeof useThemedTokens> }) {
  return (
    <Text
      variant="caption"
      color={t.color.textSecondary}
      style={{ marginHorizontal: t.spacing.xs }}
    >
      •
    </Text>
  );
}

function PlanCard({
  pkg,
  isSelected,
  onSelect,
  savings,
  monthlyEq,
  t,
}: {
  pkg: PurchasesPackage;
  isSelected: boolean;
  onSelect: () => void;
  savings: number | null;
  monthlyEq: string | null;
  t: ReturnType<typeof useThemedTokens>;
}) {
  const isMonthly = pkg.packageType === "MONTHLY";
  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.85}
      style={{
        backgroundColor: isSelected ? t.color.brandSubtle : t.color.surface,
        borderRadius: t.radius.xl,
        padding: t.spacing.lg,
        borderWidth: 2,
        borderColor: isSelected ? t.color.brand : "transparent",
      }}
    >
      {!isMonthly && savings != null && savings > 0 && (
        <View
          style={{
            position: "absolute",
            top: -10,
            right: t.spacing.md,
            backgroundColor: t.color.brand,
            paddingHorizontal: t.spacing.sm,
            paddingVertical: 4,
            borderRadius: t.radius.sm,
          }}
        >
          <Text variant="label" color={t.color.textOnBrand}>
            SAVE {savings}%
          </Text>
        </View>
      )}
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text
            variant="heading"
            size="xl"
            color={isSelected ? t.color.brand : t.color.textPrimary}
          >
            {isMonthly ? "Monthly" : "Yearly"}
          </Text>
          <Text
            variant="caption"
            color={t.color.textSecondary}
            style={{ marginTop: 2 }}
          >
            {isMonthly
              ? "Billed monthly"
              : monthlyEq
                ? `Just ${monthlyEq}/mo, billed yearly`
                : "Billed yearly"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", marginLeft: t.spacing.sm }}>
          <Text
            variant="heading"
            size="xxl"
            color={isSelected ? t.color.brand : t.color.textPrimary}
          >
            {pkg.product.priceString}
          </Text>
          <Text variant="caption" color={t.color.textSecondary}>
            {isMonthly ? "per month" : "per year"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function TrialTimeline({
  trialDays,
  t,
}: {
  trialDays: number;
  t: ReturnType<typeof useThemedTokens>;
}) {
  const reminderDay = Math.max(trialDays - 2, 1);
  const steps = [
    {
      day: "Today",
      title: "Full access, instantly",
      desc: "Every story, every character. Nothing locked.",
    },
    {
      day: `Day ${reminderDay}`,
      title: "We'll remind you",
      desc: "You get a heads-up before your trial ends.",
    },
    {
      day: `Day ${trialDays}`,
      title: "Your subscription starts",
      desc: "Only if you love it. Cancel anytime in Settings.",
    },
  ];
  return (
    <View style={{ marginTop: t.spacing.md, marginBottom: t.spacing.sm }}>
      <Text
        variant="heading"
        size="md"
        color={t.color.textPrimary}
        style={{ marginBottom: t.spacing.md }}
      >
        How your {trialDays}-day free trial works
      </Text>
      {steps.map((s, i) => (
        <View
          key={s.day}
          style={{
            flexDirection: "row",
            marginBottom: i === steps.length - 1 ? 0 : t.spacing.md,
          }}
        >
          <View
            style={{
              width: 20,
              alignItems: "center",
              marginRight: t.spacing.sm,
            }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: t.color.brand,
                marginTop: 4,
              }}
            />
            {i < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  width: 2,
                  backgroundColor: t.color.brandSubtle,
                  marginTop: 2,
                }}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={t.color.brand}>
              {s.day}
            </Text>
            <Text
              variant="body"
              color={t.color.textPrimary}
              style={{ marginTop: 2 }}
            >
              {s.title}
            </Text>
            <Text
              variant="caption"
              color={t.color.textSecondary}
              style={{ marginTop: 2 }}
            >
              {s.desc}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
