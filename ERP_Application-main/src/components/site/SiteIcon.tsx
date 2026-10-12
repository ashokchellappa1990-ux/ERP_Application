/**
 * Icon resolver for the marketing site — maps config icon-name strings to lucide
 * icons. Unknown names fall back to a default so the CMS can never break a page.
 * Server-compatible (lucide renders fine in RSC).
 */
import {
  Sparkles, Cloud, Building2, Network, GitBranch, ShieldCheck, Lock, TrendingUp, Plug, Smartphone,
  Award, ShoppingCart, Truck, Boxes, Warehouse, Monitor, Landmark, ReceiptText, Factory, ClipboardList,
  Repeat, Users, UserCog, Wallet, Building, Wrench, KanbanSquare, BadgeCheck, GitPullRequest, FileText,
  BarChart3, BookOpen, ArrowDownCircle, ArrowUpCircle, CreditCard, Coins, FileCheck, Percent, FileBarChart,
  Clock, CalendarDays, HandCoins, Receipt, GraduationCap, History, MessageSquareWarning, Gift, Ticket,
  UserPlus, Brain, BellRing, Gauge, PiggyBank, Mic, Megaphone, Palette, Mail, Star, Cake, PartyPopper,
  Store, RefreshCw, MapPin, MessageSquare, Phone, Languages, LayoutDashboard, Bot, HeartPulse, ShoppingBag,
  Pill, Shirt, Sofa, Stethoscope, UtensilsCrossed, HardHat, Zap, Code, QrCode, ScanLine, Circle, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Sparkles, Cloud, Building2, Network, GitBranch, ShieldCheck, Lock, TrendingUp, Plug, Smartphone,
  Award, ShoppingCart, Truck, Boxes, Warehouse, Monitor, Landmark, ReceiptText, Factory, ClipboardList,
  Repeat, Users, UserCog, Wallet, Building, Wrench, KanbanSquare, BadgeCheck, GitPullRequest, FileText,
  BarChart3, BookOpen, ArrowDownCircle, ArrowUpCircle, CreditCard, Coins, FileCheck, Percent, FileBarChart,
  Clock, CalendarDays, HandCoins, Receipt, GraduationCap, History, MessageSquareWarning, Gift, Ticket,
  UserPlus, Brain, BellRing, Gauge, PiggyBank, Mic, Megaphone, Palette, Mail, Star, Cake, PartyPopper,
  Store, RefreshCw, MapPin, MessageSquare, Phone, Languages, LayoutDashboard, Bot, HeartPulse, ShoppingBag,
  Pill, Shirt, Sofa, Stethoscope, UtensilsCrossed, HardHat, Zap, Code, QrCode, ScanLine,
};

export function SiteIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const C = MAP[name] ?? Circle;
  return <C className={className} style={style} />;
}
