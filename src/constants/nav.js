import {
  Home as HomeIcon,
  Building2 as BuildingIcon,
  Grid3X3 as GridIcon,
  AlertTriangle,
  CreditCard,
  Settings as SettingsIcon,
  Users as UsersIcon,
  FileText as FileTextIcon,
  Banknote as CashIcon,
} from "lucide-react";

const ROLES = ["ADMIN", "STAFF", "BUILDING_MGMT", "TENANT", "OWNER"];

export const NAV = [
  { key: "dashboard", path: "/", icon: HomeIcon, roles: ROLES, label: "Dashboard", label_ar: "لوحة التحكم" },
  { key: "buildings", path: "/buildings", icon: BuildingIcon, roles: ["ADMIN","STAFF","BUILDING_MGMT"], label: "Buildings", label_ar: "المباني" },
  { key: "units", path: "/units", icon: GridIcon, roles: ["ADMIN","STAFF","BUILDING_MGMT"], label: "Units", label_ar: "الوحدات" },
  { key: "issues", path: "/issues", icon: AlertTriangle, roles: ["ADMIN","STAFF","BUILDING_MGMT","TENANT","OWNER"], label: "Issues", label_ar: "البلاغات" },
  { key: "payments", path: "/payments", icon: CreditCard, roles: ["ADMIN","STAFF","BUILDING_MGMT","TENANT","OWNER"], label: "Payments", label_ar: "المدفوعات" },
  { key: "cash", path: "/cash", icon: CashIcon, roles: ["ADMIN","STAFF","BUILDING_MGMT"], label: "Cash", label_ar: "الصندوق" },
  { key: "ratings", path: "/ratings", icon: FileTextIcon, roles: ROLES, label: "Ratings", label_ar: "التقييمات" },
  { key: "users", path: "/profile", icon: UsersIcon, roles: ROLES, label: "Profile", label_ar: "الملف الشخصي" },
  { key: "settings", path: "/settings", icon: SettingsIcon, roles: ["ADMIN","STAFF","BUILDING_MGMT","TENANT","OWNER"], label: "Settings", label_ar: "الإعدادات" },
];



export function allowedFor(role, item) {
  if (!role) return false;
  return item.roles?.includes(String(role).toUpperCase());
}
