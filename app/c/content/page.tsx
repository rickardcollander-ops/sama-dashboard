"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText, Plus, Loader2, Calendar, Hash, CheckCircle,
  PenTool, Search, X, Sparkles, Save, AlertCircle,
  Maximize2, Minimize2, ExternalLink, Code2, Send, Eye,
  ArrowRight, Archive, ShieldCheck, BarChart2, Wand2, Target,
  CalendarPlus, Lightbulb, MessageSquare, Mail, Trash2, Edit3,
} from "lucide-react";
import Link from "next/link";
import CustomerNav from "@/components/CustomerNav";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import PublishDialog from "@/components/PublishDialog";
import PiecePerformance from "@/components/content/PiecePerformance";
import RefineDialog from "@/components/content/RefineDialog";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";
import { useActiveRuns } from "@/lib/hooks/useActiveRuns";
import { useLanguage } from "@/lib/hooks/useLanguage";
import { tenantApi } from "@/lib/api";
import { IS_DEMO, demoContentPieces } from "@/lib/demo-data";
import AutoApproveToggle from "@/components/content/AutoApproveToggle";