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

// Mock execution: l'app tourne dans le navigateur, donc on simule l'exécution des outils
// et on renvoie un résultat plausible au modèle pour qu'il continue son raisonnement.
export function mockToolExecution(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "check_secrets": {
      const keys = (args.secret_keys as string[]) || [];
      return JSON.stringify({ result: keys.map((k) => ({ key: k, exists: false })) });
    }
    case "search_filesystem":
      return JSON.stringify({ matches: [], note: "Mock IDE — no real filesystem in this sandbox." });
    case "bash":
      return JSON.stringify({ stdout: "(mocked) command acknowledged", stderr: "", exit_code: 0, command: args.command });
    case "str_replace_editor":
      return JSON.stringify({ ok: true, command: args.command, path: args.path, note: "Mock IDE — file change recorded." });
    case "packager_tool":
    case "programming_language_install_tool":
      return JSON.stringify({ ok: true, note: "Mock install completed.", args });
    case "create_postgresql_database_tool":
      return JSON.stringify({ ok: true, DATABASE_URL: "postgres://mock:mock@localhost:5432/mock" });
    case "check_database_status":
      return JSON.stringify({ available: true });
    case "execute_sql_tool":
      return JSON.stringify({ rows: [], note: "Mock DB — no rows." });
    case "workflows_set_run_config_tool":
    case "workflows_remove_run_config_tool":
    case "restart_workflow":
      return JSON.stringify({ ok: true, args });
    case "web_application_feedback_tool":
    case "shell_command_application_feedback_tool":
    case "vnc_window_application_feedback":
      return JSON.stringify({ ok: true, note: "User feedback simulated.", args });
    case "ask_secrets":
      return JSON.stringify({ ok: true, note: "Secret request shown to user (mock).", args });
    case "suggest_deploy":
      return JSON.stringify({ ok: true, note: "Deployment suggestion shown to user." });
    case "report_progress":
      return JSON.stringify({ ok: true, summary: args.summary });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
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
