"use client";

import { useState, useEffect, useRef } from "react";
import { Send, MessageSquare, Loader2, ArrowDown } from "lucide-react";

interface AgentChatProps {
  agentName: string;
  apiUrl: string;
  placeholder?: string;
  examplePrompts?: string[];
}

export default function AgentChat({ agentName, apiUrl, placeholder, examplePrompts }: AgentChatProps) {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Start fresh each session — no persistent history loaded

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
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: "agent", 
        content: "Error connecting to agent. Please check backend connection." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Chat with {agentName} Agent</h3>
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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
