import { WebContainer, type FileSystemTree } from "@webcontainer/api";

let bootPromise: Promise<WebContainer> | null = null;
let instance: WebContainer | null = null;
const urlListeners = new Set<(url: string) => void>();
let lastUrl: string | null = null;

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

export async function getContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const wc = await WebContainer.boot();
    await wc.mount(initialFiles);
    wc.on("server-ready", (_port, url) => {
      lastUrl = url;
      urlListeners.forEach((cb) => cb(url));
    });
    instance = wc;
    return wc;
  })();
  return bootPromise;
}

export function onPreviewUrl(cb: (url: string) => void): () => void {
  urlListeners.add(cb);
  if (lastUrl) cb(lastUrl);
  return () => urlListeners.delete(cb);
}

export function getLastPreviewUrl(): string | null {
  return lastUrl;
}

// Convertit un chemin absolu (/repo/foo.txt, /home/x.js) en chemin relatif
// pour le FS du WebContainer (qui s'enracine à /).
function normalizePath(p: string): string {
  let path = p.trim();
  // retire un éventuel /repo, /home/runner, etc.
  path = path.replace(/^\/+(repo|home\/[^/]+|workspace|app)\/?/, "/");
  if (!path.startsWith("/")) path = "/" + path;
  return path;
}

async function ensureDir(wc: WebContainer, filePath: string) {
  const dir = filePath.split("/").slice(0, -1).join("/");
  if (!dir || dir === "/") return;
  await wc.fs.mkdir(dir, { recursive: true });
}

export async function writeFile(path: string, contents: string): Promise<void> {
  const wc = await getContainer();
  const p = normalizePath(path);
  await ensureDir(wc, p);
  await wc.fs.writeFile(p, contents);
}

export async function readFile(path: string): Promise<string> {
  const wc = await getContainer();
  const p = normalizePath(path);
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
  const wc = await getContainer();
  const out: string[] = [];
  async function walk(d: string) {
    const entries = await wc.fs.readdir(d, { withFileTypes: true });
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
  await walk(dir);
  return out.sort();
}

export interface RunResult {
  exitCode: number;
  output: string;
}

// Exécute une commande shell. On la passe par jsh -c "..." pour gérer pipes/&&.
export async function runCommand(command: string, opts: { background?: boolean } = {}): Promise<RunResult> {
  const wc = await getContainer();
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
    // On ne wait pas — le serveur tourne en arrière-plan.
    // server-ready sera émis quand un port s'ouvre.
    void pump;
    return { exitCode: 0, output: "(background) " + command };
  }

  const exitCode = await proc.exit;
  await pump;
  return { exitCode, output };
}

// Détecte si une commande est un serveur long-running pour la lancer en bg.
export function isServerCommand(cmd: string): boolean {
  return /\b(npm|bun|pnpm|yarn|node)\s+(run\s+)?(dev|start|serve)\b/.test(cmd) ||
         /\bnode\s+\S+\.js\b/.test(cmd) && /server|listen/.test(cmd);
}
