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

import { writeFile, readFile, fileExists, listFiles, runCommand, isServerCommand, getLastPreviewUrl, getPreviewDocument } from "./webcontainer";

// Exécute réellement les outils via WebContainer quand c'est possible.
// Notifie l'UI à chaque action via onFsChange (pour rafraîchir le panneau Fichiers).
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  onFsChange?: () => void,
): Promise<string> {
  try {
    const hasNonEmptyText = (...values: unknown[]) => values.some((value) => typeof value === "string" && value.trim().length > 0);
    const hasRenderableHtml = async () => {
      const files = await listFiles("/");
      return files.some((file) => /(^|\/)index\.html$/i.test(file) || file.endsWith(".html"));
    };
    const hasVisiblePreview = async () => Boolean(getLastPreviewUrl() || getPreviewDocument() || await hasRenderableHtml());

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
        if (!(await hasVisiblePreview())) {
          return JSON.stringify({
            error: "Aucune preview réelle disponible : crée d'abord un index.html ou démarre le serveur du projet.",
          });
        }
        return JSON.stringify({ ok: true, note: "Preview HTML disponible dans le panneau de droite." });
      case "suggest_deploy":
        return JSON.stringify({ ok: true, note: "Deployment suggestion noted." });
      case "report_progress":
        if (!(await hasVisiblePreview())) {
          return JSON.stringify({
            error: "Impossible de confirmer l'avancement : aucune preview du projet n'est encore disponible.",
          });
        }
        return JSON.stringify({ ok: true, summary: args.summary });

      // === Le modèle invente parfois ces tools (alias des balises XML <proposed_*>) ===
      case "proposed_file_replace": {
        const path = String(args.file_path ?? args.path ?? "");
        const content = String(args.contents ?? args.content ?? args.file_text ?? args.body ?? args.new_str ?? "");
        if (!path) return JSON.stringify({ error: "missing file_path" });
        if (!hasNonEmptyText(args.contents, args.content, args.file_text, args.body, args.new_str)) {
          return JSON.stringify({ ok: true, skipped: path, reason: "empty inline content; waiting for XML body" });
        }
        await writeFile(path, content);
        onFsChange?.();
        return JSON.stringify({ ok: true, written: path });
      }
      case "proposed_file_replace_substring": {
        const path = String(args.file_path ?? args.path ?? "");
        const oldStr = String(args.old_str ?? "");
        const newStr = String(args.new_str ?? "");
        if (!path) return JSON.stringify({ error: "missing file_path" });
        const cur = await readFile(path).catch(() => "");
        if (!cur.includes(oldStr)) return JSON.stringify({ error: "old_str not found" });
        await writeFile(path, cur.replace(oldStr, newStr));
        onFsChange?.();
        return JSON.stringify({ ok: true, patched: path });
      }
      case "proposed_file_insert": {
        const path = String(args.file_path ?? "");
        const at = Number(args.line_number ?? 0);
        const content = String(args.contents ?? args.content ?? args.body ?? args.new_str ?? "");
        if (!path) return JSON.stringify({ error: "missing file_path" });
        if (!hasNonEmptyText(args.contents, args.content, args.body, args.new_str)) {
          return JSON.stringify({ ok: true, skipped: path, reason: "empty inline content; waiting for XML body" });
        }
        const cur = await readFile(path).catch(() => "");
        const lines = cur.split("\n");
        lines.splice(Math.min(at, lines.length), 0, content);
        await writeFile(path, lines.join("\n"));
        onFsChange?.();
        return JSON.stringify({ ok: true, inserted_in: path, at });
      }
      case "proposed_shell_command": {
        const command = String(args.command ?? args.body ?? "");
        if (!command) return JSON.stringify({ error: "missing command" });
        const bg = isServerCommand(command);
        const r = await runCommand(command, { background: bg });
        onFsChange?.();
        return JSON.stringify({ exit_code: r.exitCode, output: r.output.slice(-2000), background: bg });
      }
      case "proposed_package_install": {
        const list = (args.package_list as string)?.split(",").map((s) => s.trim()).filter(Boolean) ||
                     (args.packages as string[]) || [];
        if (list.length === 0) return JSON.stringify({ error: "no packages" });
        const r = await runCommand(`npm install ${list.join(" ")}`);
        onFsChange?.();
        return JSON.stringify({ exit_code: r.exitCode, output: r.output.slice(-1500) });
      }
      case "proposed_workflow_configuration": {
        const cmds = String(args.body ?? args.commands ?? args.command ?? "")
          .split("\n").map((s) => s.trim()).filter(Boolean);
        if (cmds.length === 0) return JSON.stringify({ error: "no commands" });
        for (const c of cmds) await runCommand(c, { background: true });
        onFsChange?.();
        return JSON.stringify({ ok: true, started: cmds });
      }

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

import { parseProposedActions, type ProposedAction } from "./proposed-actions";
import { writeFile as wcWrite, readFile as wcRead, runCommand as wcRun, isServerCommand as wcIsServer } from "./webcontainer";

// Applique les <proposed_*> trouvés dans un message assistant.
async function applyProposedActions(actions: ProposedAction[], onFsChange?: () => void): Promise<string[]> {
  const log: string[] = [];
  for (const a of actions) {
    try {
      switch (a.kind) {
        case "create_or_replace":
          await wcWrite(a.path, a.content);
          onFsChange?.();
          log.push(`✓ écrit ${a.path}`);
          break;
        case "replace_substring": {
          const cur = await wcRead(a.path).catch(() => "");
          if (!cur.includes(a.oldStr)) {
            log.push(`✗ old_str introuvable dans ${a.path}`);
            break;
          }
          await wcWrite(a.path, cur.replace(a.oldStr, a.newStr));
          onFsChange?.();
          log.push(`✓ patch ${a.path}`);
          break;
        }
        case "insert": {
          const cur = await wcRead(a.path).catch(() => "");
          const lines = cur.split("\n");
          const at = Math.min(a.lineNumber, lines.length);
          lines.splice(at, 0, a.content);
          await wcWrite(a.path, lines.join("\n"));
          onFsChange?.();
          log.push(`✓ insertion ${a.path}@${at}`);
          break;
        }
        case "shell": {
          const bg = wcIsServer(a.command);
          const r = await wcRun(a.command, { background: bg });
          onFsChange?.();
          log.push(`$ ${a.command} → exit ${r.exitCode}${bg ? " (bg)" : ""}`);
          break;
        }
        case "package_install": {
          const cmd = `npm install ${a.packages.join(" ")}`;
          const r = await wcRun(cmd);
          onFsChange?.();
          log.push(`📦 ${cmd} → exit ${r.exitCode}`);
          break;
        }
        case "workflow": {
          for (const c of a.commands) {
            const bg = wcIsServer(c) || a.setRunButton === true;
            await wcRun(c, { background: bg });
          }
          onFsChange?.();
          log.push(`▶ workflow "${a.name}" lancé (${a.commands.length} cmd)`);
          break;
        }
      }
    } catch (e) {
      log.push(`✗ ${a.kind}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return log;
}

// Boucle agentique : appelle LM Studio, exécute les tool_calls + applique les <proposed_*> trouvés
// dans le contenu textuel (style Replit Assistant), renvoie au modèle si nécessaire.
export async function runAgentLoop(
  config: LMStudioConfig,
  history: ChatMessage[],
  onStep: (msg: ChatMessage) => void,
  onFsChange?: () => void,
  maxSteps = 8,
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

    const actions = parseProposedActions(assistantMsg.content || "");

    // 1) Outils JSON tool-calling (si le modèle les supporte)
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const call of msg.tool_calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsed = { _raw: call.function.arguments };
        }
        const result = await executeTool(call.function.name, parsed, onFsChange);
        const toolMsg: ChatMessage = {
          role: "tool",
          content: result,
          tool_call_id: call.id,
          name: call.function.name,
        };
        conv.push(toolMsg);
        onStep(toolMsg);
      }
      if (actions.length > 0) {
        const log = await applyProposedActions(actions, onFsChange);
        const recap: ChatMessage = {
          role: "tool",
          content: JSON.stringify({ applied: log }, null, 2),
          tool_call_id: `proposed-${i}`,
          name: "apply_proposed_actions",
        };
        conv.push(recap);
        onStep(recap);
      }
      continue; // Le modèle attend la suite après ses tool_calls.
    }

    // 2) Actions XML <proposed_*> dans le contenu (mode Replit natif)
    if (actions.length > 0) {
      const log = await applyProposedActions(actions, onFsChange);
      // Injecte un faux message "tool" récap pour montrer ce qui a été appliqué.
      const recap: ChatMessage = {
        role: "tool",
        content: JSON.stringify({ applied: log }, null, 2),
        tool_call_id: `proposed-${i}`,
        name: "apply_proposed_actions",
      };
      conv.push(recap);
      onStep(recap);
      continue; // Boucle pour donner au modèle l'occasion de répondre/poursuivre.
    }

    // Pas d'outil ni d'action proposée → réponse finale.
    return;
  }
}

