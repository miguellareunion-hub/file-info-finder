import type { FileSystemTree, WebContainer } from "@webcontainer/api";

type SandboxMode = "webcontainer" | "fallback";

let bootPromise: Promise<WebContainer | null> | null = null;
let instance: WebContainer | null = null;
let sandboxMode: SandboxMode = "fallback";
let bootError: string | null = null;
const urlListeners = new Set<(url: string) => void>();
let lastUrl: string | null = null;
let fallbackPreviewDocument: string | null = null;
let fallbackObjectUrls: string[] = [];
const fallbackFiles = new Map<string, string>();

async function loadWebContainerModule() {
  if (typeof window === "undefined") {
    throw new Error("WebContainer n'est disponible que dans le navigateur.");
  }

  return import("@webcontainer/api");
}

const initialFiles: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "replit-clone-sandbox",
          type: "module",
          scripts: { start: "node index.js" },
        },
        null,
        2,
      ),
    },
  },
  "index.js": {
    file: {
      contents:
        "// Sandbox prêt. L'agent peut créer/modifier des fichiers ici via les outils.\nconsole.log('WebContainer ready');\n",
    },
  },
  "README.md": {
    file: {
      contents: "# Sandbox WebContainer\n\nL'agent Replit Assistant a accès à ce système de fichiers Node.js.\n",
    },
  },
};

function supportsWebContainer() {
  return typeof window !== "undefined" && window.crossOriginIsolated === true && typeof SharedArrayBuffer !== "undefined";
}

function seedFallbackFiles() {
  if (fallbackFiles.size > 0) return;

  fallbackFiles.set(
    "/package.json",
    JSON.stringify(
      {
        name: "replit-clone-sandbox",
        type: "module",
        scripts: { start: "node index.js" },
      },
      null,
      2,
    ),
  );
  fallbackFiles.set(
    "/index.js",
    "// Sandbox prêt. L'agent peut créer/modifier des fichiers ici via les outils.\nconsole.log('WebContainer ready');\n",
  );
  fallbackFiles.set("/README.md", "# Sandbox WebContainer\n\nL'agent Replit Assistant a accès à ce système de fichiers Node.js.\n");
}

function revokeFallbackObjectUrls() {
  for (const url of fallbackObjectUrls) {
    URL.revokeObjectURL(url);
  }
  fallbackObjectUrls = [];
}

function getMimeType(path: string) {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".ts") || path.endsWith(".tsx")) return "text/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".md") || path.endsWith(".txt")) return "text/plain";
  return "text/plain";
}

function normalizePath(p: string): string {
  let path = p.trim();
  path = path.replace(/^\/+((repo|home\/[^/]+|workspace|app))\/?/, "/");
  if (!path.startsWith("/")) path = "/" + path;
  return path;
}

function resolveLocalFile(target: string, baseDir = "/"): string | null {
  const normalized = normalizePath(target);
  if (fallbackFiles.has(normalized)) return normalized;
  // Try relative to base dir of entry HTML (e.g. /public/)
  const cleaned = target.replace(/^\.?\/?/, "");
  const candidates = [
    normalized,
    `${baseDir.replace(/\/$/, "")}/${cleaned}`,
    `/public/${cleaned}`,
    `/src/${cleaned}`,
    `/${cleaned}`,
  ];
  for (const c of candidates) {
    const n = normalizePath(c);
    if (fallbackFiles.has(n)) return n;
  }
  return null;
}

function createFallbackAssetUrl(path: string) {
  const content = fallbackFiles.get(path);
  if (content == null) return null;

  const blob = new Blob([content], { type: getMimeType(path) });
  const url = URL.createObjectURL(blob);
  fallbackObjectUrls.push(url);
  return url;
}

function buildFallbackPreviewDocument() {
  if (typeof window === "undefined") return null;

  const entry = ["/index.html", "/public/index.html", "/src/index.html", "/app/index.html"].find((candidate) => fallbackFiles.has(candidate));
  if (!entry) return null;

  revokeFallbackObjectUrls();

  let html = fallbackFiles.get(entry) ?? null;
  if (!html) return null;

  const baseDir = entry.substring(0, entry.lastIndexOf("/")) || "/";

  html = html.replace(/\b(href|src)=(["'])([^"']+)\2/gi, (full, attr, quote, rawPath: string) => {
    if (/^(https?:|data:|blob:|mailto:|tel:|#)/i.test(rawPath)) return full;
    const localFile = resolveLocalFile(rawPath, baseDir);
    if (!localFile) return full;
    const url = createFallbackAssetUrl(localFile);
    return url ? `${attr}=${quote}${url}${quote}` : full;
  });

  return html;
}

function refreshFallbackPreview() {
  fallbackPreviewDocument = buildFallbackPreviewDocument();
}

function enableFallback(reason?: unknown) {
  sandboxMode = "fallback";
  seedFallbackFiles();
  if (reason) {
    bootError = reason instanceof Error ? reason.message : String(reason);
  }
  refreshFallbackPreview();
}

export async function getContainer(): Promise<WebContainer | null> {
  if (instance) return instance;
  if (bootPromise) return bootPromise;

  if (!supportsWebContainer()) {
    enableFallback(
      "Mode de secours activé : crossOriginIsolated est absent. WebContainer ne peut pas démarrer dans ce contexte.",
    );
    return null;
  }

  bootPromise = (async () => {
    try {
      const { WebContainer } = await loadWebContainerModule();
      const wc = await WebContainer.boot();
      await wc.mount(initialFiles);
      wc.on("server-ready", (_port, url) => {
        lastUrl = url;
        urlListeners.forEach((cb) => cb(url));
      });
      sandboxMode = "webcontainer";
      bootError = null;
      instance = wc;
      return wc;
    } catch (error) {
      enableFallback(error);
      return null;
    }
  })();

  return bootPromise;
}

export function getSandboxMode(): SandboxMode {
  return sandboxMode;
}

export function getBootError(): string | null {
  return bootError;
}

export function getPreviewDocument(): string | null {
  return sandboxMode === "fallback" ? fallbackPreviewDocument : null;
}

export function onPreviewUrl(cb: (url: string) => void): () => void {
  urlListeners.add(cb);
  if (lastUrl) cb(lastUrl);
  return () => urlListeners.delete(cb);
}

export function getLastPreviewUrl(): string | null {
  return lastUrl;
}

async function ensureDir(wc: WebContainer, filePath: string) {
  const dir = filePath.split("/").slice(0, -1).join("/");
  if (!dir || dir === "/") return;
  await wc.fs.mkdir(dir, { recursive: true });
}

export async function writeFile(path: string, contents: string): Promise<void> {
  const p = normalizePath(path);
  const wc = await getContainer();

  if (!wc || sandboxMode === "fallback") {
    fallbackFiles.set(p, contents);
    refreshFallbackPreview();
    return;
  }

  await ensureDir(wc, p);
  await wc.fs.writeFile(p, contents);
}

export async function readFile(path: string): Promise<string> {
  const p = normalizePath(path);
  const wc = await getContainer();

  if (!wc || sandboxMode === "fallback") {
    const content = fallbackFiles.get(p);
    if (content == null) throw new Error(`Fichier introuvable: ${p}`);
    return content;
  }

  return await wc.fs.readFile(p, "utf-8");
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dir = "/"): Promise<string[]> {
  const normalizedDir = normalizePath(dir);
  const wc = await getContainer();

  if (!wc || sandboxMode === "fallback") {
    return [...fallbackFiles.keys()].filter((file) => file.startsWith(normalizedDir)).sort();
  }

  const container = wc;

  const out: string[] = [];
  async function walk(d: string) {
    const entries = await container.fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = (d === "/" ? "" : d) + "/" + e.name;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(normalizedDir);
  return out.sort();
}

export interface RunResult {
  exitCode: number;
  output: string;
}

export async function runCommand(command: string, opts: { background?: boolean } = {}): Promise<RunResult> {
  const wc = await getContainer();

  if (!wc || sandboxMode === "fallback") {
    refreshFallbackPreview();
    return {
      exitCode: 0,
      output: [
        `Mode de secours sans WebContainer : commande simulée${opts.background ? " en arrière-plan" : ""}.`,
        `Commande: ${command}`,
        "Les fichiers restent modifiables et la preview statique s'affiche dès qu'un index.html existe.",
      ].join("\n"),
    };
  }

  const proc = await wc.spawn("jsh", ["-c", command]);
  let output = "";
  const reader = proc.output.getReader();

  const pump = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output += value;
    }
  })();

  if (opts.background) {
    void pump;
    return { exitCode: 0, output: "(background) " + command };
  }

  const exitCode = await proc.exit;
  await pump;
  return { exitCode, output };
}

export function isServerCommand(cmd: string): boolean {
  return /\b(npm|bun|pnpm|yarn|node)\s+(run\s+)?(dev|start|serve)\b/.test(cmd) ||
    (/\bnode\s+\S+\.js\b/.test(cmd) && /server|listen/.test(cmd));
}
