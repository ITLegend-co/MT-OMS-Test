export const SITES = ["KK", "KP", "PH"];

export const ITEM_CATEGORIES = [
  "Food",
  "Misc",
  "Repair / Maintenance",
  "Wood / Steel",
  "Big PVC / Fiberglass",
  "Small PVC / Fiberglass",
  "Mattress / Pillow",
  "Gas Tank",
  "Rubbish"
];

export const ROLE_LABELS = {
  system_admin: "System Administrator",
  management: "Management",
  accounts: "Accounts",
  operations_admin: "Operations Admin",
  customer_service: "Customer Service",
  housekeeping: "Housekeeping"
};

export function isElevated(profile) {
  return ["system_admin", "management", "accounts", "operations_admin"].includes(profile?.role);
}

export function can(profile, action) {
  const role = profile?.role;

  const map = {
    manage_users: ["system_admin"],
    view_all_inventory: ["system_admin", "management", "accounts", "operations_admin"],
    manage_inventory: ["system_admin", "management", "operations_admin"],
    create_request: ["system_admin", "management", "operations_admin", "customer_service", "housekeeping"],
    manage_requests: ["system_admin", "management", "operations_admin"],
    create_transit: ["system_admin", "management", "operations_admin", "customer_service", "housekeeping"],
    verify_transit: ["system_admin", "management", "operations_admin", "customer_service", "housekeeping"],
    manage_porters: ["system_admin", "management", "operations_admin", "customer_service"],
    view_billing: ["system_admin", "management", "accounts", "operations_admin", "customer_service"],
    verify_kp_bill: ["system_admin", "management", "customer_service"],
    verify_accounts: ["system_admin", "management", "accounts"],
    mark_paid: ["system_admin", "management", "accounts"],
    view_reports: ["system_admin", "management", "accounts", "operations_admin", "customer_service", "housekeeping"]
  };

  return (map[action] || []).includes(role);
}

export function allowedInventorySites(profile) {
  if (!profile) return [];
  if (can(profile, "view_all_inventory")) return SITES;
  if (SITES.includes(profile.primarySite)) return [profile.primarySite];
  return [];
}

export function canVerifyAtSite(profile, site) {
  if (!profile) return false;
  if (["system_admin", "management", "operations_admin"].includes(profile.role)) return true;
  if (profile.role === "customer_service") return site === "KP" && profile.primarySite === "KP";
  if (profile.role === "housekeeping") return site === "PH" && profile.primarySite === "PH";
  return false;
}

export function canCreateRequestForSite(profile, site) {
  if (!profile || !can(profile, "create_request")) return false;
  if (["system_admin", "management", "operations_admin"].includes(profile.role)) return true;
  return profile.primarySite === site && ["KP", "PH"].includes(site);
}
