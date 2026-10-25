export const accountRoles = [
  "farmer",
  "buyer",
  "retailer",
  "restaurant",
  "processor",
  "ngo",
] as const;

export type AccountRole = (typeof accountRoles)[number];
export type Role = AccountRole | "administrator";
export type Language = "en" | "te";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  preferred_language: Language;
  farm_or_business_name: string | null;
  state: string | null;
  district: string | null;
}

export const roleLabels: Record<Role, string> = {
  farmer: "Farmer",
  buyer: "Household Buyer",
  retailer: "Retailer",
  restaurant: "Restaurant",
  processor: "Food Processor",
  ngo: "NGO / Donation Partner",
  administrator: "Administrator",
};

export const roleDestinations: Record<Role, string> = {
  farmer: "/dashboard/farmer",
  buyer: "/dashboard/buyer",
  retailer: "/dashboard/retailer",
  restaurant: "/dashboard/restaurant",
  processor: "/dashboard/processor",
  ngo: "/dashboard/ngo",
  administrator: "/admin",
};
