"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare, Loader2, ArrowDown, Trash2 } from "lucide-react";

interface AgentChatProps {
  agentName: string;
  apiUrl: string;
  placeholder?: string;
  examplePrompts?: string[];
}

export default function AgentChat({ agentName, apiUrl, placeholder, examplePrompts }: AgentChatProps) {
  const storageKey = `sama-chat-${agentName}`;
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Persist chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
    } catch { /* storage full or unavailable */ }
  }, [chatHistory, storageKey]);

  const clearHistory = useCallback(() => {
    setChatHistory([]);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      setShowScrollDown(scrollHeight - scrollTop - clientHeight > 50);
    }
  };


  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const history = chatHistory.map(m => ({ role: m.role, content: m.content }));
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, { role: "agent", content: data.response }]);
      } else {
        setChatHistory(prev => [...prev, { 
          role: "agent", 
          content: "Sorry, I couldn't process that request. Please try again." 
        }]);
      }
    } catch {
      setChatHistory(prev => [...prev, { 
        role: "agent", 
        content: "Error connecting to agent. Please check backend connection." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Chat with {agentName} Agent</h3>
          </div>
          {chatHistory.length > 0 && (
            <button onClick={clearHistory} className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50" title="Clear chat history">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {placeholder || `Ask ${agentName} to create content, analyze gaps, or answer questions.`}
        </p>
      </div>

      <div ref={chatContainerRef} onScroll={handleScroll} className="h-[500px] overflow-y-auto p-4 space-y-3 relative">
        {chatHistory.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Start a conversation with the {agentName} agent...
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user" 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-100 text-slate-900"
              }`}>
                <div className="text-sm chat-markdown">
                  {msg.role === "user"
                    ? <p className="whitespace-pre-wrap">{msg.content}</p>
                    : <MarkdownContent text={msg.content} />
                  }
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            </div>
          </div>
        )}
      </div>
      {showScrollDown && (
        <div className="flex justify-center -mt-10 mb-2 relative z-10">
          <button onClick={scrollToBottom} className="rounded-full bg-blue-600 p-2 text-white shadow-lg hover:bg-blue-700">
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-h-32"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
        {examplePrompts && examplePrompts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {examplePrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => setMessage(prompt)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple markdown renderer — handles **bold**, `code`, ```code blocks```,
 * - lists, numbered lists, and line breaks. No external deps.
 */
function MarkdownContent({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Code block
        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
          return (
            <pre key={bi} className="rounded-md bg-slate-800 text-slate-100 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
              <code>{code}</code>
            </pre>
          );
        }

        // List items
        const listLines = trimmed.split('\n');
        const isList = listLines.every(l => /^\s*[-*•]\s/.test(l) || /^\s*\d+[.)]\s/.test(l) || l.trim() === '');
        if (isList && listLines.length > 1) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-0.5">
              {listLines.filter(l => l.trim()).map((l, li) => (
                <li key={li} className="text-sm">
                  <InlineMarkdown text={l.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.)]\s*/, '')} />
                </li>
              ))}
            </ul>
          );
        }

        // Heading-like lines (### or ## or #)
        if (/^#{1,3}\s/.test(trimmed)) {
          const level = trimmed.match(/^(#{1,3})/)?.[1].length || 1;
          const headText = trimmed.replace(/^#{1,3}\s+/, '');
          const cls = level === 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-bold' : 'text-sm font-semibold';
          return <p key={bi} className={cls}><InlineMarkdown text={headText} /></p>;
        }

        // Regular paragraph (may contain line breaks)
        return (
          <p key={bi} className="whitespace-pre-wrap">
            <InlineMarkdown text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Process inline: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code inline
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(<code key={key++} className="rounded bg-slate-200 px-1 py-0.5 text-xs font-mono text-slate-800">{codeMatch[2]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++}>{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // No more inline formatting
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}
