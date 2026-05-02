import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AgentChatPanel } from "@/components/AgentChatPanel";
import {
  getBootError,
  getContainer,
  getLastPreviewUrl,
  getPreviewDocument,
  getSandboxMode,
  listFiles,
  onPreviewUrl,
  readFile,
} from "@/lib/webcontainer";
import {
  Play, Plus, Search, PanelRight, Sparkles, FileCode, Eye, Folder,
  RefreshCw, ExternalLink, ChevronRight, ChevronDown, Globe2,
} from "lucide-react";

export const Route = createFileRoute("/agent")({
  component: AgentWorkspace,
  validateSearch: (s: Record<string, unknown>) => ({ p: (s.p as string) ?? "" }),
  head: () => ({
    meta: [
      { title: "Workspace — Replit Clone" },
      { name: "description", content: "Construisez votre projet avec un agent IA." },
    ],
  }),
});

type Tab = "preview" | "files";

function AgentWorkspace() {
  const { p: initialPrompt } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("preview");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(getLastPreviewUrl());
  const [previewDocument, setPreviewDocument] = useState<string | null>(getPreviewDocument());
  const [sandboxMode, setSandboxMode] = useState<"webcontainer" | "fallback">(getSandboxMode());
  const [wcError, setWcError] = useState<string | null>(null);
  const [projectName] = useState("Untitled Project");

  const refresh = useCallback(async () => {
    try {
      const list = await listFiles("/");
      setFiles(list);
      setSandboxMode(getSandboxMode());
      setPreviewDocument(getPreviewDocument());
      setWcError(getBootError());
    } catch {}
  }, []);

  useEffect(() => {
    getContainer().then(() => {
      setSandboxMode(getSandboxMode());
      setWcError(getBootError());
      setPreviewDocument(getPreviewDocument());
      void refresh();
    }).catch((e) => setWcError(e instanceof Error ? e.message : String(e)));
    const unsub = onPreviewUrl((url) => { setPreviewUrl(url); setTab("preview"); });
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    if (!selectedFile) return;
    readFile(selectedFile).then(setFileContent).catch((e) => setFileContent(`(error: ${e})`));
  }, [selectedFile, files]);

  const hasPreview = !!previewUrl || !!previewDocument;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0c] text-neutral-200 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-3 border-b border-neutral-800 bg-[#0e0e10] shrink-0">
        <div className="flex items-center gap-2">
          <a href="/" className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-pink-500 grid place-items-center">
            <Sparkles className="w-4 h-4 text-white" />
          </a>
          <div className="flex items-center gap-1.5 bg-[#161618] hover:bg-[#1f1f22] cursor-pointer rounded-md px-3 py-1.5 text-sm border border-neutral-800">
            <Folder className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-medium">{projectName}</span>
            <ChevronDown className="w-3 h-3 text-neutral-500" />
          </div>
          <button className="flex items-center gap-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 rounded-md px-2.5 py-1.5 text-xs font-medium border border-green-600/20">
            <Play className="w-3 h-3 fill-current" /> Run
          </button>
        </div>
        <div className="flex-1 max-w-md mx-4">
          <div className="flex items-center gap-2 bg-[#161618] border border-neutral-800 rounded-md px-2.5 py-1 text-xs text-neutral-500">
            <Search className="w-3 h-3" />
            <span>Rechercher dans le projet…</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs text-neutral-300 hover:text-white px-2 py-1">Invite</button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white rounded-md px-3 py-1.5 text-xs font-medium">Publish</button>
          <div className="w-px h-5 bg-neutral-800 mx-1" />
          <button className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400">
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {wcError && (
        <div className="px-3 py-1.5 text-[11px] bg-amber-500/5 border-b border-amber-500/20 text-amber-400/80">
          {sandboxMode === "fallback" ? "Mode secours actif — fichiers visibles, preview HTML disponible." : `Sandbox: ${wcError}`}
        </div>
      )}

      {/* Main split */}
      <div className="flex-1 flex min-h-0">
        {/* Left: chat */}
        <div className="w-[420px] shrink-0 border-r border-neutral-800 min-h-0">
          <AgentChatPanel onFilesChanged={refresh} initialPrompt={initialPrompt || undefined} />
        </div>

        {/* Center: file tree */}
        <div className="w-[240px] shrink-0 border-r border-neutral-800 flex flex-col bg-[#0e0e10] min-h-0">
          <div className="h-9 flex items-center justify-between px-3 border-b border-neutral-800">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-neutral-500">
              <FileCode className="w-3 h-3" /> Files ({files.length})
            </div>
            <button onClick={() => void refresh()} className="p-1 rounded hover:bg-neutral-800 text-neutral-500">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {files.length === 0 ? (
              <div className="px-3 py-8 text-center text-[11px] text-neutral-600">
                Aucun fichier.<br />Demandez à l'agent.
              </div>
            ) : (
              files.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFile(f)}
                  className={`group w-full flex items-center gap-1.5 px-3 py-1 text-left font-mono text-[11px] truncate ${
                    selectedFile === f ? "bg-orange-500/10 text-orange-400 border-l-2 border-orange-500" : "text-neutral-400 hover:bg-neutral-800/50 border-l-2 border-transparent"
                  }`}
                >
                  <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 shrink-0" />
                  <span className="truncate">{f.replace(/^\//, "")}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: preview / code viewer */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0c]">
          <div className="h-9 border-b border-neutral-800 flex items-center px-2 gap-1 bg-[#0e0e10]">
            <button
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs ${tab === "preview" ? "bg-[#1f1f22] text-white" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              <Eye className="w-3 h-3" /> Preview
            </button>
            <button
              onClick={() => setTab("files")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs ${tab === "files" ? "bg-[#1f1f22] text-white" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              <FileCode className="w-3 h-3" /> Code {selectedFile && <span className="text-neutral-600">· {selectedFile.split("/").pop()}</span>}
            </button>
            <div className="ml-auto flex items-center gap-2 pr-1">
              {tab === "preview" && previewUrl && (
                <a href={previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-orange-400 px-2 py-1 rounded">
                  <Globe2 className="w-3 h-3" /> {new URL(previewUrl).host}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {tab === "preview" ? (
              hasPreview ? (
                previewUrl ? (
                  <iframe src={previewUrl} className="h-full w-full border-0 bg-white" title="Preview" />
                ) : (
                  <iframe srcDoc={previewDocument!} className="h-full w-full border-0 bg-white" title="Preview" sandbox="allow-scripts allow-same-origin" />
                )
              ) : (
                <EmptyPreview />
              )
            ) : (
              <CodeView path={selectedFile} content={fileContent} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="h-full grid place-items-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 grid place-items-center">
          <Eye className="w-7 h-7 text-orange-400" />
        </div>
        <div className="text-sm font-medium text-neutral-300 mb-1">Aucune preview pour l'instant</div>
        <div className="text-xs text-neutral-500">Demandez à l'agent de créer un projet — la preview apparaîtra automatiquement dès qu'un serveur démarre ou qu'un fichier HTML est généré.</div>
      </div>
    </div>
  );
}

function CodeView({ path, content }: { path: string | null; content: string }) {
  if (!path) {
    return (
      <div className="h-full grid place-items-center text-xs text-neutral-500">
        Sélectionnez un fichier pour voir son contenu.
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto">
      <div className="px-4 py-2 text-[10px] font-mono text-neutral-500 border-b border-neutral-800 bg-[#0e0e10] sticky top-0">{path}</div>
      <pre className="p-4 font-mono text-[12px] text-neutral-300 whitespace-pre-wrap break-all">{content}</pre>
    </div>
  );
}
