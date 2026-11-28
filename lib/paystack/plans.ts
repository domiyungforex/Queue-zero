export const PLAN_LIMITS = {
  FREE: { queues: 1, locations: 1, staff: 2, monthlyActivity: 100 },
  STARTER: { queues: 3, locations: 2, staff: 5, monthlyActivity: 1000 },
  GROWTH: { queues: 10, locations: 5, staff: 15, monthlyActivity: 5000 },
  PROFESSIONAL: { queues: 25, locations: 10, staff: 40, monthlyActivity: 20000 },
  EDUCATION: { queues: 15, locations: 8, staff: 30, monthlyActivity: 10000 },
  EVENTS: { queues: 5, locations: 3, staff: 10, monthlyActivity: 2000 },
  ENTERPRISE: { queues: null, locations: null, staff: null, monthlyActivity: null },
  BUSINESS: { queues: 10, locations: 5, staff: 15, monthlyActivity: 5000 }, // legacy alias
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export const PLAN_PRICES_NGN = {
  FREE: 0,
  STARTER: 7500,
  GROWTH: 20000,
  PROFESSIONAL: 45000,
  EDUCATION: 35000,
  EVENTS: 15000,
  ENTERPRISE: null,
  BUSINESS: 20000, // legacy maps to Growth
} as const;

export const PLAN_DESCRIPTIONS: Record<Plan, string> = {
  FREE: "Free for a single small operation.",
  STARTER: "Affordable monthly plan for small businesses and teams.",
  GROWTH: "Higher capacity for growing businesses and clinics.",
  PROFESSIONAL: "More queues, locations and team members for larger organizations.",
  EDUCATION: "Institutional pricing for schools and universities.",
  EVENTS: "Event-ready queues for conference and summit organizers.",
  ENTERPRISE: "Custom quote for large institutions.",
  BUSINESS: "Legacy plan — equivalent capacity to Growth.",
};

export const ANNUAL_DISCOUNT = 0.15;

export function annualPrice(monthly: number): number {
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
}
