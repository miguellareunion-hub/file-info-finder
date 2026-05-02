// System prompt — chargé tel quel depuis le fichier officiel fourni par l'utilisateur.
import promptText from "./replit-prompt.txt?raw";
import toolsJson from "./replit-tools.json";

export const REPLIT_SYSTEM_PROMPT: string = promptText;

// Tools — convertit le JSON officiel ({name, description, parameters}) au format OpenAI tool-calling.
interface RawTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
const rawTools = (toolsJson as { tools: RawTool[] }).tools;
export const REPLIT_TOOLS = rawTools.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

import { writeFile, readFile, fileExists, listFiles, runCommand, isServerCommand } from "./webcontainer";

// Exécute réellement les outils via WebContainer quand c'est possible.
// Notifie l'UI à chaque action via onFsChange (pour rafraîchir le panneau Fichiers).
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  onFsChange?: () => void,
): Promise<string> {
  try {
    switch (name) {
      case "str_replace_editor": {
        const cmd = String(args.command ?? "");
        const path = String(args.path ?? "");
        if (cmd === "create") {
          await writeFile(path, String(args.file_text ?? ""));
          onFsChange?.();
          return JSON.stringify({ ok: true, created: path });
        }
        if (cmd === "view") {
          if (!path) return JSON.stringify({ error: "missing path" });
          if (path.endsWith("/") || !(await fileExists(path))) {
            const files = await listFiles(path || "/");
            return JSON.stringify({ files });
          }
          const content = await readFile(path);
          return JSON.stringify({ path, content });
        }
        if (cmd === "str_replace") {
          const current = await readFile(path);
          const oldStr = String(args.old_str ?? "");
          const newStr = String(args.new_str ?? "");
          if (!current.includes(oldStr)) {
            return JSON.stringify({ error: "old_str not found in file" });
          }
          await writeFile(path, current.replace(oldStr, newStr));
          onFsChange?.();
          return JSON.stringify({ ok: true, replaced_in: path });
        }
        if (cmd === "insert") {
          const current = await readFile(path);
          const lines = current.split("\n");
          const at = Number(args.insert_line ?? lines.length);
          lines.splice(at, 0, String(args.new_str ?? ""));
          await writeFile(path, lines.join("\n"));
          onFsChange?.();
          return JSON.stringify({ ok: true, inserted_in: path, at });
        }
        return JSON.stringify({ error: `unsupported str_replace_editor command: ${cmd}` });
      }
      case "bash": {
        const command = String(args.command ?? "");
        if (!command) return JSON.stringify({ error: "missing command" });
        const bg = isServerCommand(command);
        const r = await runCommand(command, { background: bg });
        onFsChange?.();
        return JSON.stringify({ exit_code: r.exitCode, output: r.output.slice(-4000), background: bg });
      }
      case "search_filesystem": {
        const files = await listFiles("/");
        return JSON.stringify({ files: files.slice(0, 200) });
      }
      case "packager_tool": {
        const list = (args.dependency_list as string[]) || [];
        const action = String(args.install_or_uninstall ?? "install");
        const lang = String(args.language_or_system ?? "nodejs");
        if (list.length === 0) return JSON.stringify({ ok: true, note: "no deps" });
        const cmd = lang === "system"
          ? JSON.stringify({ error: "System packages not available in WebContainer" })
          : `npm ${action === "install" ? "install" : "uninstall"} ${list.join(" ")}`;
        if (typeof cmd !== "string") return cmd;
        const r = await runCommand(cmd);
        onFsChange?.();
        return JSON.stringify({ exit_code: r.exitCode, output: r.output.slice(-2000) });
      }
      case "workflows_set_run_config_tool": {
        const command = String(args.command ?? "");
        if (!command) return JSON.stringify({ error: "missing command" });
        await runCommand(command, { background: true });
        return JSON.stringify({ ok: true, started: args.name, command });
      }
      case "restart_workflow":
      case "workflows_remove_run_config_tool":
        return JSON.stringify({ ok: true, note: "Workflow ack (single-process sandbox)." });
      case "check_secrets": {
        const keys = (args.secret_keys as string[]) || [];
        return JSON.stringify({ result: keys.map((k) => ({ key: k, exists: false })) });
      }
      case "ask_secrets":
        return JSON.stringify({ ok: true, note: "Secret request acknowledged (sandbox has no secrets)." });
      case "create_postgresql_database_tool":
      case "check_database_status":
      case "execute_sql_tool":
        return JSON.stringify({ error: "PostgreSQL not available in WebContainer sandbox." });
      case "programming_language_install_tool":
        return JSON.stringify({ ok: true, note: "Node.js déjà disponible dans WebContainer." });
      case "web_application_feedback_tool":
      case "shell_command_application_feedback_tool":
      case "vnc_window_application_feedback":
        return JSON.stringify({ ok: true, note: "Preview visible dans le panneau de droite." });
      case "suggest_deploy":
        return JSON.stringify({ ok: true, note: "Deployment suggestion noted." });
      case "report_progress":
        return JSON.stringify({ ok: true, summary: args.summary });
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}


export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string };

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type Provider = "lmstudio" | "openai";

export interface LMStudioConfig {
  provider: Provider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export const DEFAULT_OPENAI_CONFIG: LMStudioConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com",
  model: "gpt-4o-mini",
  apiKey: "",
};

// Normalise une URL saisie par l'utilisateur :
// - ajoute http:// si absent
// - retire les / finaux
// - retire un éventuel suffixe /v1 ou /api/v1 (on l'ajoute nous-mêmes)
export function normalizeBaseUrl(raw: string): string {
  let u = (raw || "").trim();
  u = u.replace(/^(https?:\/\/)+/i, (m) => m.match(/https?:\/\//i)![0]);
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  u = u.replace(/\/+$/, "");
  // Retire les suffixes d'endpoints courants si l'utilisateur a collé une URL complète
  u = u.replace(/\/(api\/)?v1\/chat\/completions$/i, "");
  u = u.replace(/\/(api\/)?v1\/models$/i, "");
  u = u.replace(/\/api\/v1$/i, "");
  u = u.replace(/\/v1$/i, "");
  return u;
}

export const DEFAULT_LMSTUDIO_CONFIG: LMStudioConfig = {
  provider: "lmstudio",
  baseUrl: "https://nickname-autograph-helpline.ngrok-free.dev",
  model: "google/gemma-4-e4b",
  apiKey: "",
};

export function buildEndpoint(config: LMStudioConfig, path: "chat/completions" | "models"): string {
  const base = normalizeBaseUrl(config.baseUrl);
  // Les deux providers exposent /v1/...
  return `${base}/v1/${path}`;
}

interface CompletionResponse {
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

export async function callLMStudio(
  config: LMStudioConfig,
  messages: ChatMessage[],
): Promise<CompletionResponse["choices"][number]["message"]> {
  const url = buildEndpoint(config, "chat/completions");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: REPLIT_TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${config.provider === "openai" ? "OpenAI" : "LM Studio"} HTTP ${resp.status}: ${text || resp.statusText}`);
  }

  const json = (await resp.json()) as CompletionResponse;
  return json.choices[0].message;
}

// Boucle agentique : appelle LM Studio, exécute les tool_calls (mock), renvoie au modèle, jusqu'à réponse finale.
export async function runAgentLoop(
  config: LMStudioConfig,
  history: ChatMessage[],
  onStep: (msg: ChatMessage) => void,
  maxSteps = 6,
): Promise<void> {
  const conv = [...history];
  for (let i = 0; i < maxSteps; i++) {
    const msg = await callLMStudio(config, conv);
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    };
    conv.push(assistantMsg);
    onStep(assistantMsg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) return;

    for (const call of msg.tool_calls) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(call.function.arguments || "{}");
      } catch {
        parsed = { _raw: call.function.arguments };
      }
      const result = mockToolExecution(call.function.name, parsed);
      const toolMsg: ChatMessage = {
        role: "tool",
        content: result,
        tool_call_id: call.id,
        name: call.function.name,
      };
      conv.push(toolMsg);
      onStep(toolMsg);
    }
  }
}
