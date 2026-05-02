import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Settings2, RotateCcw, Plug, Loader2, Sparkles, Wrench } from "lucide-react";
import {
  type ChatMessage,
  type LMStudioConfig,
  type Provider,
  DEFAULT_LMSTUDIO_CONFIG,
  DEFAULT_OPENAI_CONFIG,
  REPLIT_SYSTEM_PROMPT,
  REPLIT_TOOLS,
  buildEndpoint,
  normalizeBaseUrl,
  runAgentLoop,
} from "@/lib/replit-agent";
import { stripProposedTags } from "@/lib/proposed-actions";

type Props = {
  onFilesChanged?: () => void;
  initialPrompt?: string;
};

export function AgentChatPanel({ onFilesChanged, initialPrompt }: Props) {
  const [config, setConfig] = useState<LMStudioConfig>(DEFAULT_LMSTUDIO_CONFIG);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"unknown" | "ok" | "ko">("unknown");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    const base: ChatMessage[] = [
      { role: "system", content: REPLIT_SYSTEM_PROMPT },
      ...messages,
      userMsg,
    ];
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      await runAgentLoop(config, base, (m) => setMessages((prev) => [...prev, m]), () => onFilesChanged?.());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [busy, config, messages, onFilesChanged]);

  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialPrompt);
    }
  }, [initialPrompt, send]);

  async function ping() {
    setStatus("unknown");
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      const r = await fetch(buildEndpoint(config, "models"), { headers });
      setStatus(r.ok ? "ok" : "ko");
      if (!r.ok) setError(`HTTP ${r.status}`);
    } catch (e) {
      setStatus("ko");
      setError(e instanceof Error ? e.message : "Connexion impossible");
    }
  }

  function switchProvider(p: Provider) {
    setConfig(p === "openai" ? DEFAULT_OPENAI_CONFIG : DEFAULT_LMSTUDIO_CONFIG);
    setStatus("unknown");
  }

  return (
    <div className="flex h-full flex-col bg-[#0e0e10]">
      {/* Header */}
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-pink-500 grid place-items-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">Agent</div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                <span className={`w-1.5 h-1.5 rounded-full ${status === "ok" ? "bg-green-500" : status === "ko" ? "bg-red-500" : "bg-neutral-500"}`} />
                {config.provider === "openai" ? "OpenAI" : "LM Studio"} · {REPLIT_TOOLS.length} tools
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={ping} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400" title="Tester connexion">
              <Plug className="w-4 h-4" />
            </button>
            <button onClick={() => setMessages([])} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400" title="Reset">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowSettings((v) => !v)} className={`p-1.5 rounded ${showSettings ? "bg-neutral-800 text-orange-400" : "hover:bg-neutral-800 text-neutral-400"}`}>
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mt-3 space-y-2 rounded-md border border-neutral-800 bg-[#161618] p-3">
            <div className="flex gap-1">
              {(["lmstudio", "openai"] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => switchProvider(p)}
                  className={`flex-1 rounded px-2 py-1 text-xs ${config.provider === p ? "bg-orange-500 text-white" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"}`}
                >
                  {p === "lmstudio" ? "LM Studio" : "OpenAI"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-neutral-500">Base URL</label>
              <input
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                onBlur={(e) => setConfig({ ...config, baseUrl: normalizeBaseUrl(e.target.value) })}
                className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-neutral-500">Modèle</label>
              <input
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-orange-500"
              />
            </div>
            {config.provider === "openai" && (
              <div>
                <label className="text-[10px] uppercase tracking-wide text-neutral-500">API Key</label>
                <input
                  type="password"
                  value={config.apiKey ?? ""}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-orange-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !busy && (
          <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 px-6">
            <Sparkles className="w-8 h-8 mb-3 text-orange-500/60" />
            <div className="text-sm font-medium text-neutral-300 mb-1">Démarrez votre projet</div>
            <div className="text-xs">L'agent peut créer des fichiers, installer des paquets et lancer des serveurs Node.js.</div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 italic">
            <Loader2 className="w-3 h-3 animate-spin" /> L'agent réfléchit…
          </div>
        )}
        {error && (
          <div className="rounded border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-400">{error}</div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-800 p-3">
        <div className="rounded-xl border border-neutral-800 bg-[#161618] p-2 focus-within:border-orange-500/50 transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Décrivez ce que vous voulez construire…"
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 outline-none px-2 py-1"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="text-[10px] text-neutral-600 px-2">Enter pour envoyer · Shift+Enter pour saut de ligne</div>
            <button
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" /> Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-orange-500 text-white px-3.5 py-2 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  if (msg.role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-neutral-800 bg-[#161618] px-3.5 py-2.5 text-neutral-200">
          {msg.content && (
            <div className="prose prose-sm prose-invert max-w-none text-sm [&_p]:my-1 [&_pre]:bg-neutral-950 [&_pre]:border [&_pre]:border-neutral-800">
              <ReactMarkdown>{stripProposedTags(msg.content || "")}</ReactMarkdown>
            </div>
          )}
          {msg.tool_calls?.map((tc) => (
            <div key={tc.id} className="mt-2 rounded-md border border-neutral-800 bg-neutral-950 p-2 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-orange-400 font-semibold">
                <Wrench className="w-3 h-3" /> {tc.function.name}
              </div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-neutral-500">{tc.function.arguments}</pre>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (msg.role === "tool") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] rounded-md border border-dashed border-neutral-800 bg-neutral-900/50 px-3 py-1.5">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">tool · {msg.name}</div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-neutral-500">{msg.content}</pre>
        </div>
      </div>
    );
  }
  return null;
}
