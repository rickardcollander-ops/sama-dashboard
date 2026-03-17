"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send, Search, MessageSquare, TrendingUp, Users, BarChart3,
  BarChart2, Zap, Bot, User, Loader2, Radio, Wrench,
} from "lucide-react";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

interface AgentInfo {
  id: string;
  name: string;
  title: string;
  emoji: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
  agentName?: string;
  agentEmoji?: string;
  timestamp: string;
}

const AGENT_ICONS: Record<string, React.ElementType> = {
  seo: Search,
  content: MessageSquare,
  ads: TrendingUp,
  social: Users,
  reviews: BarChart3,
  analytics: BarChart2,
  dev: Wrench,
};

const AGENT_COLORS: Record<string, { bg: string; ring: string; text: string; gradient: string }> = {
  seo:       { bg: "bg-blue-500",    ring: "ring-blue-300",    text: "text-blue-600",    gradient: "from-blue-500 to-blue-600" },
  content:   { bg: "bg-purple-500",  ring: "ring-purple-300",  text: "text-purple-600",  gradient: "from-purple-500 to-purple-600" },
  ads:       { bg: "bg-emerald-500", ring: "ring-emerald-300", text: "text-emerald-600", gradient: "from-emerald-500 to-emerald-600" },
  social:    { bg: "bg-pink-500",    ring: "ring-pink-300",    text: "text-pink-600",    gradient: "from-pink-500 to-pink-600" },
  reviews:   { bg: "bg-amber-500",   ring: "ring-amber-300",   text: "text-amber-600",   gradient: "from-amber-500 to-amber-600" },
  analytics: { bg: "bg-cyan-500",    ring: "ring-cyan-300",    text: "text-cyan-600",    gradient: "from-cyan-500 to-cyan-600" },
  dev:       { bg: "bg-orange-500",  ring: "ring-orange-300",  text: "text-orange-600",  gradient: "from-orange-500 to-orange-600" },
  team:      { bg: "bg-slate-700",   ring: "ring-slate-400",   text: "text-slate-700",   gradient: "from-slate-700 to-slate-900" },
};

const AGENT_PERSONAS: Record<string, AgentInfo> = {
  seo:       { id: "seo",       name: "NOVA",     title: "Search Intelligence",   emoji: "🔮" },
  content:   { id: "content",   name: "MUSE",     title: "Creative Engine",        emoji: "✨" },
  ads:       { id: "ads",       name: "APEX",     title: "Performance Commander",  emoji: "🎯" },
  social:    { id: "social",    name: "ECHO",     title: "Social Pulse",           emoji: "📡" },
  reviews:   { id: "reviews",   name: "SENTINEL", title: "Reputation Guardian",    emoji: "🛡️" },
  analytics: { id: "analytics", name: "ORACLE",   title: "Data Prophet",           emoji: "📊" },
  dev:       { id: "dev",       name: "FORGE",    title: "System Architect",       emoji: "🔧" },
};

const TEAM_AGENT: AgentInfo = { id: "team", name: "Ledningsgruppen", title: "Rätt agent(er) svarar automatiskt", emoji: "👥" };

function AgentAvatar({ agentId, size = "md" }: { agentId: string; size?: "sm" | "md" | "lg" }) {
  const colors = AGENT_COLORS[agentId] || AGENT_COLORS.seo;
  const persona = AGENT_PERSONAS[agentId];
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-lg",
    lg: "h-14 w-14 text-2xl",
  };

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-gradient-to-br ${colors.gradient} text-white shadow-lg`}>
      {persona?.emoji || (agentId === "team" ? "👥" : "🤖")}
    </div>
  );
}

function AgentSelector({
  agents,
  selected,
  onSelect,
}: {
  agents: string[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 p-3">
      {/* Team mode (default) */}
      <button
        onClick={() => onSelect("team")}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
          selected === "team"
            ? "bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
          selected === "team" ? "bg-white/20" : "bg-slate-200"
        }`}>
          👥
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Ledningsgruppen</p>
          <p className={`text-[11px] ${selected === "team" ? "text-white/70" : "text-slate-400"}`}>
            Naturlig diskussion
          </p>
        </div>
      </button>

      <div className="my-1 border-t border-slate-100" />

      {/* Marketing agents — 1:1 chat */}
      <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Direkt 1:1</p>
      {agents.filter((id) => id !== "dev").map((id) => {
        const persona = AGENT_PERSONAS[id];
        const colors = AGENT_COLORS[id];
        const isActive = selected === id;

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
              isActive
                ? `bg-gradient-to-r ${colors.gradient} text-white shadow-md`
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <AgentAvatar agentId={id} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{persona.name}</p>
              <p className={`text-[11px] truncate ${isActive ? "text-white/70" : "text-slate-400"}`}>
                {persona.title}
              </p>
            </div>
          </button>
        );
      })}

      {/* Dev agent — FORGE */}
      <div className="my-1 border-t border-slate-100" />
      <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">System</p>
      {(() => {
        const id = "dev";
        const persona = AGENT_PERSONAS[id];
        const colors = AGENT_COLORS[id];
        const isActive = selected === id;
        return (
          <button
            onClick={() => onSelect(id)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
              isActive
                ? `bg-gradient-to-r ${colors.gradient} text-white shadow-md`
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <AgentAvatar agentId={id} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{persona.name}</p>
              <p className={`text-[11px] truncate ${isActive ? "text-white/70" : "text-slate-400"}`}>
                {persona.title}
              </p>
            </div>
          </button>
        );
      })()}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-slate-800 px-4 py-3 text-sm text-white shadow-md">
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <p className="mt-1 text-[10px] text-white/40">
            {new Date(msg.timestamp).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200">
          <User className="h-4 w-4 text-slate-600" />
        </div>
      </div>
    );
  }

  const agentId = msg.agent || "seo";
  const colors = AGENT_COLORS[agentId] || AGENT_COLORS.seo;

  return (
    <div className="flex gap-2">
      <AgentAvatar agentId={agentId} size="sm" />
      <div className="max-w-[75%]">
        <p className={`mb-1 text-[11px] font-bold ${colors.text}`}>
          {msg.agentName || agentId.toUpperCase()} {msg.agentEmoji || ""}
        </p>
        <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-slate-700 shadow-sm border border-slate-100">
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <p className="mt-1 text-[10px] text-slate-300">
            {new Date(msg.timestamp).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Small pill showing which agents were routed to */
function RoutingPill({ agents }: { agents: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1">
      <span className="text-[10px] text-slate-400">
        {agents.map((a) => AGENT_PERSONAS[a]?.name || a.toUpperCase()).join(", ")} svarar
      </span>
    </div>
  );
}

export default function AgentChatPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>("team");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationIds, setConversationIds] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const agentIds = Object.keys(AGENT_PERSONAS);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear messages when switching agent/mode
  const handleAgentSelect = (id: string) => {
    setSelectedAgent(id);
    setMessages([]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      if (selectedAgent === "team") {
        // Team chat — intelligent routing
        const res = await fetch(`${SAMA_API_URL}/api/agents/chat/team`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversation_id: conversationId || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.conversation_id) {
            setConversationId(data.conversation_id);
          }
          // Show routing indicator
          if (data.routed_to && data.routed_to.length > 0) {
            // Add a system message showing who was routed to
            const routingMsg: ChatMessage = {
              id: `routing_${Date.now()}`,
              role: "assistant",
              content: `_${data.routed_to.map((a: string) => AGENT_PERSONAS[a]?.name || a).join(", ")} tar upp frågan_`,
              agent: "team",
              agentName: "",
              agentEmoji: "",
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, routingMsg]);
          }
          const agentMsgs: ChatMessage[] = (data.responses || []).map((r: any, i: number) => ({
            id: `agent_${r.agent}_${Date.now()}_${i}`,
            role: "assistant" as const,
            content: r.reply,
            agent: r.agent,
            agentName: r.agent_name,
            agentEmoji: r.agent_emoji,
            timestamp: r.timestamp || new Date().toISOString(),
          }));
          setMessages((prev) => [...prev, ...agentMsgs]);
        } else {
          throw new Error(`Server error: ${res.status}`);
        }
      } else {
        // Single agent 1:1
        const convId = conversationIds[selectedAgent];
        const res = await fetch(`${SAMA_API_URL}/api/agents/chat/${selectedAgent}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, conversation_id: convId || undefined }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.conversation_id) {
            setConversationIds((prev) => ({ ...prev, [selectedAgent]: data.conversation_id }));
          }
          const agentMsg: ChatMessage = {
            id: `agent_${selectedAgent}_${Date.now()}`,
            role: "assistant",
            content: data.reply,
            agent: selectedAgent,
            agentName: data.agent_name,
            agentEmoji: data.agent_emoji,
            timestamp: data.timestamp || new Date().toISOString(),
          };
          setMessages((prev) => [...prev, agentMsg]);
        } else {
          throw new Error(`Server error: ${res.status}`);
        }
      }
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `Kunde inte nå agenterna: ${e.message || "okänt fel"}`,
        agent: selectedAgent === "team" ? "analytics" : selectedAgent,
        agentName: "System",
        agentEmoji: "⚠️",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeAgent = selectedAgent === "team" ? TEAM_AGENT : AGENT_PERSONAS[selectedAgent];
  const activeColors = AGENT_COLORS[selectedAgent] || AGENT_COLORS.team;

  return (
    <div className="flex h-[calc(100vh-64px)] max-h-[calc(100vh-64px)]">
      {/* Agent sidebar */}
      <div className="w-64 flex-shrink-0 border-r bg-white overflow-y-auto">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">Agent Chat</h2>
          <p className="text-[11px] text-slate-400">Din marknadsföringsledning</p>
        </div>
        <AgentSelector agents={agentIds} selected={selectedAgent} onSelect={handleAgentSelect} />
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Chat header */}
        <div className={`flex items-center gap-3 border-b bg-gradient-to-r ${activeColors.gradient} px-5 py-3 text-white`}>
          {selectedAgent === "team" ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg">👥</div>
          ) : (
            <AgentAvatar agentId={selectedAgent} size="md" />
          )}
          <div>
            <h3 className="text-sm font-bold">{activeAgent.name}</h3>
            <p className="text-[11px] text-white/70">{activeAgent.title}</p>
          </div>
          {selectedAgent === "team" && (
            <div className="ml-auto flex -space-x-2">
              {agentIds.filter(id => id !== "dev").slice(0, 6).map((id) => (
                <div key={id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 text-xs">
                  {AGENT_PERSONAS[id].emoji}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4">{activeAgent.emoji}</div>
              <h3 className="text-lg font-bold text-slate-700">
                {selectedAgent === "team"
                  ? "Din marknadsföringsledningsgrupp"
                  : `Prata med ${activeAgent.name}`}
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md">
                {selectedAgent === "team"
                  ? "Skriv ett meddelande och rätt agent(er) svarar. Chatten fungerar som ett naturligt möte — agenterna bygger på varandras svar."
                  : `${activeAgent.name} har tillgång till sin egen data och svarar utifrån sitt expertområde.`}
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg">
                {(selectedAgent === "team" ? [
                  "Ge mig en lägesrapport",
                  "Vad bör vi prioritera just nu?",
                  "Hur ser vår pipeline ut?",
                  "Vilka problem behöver vi lösa?",
                ] : [
                  "Vad har du gjort de senaste 24 timmarna?",
                  "Vad behöver förbättras?",
                  "Visa mig dina siffror",
                  "Vilka är de viktigaste prioriteringarna?",
                ]).map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="rounded-full border bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => {
            // Routing indicator (system message)
            if (msg.agent === "team" && msg.content.startsWith("_")) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-[11px] text-slate-400 italic">
                    {msg.content.replace(/^_|_$/g, "")}
                  </span>
                </div>
              );
            }
            return <MessageBubble key={msg.id} msg={msg} />;
          })}
          {sending && (
            <div className="flex gap-2 items-center text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">
                {selectedAgent === "team" ? "Ledningsgruppen diskuterar..." : `${activeAgent.name} tänker...`}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedAgent === "team"
                  ? "Skriv till ledningsgruppen..."
                  : `Skriv till ${activeAgent.name}...`
              }
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all disabled:opacity-40 bg-gradient-to-r ${activeColors.gradient} hover:opacity-90`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400 px-1">
            Enter för att skicka, Shift+Enter för ny rad
          </p>
        </div>
      </div>
    </div>
  );
}
