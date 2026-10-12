import {
  Users,
  UserCog,
  ShieldCheck,
  KeyRound,
  GitBranch,
  GitPullRequestArrow,
  Clock,
  CalendarClock,
  Gauge,
  ScrollText,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";

export interface OrgTab { id: string; label: string; icon: LucideIcon; group: string; }

export const ORG_TABS: OrgTab[] = [
  { id: "employees", label: "Employee Master", icon: Users, group: "People" },
  { id: "users", label: "User Accounts", icon: UserCog, group: "People" },
  { id: "roles", label: "Roles Management", icon: ShieldCheck, group: "Access" },
  { id: "permissions", label: "Permission Management", icon: KeyRound, group: "Access" },
  { id: "branch", label: "Branch Access", icon: GitBranch, group: "Access" },
  { id: "approval", label: "Approval Hierarchy", icon: GitPullRequestArrow, group: "Workflow" },
  { id: "attendance", label: "Attendance Setup", icon: Clock, group: "Time" },
  { id: "shifts", label: "Shift Management", icon: CalendarClock, group: "Time" },
  { id: "performance", label: "Employee Performance", icon: Gauge, group: "Insights" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, group: "Insights" },
  { id: "ai", label: "AI Employee Setup", icon: Sparkles, group: "Tools" },
  { id: "import", label: "Import", icon: Upload, group: "Tools" },
];

const opt = (a: string[]) => a.map((x) => ({ value: x, label: x }));

export const EMP_TYPE_OPTS = opt(["Permanent", "Contract", "Temporary", "Consultant"]);
export const EMP_STATUS_OPTS = opt(["Active", "Inactive", "Suspended", "Resigned"]);
export const USER_STATUS_OPTS = opt(["Active", "Inactive", "Locked"]);
export const GENDER_OPTS = opt(["Male", "Female", "Other"]);
export const DEPARTMENTS = opt(["Sales", "Purchase", "Inventory", "Accounts", "HR", "Pharmacy", "Administration", "IT"]);
export const DESIGNATIONS = opt(["Store Manager", "Cashier", "Sales Executive", "Accountant", "Pharmacist", "HR Executive", "Inventory Manager"]);
export const BRANCHES = opt(["Main Store — MG Road", "Whitefield Branch", "Koramangala Branch", "Central Warehouse"]);

export const SYSTEM_ROLES = [
  "Super Admin", "Business Owner", "Store Manager", "Branch Manager", "Accountant",
  "Cashier", "Sales Executive", "Purchase Executive", "Inventory Manager",
  "Warehouse Manager", "Pharmacist", "HR Executive", "CRM Executive", "Auditor",
];

export const PERMISSION_LEVELS = ["View", "Add", "Edit", "Delete", "Approve", "Export", "Print"];
export const PERMISSION_GROUPS = [
  { group: "Masters", modules: ["Product Master", "Supplier Master", "Customer Master", "Employee Master"] },
  { group: "Operations", modules: ["Purchase", "Sales", "Inventory", "Payments"] },
  { group: "Finance", modules: ["Accounting", "GST", "Bank Reconciliation", "Financial Reports"] },
  { group: "Administration", modules: ["User Management", "Roles", "Configuration"] },
  { group: "Reports", modules: ["MIS Reports", "Analytics", "Dashboard"] },
];

export interface EmployeeRow { id: string; code: string; name: string; dept: string; designation: string; type: string; branch: string; mobile: string; status: string; }
export const EMPLOYEES: EmployeeRow[] = [
  { id: "e1", code: "EMP-1001", name: "Arjun Rao", dept: "Administration", designation: "Store Manager", type: "Permanent", branch: "Main Store — MG Road", mobile: "+91 98765 43210", status: "Active" },
  { id: "e2", code: "EMP-1002", name: "Meena R", dept: "Sales", designation: "Cashier", type: "Permanent", branch: "Main Store — MG Road", mobile: "+91 98765 43211", status: "Active" },
  { id: "e3", code: "EMP-1003", name: "Karan Singh", dept: "Sales", designation: "Sales Executive", type: "Contract", branch: "Whitefield Branch", mobile: "+91 98765 43212", status: "Active" },
  { id: "e4", code: "EMP-1004", name: "Divya Nair", dept: "Accounts", designation: "Accountant", type: "Permanent", branch: "Main Store — MG Road", mobile: "+91 98765 43213", status: "Active" },
  { id: "e5", code: "EMP-1005", name: "Suresh Kumar", dept: "Inventory", designation: "Inventory Manager", type: "Permanent", branch: "Central Warehouse", mobile: "+91 98765 43214", status: "Active" },
  { id: "e6", code: "EMP-1006", name: "Priya Menon", dept: "Pharmacy", designation: "Pharmacist", type: "Permanent", branch: "Koramangala Branch", mobile: "+91 98765 43215", status: "Suspended" },
  { id: "e7", code: "EMP-1007", name: "Rahul Das", dept: "HR", designation: "HR Executive", type: "Permanent", branch: "Main Store — MG Road", mobile: "+91 98765 43216", status: "Inactive" },
];

export interface UserRow { id: string; username: string; email: string; role: string; branch: string; twofa: string; status: string; }
export const USERS: UserRow[] = [
  { id: "u1", username: "arjun.rao", email: "arjun@onepos.cloud", role: "Store Manager", branch: "All Branches", twofa: "On", status: "Active" },
  { id: "u2", username: "meena.r", email: "meena@onepos.cloud", role: "Cashier", branch: "Main Store — MG Road", twofa: "Off", status: "Active" },
  { id: "u3", username: "karan.s", email: "karan@onepos.cloud", role: "Sales Executive", branch: "Whitefield Branch", twofa: "Off", status: "Active" },
  { id: "u4", username: "divya.n", email: "divya@onepos.cloud", role: "Accountant", branch: "Main Store — MG Road", twofa: "On", status: "Active" },
  { id: "u5", username: "priya.m", email: "priya@onepos.cloud", role: "Pharmacist", branch: "Koramangala Branch", twofa: "Off", status: "Locked" },
];

export interface ShiftRow { id: string; code: string; name: string; start: string; end: string; break: string; }
export const SHIFTS: ShiftRow[] = [
  { id: "s1", code: "SH-01", name: "Morning Shift", start: "06:00", end: "14:00", break: "30 min" },
  { id: "s2", code: "SH-02", name: "General Shift", start: "10:00", end: "19:00", break: "60 min" },
  { id: "s3", code: "SH-03", name: "Evening Shift", start: "14:00", end: "22:00", break: "30 min" },
  { id: "s4", code: "SH-04", name: "Night Shift", start: "22:00", end: "06:00", break: "45 min" },
];

export const APPROVAL_FLOWS = [
  { name: "Purchase Approval", levels: ["Store Manager", "Branch Manager", "Finance Manager"] },
  { name: "Sales Approval", levels: ["Sales Manager", "Branch Manager"] },
  { name: "Expense Approval", levels: ["Department Head", "Finance Manager"] },
  { name: "User Creation Approval", levels: ["HR", "Admin"] },
];

export const ATTENDANCE_METHODS = [
  { id: "manual", label: "Manual" },
  { id: "biometric", label: "Biometric" },
  { id: "mobile", label: "Mobile App" },
  { id: "geo", label: "Geo Attendance" },
];

export interface AuditRow { id: string; user: string; action: string; datetime: string; ip: string; device: string; tone: "info" | "success" | "warning" | "danger"; }
export const AUDIT_LOG: AuditRow[] = [
  { id: "a1", user: "arjun.rao", action: "Login", datetime: "2026-06-08 09:02", ip: "49.205.12.8", device: "Chrome · Windows", tone: "success" },
  { id: "a2", user: "meena.r", action: "Created Invoice INV-20451", datetime: "2026-06-08 09:14", ip: "49.205.12.9", device: "POS Terminal", tone: "info" },
  { id: "a3", user: "divya.n", action: "Edited Ledger 'Rent'", datetime: "2026-06-08 10:01", ip: "49.205.12.10", device: "Chrome · Mac", tone: "warning" },
  { id: "a4", user: "arjun.rao", action: "Approved PO-10235", datetime: "2026-06-08 10:22", ip: "49.205.12.8", device: "Chrome · Windows", tone: "success" },
  { id: "a5", user: "priya.m", action: "Failed login (3 attempts) — locked", datetime: "2026-06-08 10:40", ip: "103.21.58.4", device: "Android App", tone: "danger" },
  { id: "a6", user: "karan.s", action: "Deleted Customer CUST-1090", datetime: "2026-06-08 11:05", ip: "49.205.12.11", device: "Chrome · Windows", tone: "danger" },
  { id: "a7", user: "divya.n", action: "Exported Trial Balance", datetime: "2026-06-08 11:30", ip: "49.205.12.10", device: "Chrome · Mac", tone: "info" },
];

export const PERFORMANCE = [
  { name: "Meena R", sales: "₹4.2L", collections: "₹3.9L", customers: 318, attendance: "98%", target: "₹4.0L", achievement: "105%", incentive: "₹4,200" },
  { name: "Karan Singh", sales: "₹2.8L", collections: "₹2.5L", customers: 211, attendance: "92%", target: "₹3.0L", achievement: "93%", incentive: "₹0" },
  { name: "Divya Nair", sales: "—", collections: "₹6.1L", customers: 0, attendance: "99%", target: "—", achievement: "—", incentive: "₹3,000" },
];

export const ORG_STATS = {
  employees: 48,
  active: 42,
  users: 31,
  roles: 14,
  pending: 5,
  attendanceToday: "39 / 42",
};
