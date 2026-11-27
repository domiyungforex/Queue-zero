import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PLAN_DESCRIPTIONS, PLAN_LIMITS, PLAN_PRICES_NGN, type Plan } from "@/lib/paystack/plans";
import { createJoinSupabaseClient } from "@/lib/db/join-server";

export interface CatalogPrice {
  id: string;
  currency: string;
  interval: "monthly" | "annual";
  amountMinor: number;
  provider: "paystack" | "stripe";
  providerPriceCode: string | null;
}

export interface CatalogEntitlement {
  featureKey: string;
  limitValue: number | null;
  description: string | null;
}

export interface CatalogPlan {
  id: string;
  code: Plan;
  name: string;
  description: string;
  isFeatured: boolean;
  sortOrder: number;
  prices: CatalogPrice[];
  entitlements: CatalogEntitlement[];
}

function fallbackCatalog(): CatalogPlan[] {
  const codes: Plan[] = ["FREE", "STARTER", "GROWTH", "PROFESSIONAL", "EDUCATION", "EVENTS", "ENTERPRISE"];
  return codes.map((code, index) => {
    const ngnMonthly = PLAN_PRICES_NGN[code];
    const limits = PLAN_LIMITS[code];
    return {
      id: `fallback-${code.toLowerCase()}`,
      code,
      name: code[0] + code.slice(1).toLowerCase(),
      description: PLAN_DESCRIPTIONS[code],
      isFeatured: code === "STARTER",
      sortOrder: index + 1,
      prices:
        ngnMonthly === null
          ? []
          : [
              {
                id: `fallback-ngn-${code.toLowerCase()}`,
                currency: "NGN",
                interval: "monthly",
                amountMinor: ngnMonthly * 100,
                provider: "paystack",
                providerPriceCode: null,
              },
            ],
      entitlements: [
        { featureKey: "max_queues", limitValue: limits.queues, description: "Active queues limit" },
        { featureKey: "max_locations", limitValue: limits.locations, description: "Physical locations limit" },
        { featureKey: "max_staff", limitValue: limits.staff, description: "Team members limit" },
        { featureKey: "max_monthly_activity", limitValue: limits.monthlyActivity, description: "Monthly tickets & check-ins" },
        { featureKey: "booking_enabled", limitValue: code === "FREE" ? 0 : 1, description: "Scheduled bookings & virtual queue" },
        { featureKey: "analytics_enabled", limitValue: code === "FREE" ? 0 : 1, description: "Operational analytics & exports" },
      ],
    };
  });
}

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_featured: boolean;
  sort_order: number;
  plan_prices?: Array<{
    id: string;
    currency: string;
    interval: string;
    amount_minor: number;
    provider: string;
    provider_price_code: string | null;
    is_active: boolean;
  }>;
  plan_entitlements?: Array<{
    feature_key: string;
    limit_value: number | null;
    description: string | null;
  }>;
};

export async function getCatalogPlans(): Promise<CatalogPlan[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return fallbackCatalog();
    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from("plans")
      .select("id,code,name,description,is_featured,sort_order,plan_prices(id,currency,interval,amount_minor,provider,provider_price_code,is_active),plan_entitlements(feature_key,limit_value,description)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return fallbackCatalog();
    }

    return (data as unknown as PlanRow[]).map((row) => ({
      id: row.id,
      code: row.code as Plan,
      name: row.name,
      description: row.description,
      isFeatured: row.is_featured,
      sortOrder: row.sort_order,
      prices: (row.plan_prices ?? [])
        .filter((p) => p.is_active)
        .map((p) => ({
          id: p.id,
          currency: p.currency,
          interval: p.interval === "annual" ? "annual" : "monthly",
          amountMinor: p.amount_minor,
          provider: p.provider === "stripe" ? "stripe" : "paystack",
          providerPriceCode: p.provider_price_code,
        })),
      entitlements: (row.plan_entitlements ?? []).map((e) => ({
        featureKey: e.feature_key,
        limitValue: e.limit_value,
        description: e.description,
      })),
    }));
  } catch {
    return fallbackCatalog();
  }
}

export async function getOrganizationEntitlements(businessId: string): Promise<{
  plan: Plan;
  limits: Record<string, number | null>;
}> {
  const db = createJoinSupabaseClient();
  const { data: business } = await db
    .from("businesses")
    .select("subscription_tier")
    .eq("id", businessId)
    .maybeSingle();

  const tier = (business?.subscription_tier ?? "FREE") as Plan;
  const catalog = await getCatalogPlans();
  const matched = catalog.find((p) => p.code === tier) ?? catalog[0];

  const limits: Record<string, number | null> = {};
  for (const ent of matched?.entitlements ?? []) {
    limits[ent.featureKey] = ent.limitValue;
  }
  return { plan: tier, limits };
}

export async function assertEntitlement(
  businessId: string,
  featureKey: string,
  currentUsage?: number,
): Promise<{ allowed: boolean; limit: number | null; plan: Plan }> {
  const { plan, limits } = await getOrganizationEntitlements(businessId);
  const limit = limits[featureKey];

  if (limit === undefined || limit === null) {
    return { allowed: true, limit: null, plan };
  }
  if (typeof currentUsage === "number") {
    return { allowed: currentUsage < limit, limit, plan };
  }
  return { allowed: limit > 0, limit, plan };
}
