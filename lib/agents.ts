import {
  Bot, Search, FileText, Share2, Megaphone, TrendingUp, BarChart2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AgentDef {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  bg: string;
  borderColor: string;
  textColor: string;
  hoverBg: string;
  solidBg: string;
  solidHover: string;
}

export const AGENTS: Record<string, AgentDef> = {
  geo: {
    id: "geo",
    label: "GEO Monitor",
    description: "AI Visibility in ChatGPT, Claude, Perplexity & more",
    href: "/c/geo",
    icon: Bot,
    color: "violet",
    iconColor: "text-violet-600",
    bg: "bg-violet-50",
    borderColor: "border-violet-200",
    textColor: "text-violet-700",
    hoverBg: "hover:bg-violet-100",
    solidBg: "bg-violet-600",
    solidHover: "hover:bg-violet-700",
  },
  seo: {
    id: "seo",
    label: "SEO",
    description: "Rankings, technical audits & keywords",
    href: "/c/seo",
    icon: Search,
    color: "blue",
    iconColor: "text-blue-600",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    hoverBg: "hover:bg-blue-100",
    solidBg: "bg-blue-600",
    solidHover: "hover:bg-blue-700",
  },
  content: {
    id: "content",
    label: "Content",
    description: "AI-generated articles & pages",
    href: "/c/content",
    icon: FileText,
    color: "purple",
    iconColor: "text-purple-600",
    bg: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    hoverBg: "hover:bg-purple-100",
    solidBg: "bg-purple-600",
    solidHover: "hover:bg-purple-700",
  },
  social: {
    id: "social",
    label: "Social",
    description: "Automated posting & engagement",
    href: "/c/social",
    icon: Share2,
    color: "indigo",
    iconColor: "text-indigo-600",
    bg: "bg-indigo-50",
    borderColor: "border-indigo-200",
    textColor: "text-indigo-700",
    hoverBg: "hover:bg-indigo-100",
    solidBg: "bg-indigo-600",
    solidHover: "hover:bg-indigo-700",
  },
  ads: {
    id: "ads",
    label: "Ads",
    description: "AI-generated ad creatives & campaigns",
    href: "/c/ads",
    icon: Megaphone,
    color: "orange",
    iconColor: "text-orange-600",
    bg: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
    hoverBg: "hover:bg-orange-100",
    solidBg: "bg-orange-600",
    solidHover: "hover:bg-orange-700",
  },
  analytics: {
    id: "analytics",
    label: "Analytics",
    description: "Cross-channel metrics & ROI",
    href: "/c/analytics",
    icon: BarChart2,
    color: "indigo",
    iconColor: "text-indigo-600",
    bg: "bg-indigo-50",
    borderColor: "border-indigo-200",
    textColor: "text-indigo-700",
    hoverBg: "hover:bg-indigo-100",
    solidBg: "bg-indigo-600",
    solidHover: "hover:bg-indigo-700",
  },
};

export const AGENT_LIST = Object.values(AGENTS);
