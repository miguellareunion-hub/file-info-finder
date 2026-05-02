import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function AgentChat() {
  const [config, setConfig] = useState<LMStudioConfig>(DEFAULT_LMSTUDIO_CONFIG);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"unknown" | "ok" | "ko">("unknown");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ping() {
    setStatus("unknown");
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      const r = await fetch(buildEndpoint(config, "models"), { headers });
      setStatus(r.ok ? "ok" : "ko");
      if (!r.ok) setError(`HTTP ${r.status} sur /models`);
    } catch (e) {
      setStatus("ko");
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const isHttp = /^http:\/\//i.test(config.baseUrl);
      if (isHttps && isHttp) {
        setError(
          "Mixed Content bloqué : la preview Lovable est en HTTPS mais le backend est en HTTP. " +
          "Solutions : (1) ouvrir l'app en HTTP en local, (2) exposer via HTTPS (ngrok/cloudflared), (3) utiliser OpenAI."
        );
      } else {
        setError(e instanceof Error ? e.message : "Connexion impossible (CORS ? pare-feu ? IP joignable ?)");
      }
    }
  }

  function switchProvider(p: Provider) {
    setConfig(p === "openai" ? DEFAULT_OPENAI_CONFIG : DEFAULT_LMSTUDIO_CONFIG);
    setStatus("unknown");
    setError(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
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
      await runAgentLoop(config, base, (m) => setMessages((prev) => [...prev, m]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
  }

  function resetConfig() {
    setConfig(config.provider === "openai" ? DEFAULT_OPENAI_CONFIG : DEFAULT_LMSTUDIO_CONFIG);
    setStatus("unknown");
    setError(null);
  }

  return (
    <div className="mx-auto flex h-screen max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Replit Assistant Clone</h1>
            <p className="text-xs text-muted-foreground">
              System prompt + {REPLIT_TOOLS.length} tools — backend : {config.provider === "openai" ? "OpenAI" : "LM Studio"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === "ok" ? "default" : status === "ko" ? "destructive" : "secondary"}>
              {status === "ok" ? "Connecté" : status === "ko" ? "Inaccessible" : "Statut inconnu"}
            </Badge>
            <Button size="sm" variant="outline" onClick={ping}>Tester</Button>
            <Button size="sm" variant="outline" onClick={resetConfig}>Réinit. config</Button>
            <Button size="sm" variant="ghost" onClick={reset}>Reset chat</Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={config.provider === "lmstudio" ? "default" : "outline"}
            onClick={() => switchProvider("lmstudio")}
          >
            LM Studio
          </Button>
          <Button
            size="sm"
            variant={config.provider === "openai" ? "default" : "outline"}
            onClick={() => switchProvider("openai")}
          >
            OpenAI
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Base URL {config.provider === "openai" ? "OpenAI" : "LM Studio"}
            </label>
            <Input
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              onBlur={(e) => setConfig({ ...config, baseUrl: normalizeBaseUrl(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Modèle</label>
            <Input
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder={config.provider === "openai" ? "gpt-4o-mini" : "google/gemma-4-4b"}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              API Key {config.provider === "openai" ? "(requise)" : "(optionnel)"}
            </label>
            <Input
              type="password"
              value={config.apiKey ?? ""}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder={config.provider === "openai" ? "sk-..." : "sk-lm-..."}
            />
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-border bg-background p-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div className="max-w-md">
              <p className="mb-2 font-medium text-foreground">Démarre une conversation avec l'agent.</p>
              <p>Il se comporte exactement comme le Replit Assistant : il propose des changements de fichiers, des commandes shell, et peut appeler ses 18 outils.</p>
              <p className="mt-2 text-xs">Note : LM Studio doit être joignable depuis le navigateur (CORS activé). En HTTPS, l'IP HTTP publique sera bloquée par Mixed Content — utilise ngrok/cloudflared pour exposer en HTTPS.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {busy && <div className="text-xs italic text-muted-foreground">L'agent réfléchit…</div>}
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Demande quelque chose à l'assistant… (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
          rows={2}
          className="flex-1"
        />
        <Button onClick={() => void send()} disabled={busy || !input.trim()}>
          Envoyer
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
        </div>
      </div>
    );
  }
  if (msg.role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-lg border border-border bg-card px-4 py-3 text-card-foreground">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assistant</div>
          {msg.content && (
            <div className="prose prose-sm max-w-none text-sm dark:prose-invert">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
          {msg.tool_calls?.map((tc) => (
            <div key={tc.id} className="mt-2 rounded border border-border bg-muted p-2 font-mono text-xs">
              <div className="font-semibold text-foreground">→ tool call: {tc.function.name}</div>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-muted-foreground">{tc.function.arguments}</pre>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (msg.role === "tool") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            tool result · {msg.name}
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {msg.content}
          </pre>
        </div>
      </div>
    );
  }
  return null;
}
