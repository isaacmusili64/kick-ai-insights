export type PlanId = "daily" | "weekly" | "monthly";

export type Plan = {
  id: PlanId;
  name: string;
  priceKes: number;
  days: number;
  blurb: string;
};

export const PLANS: Plan[] = [
  { id: "daily", name: "Day pass", priceKes: 50, days: 1, blurb: "Every prediction for one match day." },
  { id: "weekly", name: "Week pass", priceKes: 250, days: 7, blurb: "A full week of fixtures, edges and accas." },
  { id: "monthly", name: "Month pass", priceKes: 750, days: 30, blurb: "Best value — a whole month of predictions." },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export const formatKes = (amount: number) => `KES ${amount.toLocaleString("en-KE")}`;
