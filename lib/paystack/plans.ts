export const PLAN_LIMITS={FREE:3,STARTER:10,BUSINESS:50} as const;
export type Plan=keyof typeof PLAN_LIMITS;
export const PLAN_DESCRIPTIONS={FREE:'A simple start for a small team.',STARTER:'More services. One calmer workspace.',BUSINESS:'Room for a growing service operation.'};
