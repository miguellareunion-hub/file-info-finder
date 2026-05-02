import { useEffect, useRef, useState, useCallback } from "react";
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
import { getContainer, listFiles, readFile, onPreviewUrl, getLastPreviewUrl } from "@/lib/webcontainer";
import { stripProposedTags } from "@/lib/proposed-actions";

export function AgentChat() {
  const [config, setConfig] = useState<LMStudioConfig>(DEFAULT_LMSTUDIO_CONFIG);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"unknown" | "ok" | "ko">("unknown");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(getLastPreviewUrl());
  const [wcReady, setWcReady] = useState(false);
  const [wcError, setWcError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot WebContainer + listen for preview URL
  useEffect(() => {
    let unsub: (() => void) | undefined;
    getContainer()
      .then(() => {
        setWcReady(true);
        return refreshFiles();
      })
      .catch((e) => setWcError(e instanceof Error ? e.message : String(e)));
    unsub = onPreviewUrl((url) => setPreviewUrl(url));
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const list = await listFiles("/");
      setFiles(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!selectedFile) return;
    readFile(selectedFile).then(setFileContent).catch((e) => setFileContent(`(error: ${e})`));
  }, [selectedFile, files]);

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
      setError(e instanceof Error ? e.message : "Connexion impossible");
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
      await runAgentLoop(
        config,
        base,
        (m) => setMessages((prev) => [...prev, m]),
        () => void refreshFiles(),
      );
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
    <div className="mx-auto flex h-screen max-w-[1800px] flex-col gap-3 p-3">
      <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Replit Assistant Clone</h1>
            <p className="text-xs text-muted-foreground">
              {REPLIT_TOOLS.length} tools · {config.provider === "openai" ? "OpenAI" : "LM Studio"} ·
              WebContainer {wcReady ? "✓ prêt" : wcError ? "✗ KO" : "…boot"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "ok" ? "default" : status === "ko" ? "destructive" : "secondary"}>
              {status === "ok" ? "Connecté" : status === "ko" ? "Inaccessible" : "Statut inconnu"}
            </Badge>
            <Button size="sm" variant="outline" onClick={ping}>Tester</Button>
            <Button size="sm" variant="outline" onClick={resetConfig}>Réinit. config</Button>
            <Button size="sm" variant="ghost" onClick={reset}>Reset chat</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1">
            <Button size="sm" variant={config.provider === "lmstudio" ? "default" : "outline"} onClick={() => switchProvider("lmstudio")}>LM Studio</Button>
            <Button size="sm" variant={config.provider === "openai" ? "default" : "outline"} onClick={() => switchProvider("openai")}>OpenAI</Button>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="text-xs font-medium text-muted-foreground">Base URL</label>
            <Input
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              onBlur={(e) => setConfig({ ...config, baseUrl: normalizeBaseUrl(e.target.value) })}
            />
          </div>
          <div className="w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Modèle</label>
            <Input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
          </div>
          {config.provider === "openai" && (
            <div className="w-[260px]">
              <label className="text-xs font-medium text-muted-foreground">API Key</label>
              <Input
                type="password"
                value={config.apiKey ?? ""}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          )}
        </div>
      </header>

      {wcError && (
        <Card className="border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          WebContainer KO : {wcError}. Requiert Chrome/Edge/Firefox + COOP/COEP (déjà configurés). Recharge la page.
        </Card>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[1fr_320px_1fr]">
        {/* Colonne 1 : Chat */}
        <div className="flex min-h-0 flex-col gap-2">
          <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-border bg-background p-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                <p>Démarre une conversation. L'agent peut créer des fichiers et lancer des serveurs Node.js dans le sandbox →</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
              {busy && <div className="text-xs italic text-muted-foreground">L'agent réfléchit…</div>}
            </div>
          </div>

          {error && (
            <Card className="border-destructive bg-destructive/10 p-2 text-xs text-destructive">{error}</Card>
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
              placeholder="Demande à l'agent… (ex: crée un serveur Express qui dit Hello)"
              rows={2}
              className="flex-1"
            />
            <Button onClick={() => void send()} disabled={busy || !input.trim()}>Envoyer</Button>
          </div>
        </div>

        {/* Colonne 2 : Fichiers générés */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fichiers ({files.length})</span>
            <Button size="sm" variant="ghost" onClick={() => void refreshFiles()}>↻</Button>
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-2 divide-y divide-border">
            <div className="overflow-y-auto p-2">
              {files.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Aucun fichier encore.</div>}
              {files.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFile(f)}
                  className={`block w-full truncate rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted ${
                    selectedFile === f ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="overflow-auto bg-muted/30 p-2">
              {selectedFile ? (
                <>
                  <div className="mb-1 font-mono text-[10px] text-muted-foreground">{selectedFile}</div>
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">{fileContent}</pre>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Sélectionne un fichier pour voir son contenu.</div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne 3 : Preview WebContainer */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="truncate text-[10px] text-muted-foreground hover:underline">
                {previewUrl}
              </a>
            )}
          </div>
          <div className="flex-1 bg-background">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-full w-full border-0"
                title="WebContainer preview"
                allow="cross-origin-isolated"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Aucun serveur lancé. Demande à l'agent de créer + lancer un serveur (ex: <code>npm init -y && npm i express && node server.js</code>) — la preview s'affichera ici dès qu'un port s'ouvre.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground">
          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
        </div>
      </div>
    );
  }
  if (msg.role === "assistant") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] rounded-lg border border-border bg-card px-3 py-2 text-card-foreground">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assistant</div>
          {msg.content && (
            <div className="prose prose-sm max-w-none text-sm dark:prose-invert">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
          {msg.tool_calls?.map((tc) => (
            <div key={tc.id} className="mt-2 rounded border border-border bg-muted p-2 font-mono text-[11px]">
              <div className="font-semibold text-foreground">→ {tc.function.name}</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-muted-foreground">{tc.function.arguments}</pre>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (msg.role === "tool") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            tool · {msg.name}
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {msg.content}
          </pre>
        </div>
      </div>
    );
  }
  return null;
}
