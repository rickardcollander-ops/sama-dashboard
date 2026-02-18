"use client";

import { useState } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";

interface AgentChatProps {
  agentName: string;
  apiUrl: string;
  placeholder?: string;
}

export default function AgentChat({ agentName, apiUrl, placeholder }: AgentChatProps) {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
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

      <div className="h-64 overflow-y-auto p-4 space-y-3">
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

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
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
        <p className="mt-2 text-xs text-slate-500">
          Example: "Create a blog post about reducing customer churn" or "Analyze content gaps for Q1"
        </p>
      </div>
    </div>
  );
}
