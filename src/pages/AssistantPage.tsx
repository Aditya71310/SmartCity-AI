import React, { useState } from 'react';
import { ArrowUpRight, Bot, Send, Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import type { NavPageId } from '../components/SidebarLayout';
import type { CopilotMessage } from '../types/smartcity';

const SUGGESTED_PROMPTS = [
  'Which areas have the most unresolved complaints?',
  'Show me high-priority waste incidents.',
  'Which roads are experiencing severe congestion?',
  'What is the current city-wide AQI?',
  'Which department has the highest pending workload?',
  'Generate a weekly city performance summary.',
];

export function AssistantPage({ onNavigate }: { onNavigate: (page: NavPageId) => void }) {
  const { notify } = useAuth();
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello, I am **SmartCity Copilot**.\n\nI query live municipal records across Waste, Traffic, Environment, Infrastructure, and Citizen Reports so every figure is grounded in your database. Select a prompt below or ask any operational question.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await apiRequest<{
        reply: Omit<CopilotMessage, 'id' | 'role' | 'timestamp'>;
      }>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, history }),
      });

      const assistantMsg: CopilotMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        ...res.reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      notify('Copilot error', (err as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/20 bg-white dark:bg-[#101D2D] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00C8FF] to-[#00D69A] flex items-center justify-center text-[#070D18] shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">SmartCity Copilot</h1>
            <p className="text-xs text-slate-500 dark:text-[#91A2B8]">
              Gemini-powered urban intelligence assistant grounded in live city database queries
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-[#00C8FF] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Database Function Calling Active
        </span>
      </div>

      {/* Suggested Prompts */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            disabled={sending}
            onClick={() => sendMessage(prompt)}
            className="text-left rounded-xl border border-slate-200 dark:border-[#82AAD2]/20 bg-white dark:bg-[#101D2D] hover:border-[#00C8FF]/50 hover:bg-slate-50 dark:hover:bg-[#14243A] px-3.5 py-2 text-xs font-medium transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Transcript */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#82AAD2]/20 bg-white dark:bg-[#101D2D] flex flex-col h-[540px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 space-y-3 ${
                  msg.role === 'user'
                    ? 'bg-[#00C8FF] text-[#070D18]'
                    : 'bg-slate-100 dark:bg-[#14243A] text-slate-900 dark:text-[#F4F7FC] border border-slate-200 dark:border-[#82AAD2]/15'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>

                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <p className="text-[11px] font-mono text-slate-500 dark:text-[#91A2B8]">
                    Queried tools: {msg.toolsUsed.join(' · ')}
                  </p>
                )}

                {msg.chart && msg.chart.data.length > 0 && (
                  <div className="rounded-xl bg-white dark:bg-[#070D18]/80 border border-slate-200 dark:border-[#82AAD2]/15 p-3">
                    <p className="text-xs font-semibold text-[#00C8FF] mb-2">{msg.chart.title}</p>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={msg.chart.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(130,170,210,0.12)" />
                        <XAxis dataKey="name" stroke="#91A2B8" fontSize={11} />
                        <YAxis stroke="#91A2B8" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#101D2D',
                            borderColor: 'rgba(130,170,210,0.25)',
                            borderRadius: 10,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="value" fill="#00C8FF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {msg.referencedIncidents && msg.referencedIncidents.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-[#91A2B8]">
                      Referenced Incidents (Click to inspect module)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.referencedIncidents.map((inc) => (
                        <button
                          key={inc.id}
                          onClick={() => onNavigate(inc.module as NavPageId)}
                          className="flex items-center justify-between gap-2 text-left rounded-xl bg-white dark:bg-[#070D18]/70 border border-slate-200 dark:border-[#82AAD2]/20 hover:border-[#00C8FF]/50 px-3 py-2 text-xs transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] text-[#00C8FF]">{inc.code}</span>
                            <p className="truncate font-medium">{inc.title}</p>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#00C8FF] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 dark:bg-[#14243A] px-4 py-3 text-xs text-slate-500 dark:text-[#91A2B8]">
                Querying city telemetry & synthesizing response...
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-3.5 border-t border-slate-200 dark:border-[#82AAD2]/15 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask SmartCity Copilot about Mumbai incidents, traffic, AQI, or department workloads..."
            className="flex-1 rounded-xl bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#82AAD2]/20 px-4 py-2.5 text-sm focus:outline-none focus:border-[#00C8FF]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-[#00C8FF] hover:bg-[#00B4E6] disabled:opacity-50 text-[#070D18] font-semibold text-xs px-4 py-2.5"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
