"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings, Key, Globe, Users, Search, Bot, Save, CheckCircle,
  AlertCircle, Eye, EyeOff, Plus, X, Loader2, Megaphone,
  ChevronDown, ChevronUp, Unplug, BarChart2, ExternalLink, Rocket,
  Play, Activity, Zap, Code2, Link, Info, Star, Compass, RefreshCw, Sparkles,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { api, tenantApi, pollAgentRun } from "@/lib/api";
import CustomerNav from "@/components/CustomerNav";
import PublishingDestinations from "@/components/PublishingDestinations";
import GoogleAnalyticsPropertyPicker from "@/components/GoogleAnalyticsPropertyPicker";