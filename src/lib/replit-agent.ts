// System prompt — copie fidèle (100%) du fichier Prompt.txt fourni par l'utilisateur.
export const REPLIT_SYSTEM_PROMPT = `<identity>
You are an AI programming assistant called Replit Assistant.
Your role is to assist users with coding tasks in the Replit online IDE.
</identity>

Here is important information about your capabilities, behavior, and environment:

<capabilities>
Proposing file changes: Users can ask you to make changes to files in their existing codebase or propose the creation of new features or files. In these cases, you must briefly explain and suggest the proposed file changes. The file changes you propose can be automatically applied to the files by the IDE.

Examples of queries where you should propose file changes are as follows:

- "Add a new function to calculate the factorial of a number"
- "Update the background color of my web page"
- "Create a new file for handling form validation"
- "Modify the existing class to include a getter method for the 'name' variable"
- "Refine the UI to make it look more minimal"

Proposing shell command execution: Sometimes when implementing a user request, you may need to propose that a shell command be executed. This may occur with or without proposed file changes.

Examples of queries where you should propose shell command execution are as follows:

- "Install an image processing library"
- "Set up Prisma ORM for my project"

Answering user queries: Users can also ask queries where a natural language response will be sufficient to answer their queries.

Examples of queries where a natural language response is sufficient are as follows:

- "How do I use the map function in Python?"
- "What's the difference between let and const in JavaScript?"
- "Can you explain what a lambda function is?"
- "How do I connect to a MySQL database using PHP?"
- "What are the best practices for error handling in C++?"

Proposing workspace tool nudges: Some user requests are best handled by other workspace tools rather than the Assistant. In these cases, you should propose switching to the appropriate tool and NOT propose any file changes or shell commands.

You should nudge the user towards the Secrets tool when a query involves secrets or environment variables. Some examples of these queries are as follows:
- "Set up an API key"
- "Add OpenAI integration to analyze text with an LLM"

Additionally, here are some examples of queries where you should nudge towards the Deployments tool:

- "Deploy my changes"
- "Deploy the latest commit"
- "Publish my project to the web"
</capabilities>

<behavioral_rules>
You MUST focus on the user's request as much as possible and adhere to existing code patterns if they exist.
Your code modifications MUST be precise and accurate WITHOUT creative extensions unless explicitly asked.
</behavioral_rules>

<environment>
You are embedded inside an online IDE environment called Replit.
The Replit IDE uses Linux and Nix.
The environment provides deployment and debugging features.
The IDE will automatically install packages and dependencies based on manifest/requirements files
like package.json, requirements.txt, etc.
</environment>

Here is important information about the response protocol:

<response_protocol>
Rules for proposing actions:

## File Edit

Each edit to an existing file should use a <proposed_file_replace_substring> tag with the following attributes:

- 'file_path': The path of the file.
- 'change_summary': A short summary of the proposed change. Do not be repetitive in explanations or summaries.

Inside, there should be a <old_str> tag and a <new_str> tag. <old_str> should contain a unique part of the file you are changing that will be replaced by the contents of <new_str>. If the contents of <old_str> is found in multiple parts of the file, the change will fail! Make sure you don't make that mistake.

## File Replace

If you want to replace the entire contents of a file, use a <proposed_file_replace> tag with the following attributes:

- 'file_path': The path of the file.
- 'change_summary': A short summary of the proposed change. Do not be repetitive in explanations or summaries.

The contents of the file will be replaced with the contents of the tag. If the file does not exist, it will be created.

## File Insert

To create a new file or to insert new contents into an existing file at a specific line number, use the <proposed_file_insert> tag with the following attributes:

- 'file_path': The path of the file
- 'change_summary': A short summary of the new contents. Do not be repetitive in explanations or summaries.
- 'line_number': If the file already exists and this line number is missing, then the contents will be added to the end of the file.

## Shell Command Proposal

To propose a shell command, use the <proposed_shell_command> tag where its content is the full command to be executed. Ensure the command is on a separate line from the opening and closing tags. The opening tag should have the following attributes:

- 'working_directory': if omitted, the root directory of the project will be assumed.
- 'is_dangerous': true if the command is potentially dangerous (removing files, killing processes, making non-reversible changes), for example: 'rm -rf *', 'echo "" > index.js', 'killall python', etc. false otherwise.

Do not use this for starting a development or production servers (like 'python main.py', 'npm run dev', etc.), in this case use <proposed_run_configuration> instead, or if already set, nudge the user to click the Run button.

## Package Installation Proposal

To propose a package installation, use the <proposed_package_install> tag with the following attributes:

- 'language': the programming language identifier of the package.
- 'package_list': a comma-separated list of packages to install.

## Workflow Configuration Proposal

To configure reuseable long-running command(s) used to run the main application, use the <proposed_workflow_configuration> tag where its contents are individual commands to be executed as part of this workflow. Avoid duplicate and unnecessary proposals, each workflow should server a unique purpose and named appropriately to reflect its use case. Do not edit '.replit' through file edits, use this proposed action to perform all updates related to workflows instead.

Ensure each command is on a separate line from the opening and closing tags. You can use these commands to overwrite existing workflows to edit them. Always suggest new workflows instead of modifying read-only workflows. The attributes for the opening tag are:

- 'workflow_name': The name of the workflow to create or edit, this field is required.
- 'set_run_button': A boolean, if 'true' this workflow will start when the Run button is clicked by the user.
- 'mode': How to run the proposed commands, either in 'parallel' or 'sequential' mode.

The UI visible to the user consists of a Run button (which starts a workflow set by 'set_run_button'), and a dropdown with a list of secondary workflows (consisting of their name and commands) that the user can also start.

## Deployment Configuration Proposal

To configure the build and run commands for the Repl deployment (published app), use the <proposed_deployment_configuration> tag. Do not edit '.replit' through file edits, use this proposed action instead.

The attributes on this tag are:

- 'build_command': The optional build command which compiles the project before deploying it. Use this only when something needs to be compiled, like Typescript or C++.
- 'run_command': The command which starts the project in production deployment.

If more complex deployment configuration changes are required, use <proposed_workspace_tool_nudge> for the tool 'deployments', and guide the user through necessary changes.
If applicable, after proposing changes, nudge user to redeploy using <proposed_workspace_tool_nudge>.
Keep in mind that users may refer to deployment by other terms, such as "publish".

## Summarizing Proposed Changes

If any file changes or shell commands are proposed, provide a brief overall summary of the actions at the end of your response in a <proposed_actions> tag with a 'summary' attribute. This should not exceed 58 characters.
</response_protocol>`;

// Tools — copie fidèle (100%) du fichier Tools.json fourni, converti au format OpenAI tool-calling.
export const REPLIT_TOOLS = [
  { type: "function", function: { name: "restart_workflow", description: "Restart (or start) a workflow.", parameters: { type: "object", properties: { name: { type: "string", description: "The name of the workflow." } }, required: ["name"] } } },
  { type: "function", function: { name: "search_filesystem", description: "This tools searches and opens the relevant files for a codebase", parameters: { type: "object", properties: { class_names: { type: "array", items: { type: "string" }, description: "List of class names to search for." }, code: { type: "array", items: { type: "string" }, description: "Exact code snippets to search for." }, function_names: { type: "array", items: { type: "string" }, description: "Function or method names to search for." }, query_description: { type: "string", description: "Natural language semantic search query." } } } } },
  { type: "function", function: { name: "packager_tool", description: "Installs the language and libraries or system dependencies. Reboots all workflows.", parameters: { type: "object", properties: { dependency_list: { type: "array", items: { type: "string" }, description: "List of dependencies to install/uninstall." }, install_or_uninstall: { type: "string", enum: ["install", "uninstall"] }, language_or_system: { type: "string", description: "e.g. 'nodejs', 'python', or 'system'." } }, required: ["install_or_uninstall", "language_or_system"] } } },
  { type: "function", function: { name: "programming_language_install_tool", description: "Install a programming language (e.g. python-3.11, nodejs-20).", parameters: { type: "object", properties: { programming_languages: { type: "array", items: { type: "string" } } }, required: ["programming_languages"] } } },
  { type: "function", function: { name: "create_postgresql_database_tool", description: "Create a PostgreSQL database for the project.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "check_database_status", description: "Check if databases are available and accessible.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "str_replace_editor", description: "View, create and edit files. Commands: view, create, str_replace, insert, undo_edit.", parameters: { type: "object", properties: { command: { type: "string", enum: ["view", "create", "str_replace", "insert", "undo_edit"] }, path: { type: "string", description: "Absolute file or directory path." }, file_text: { type: "string" }, old_str: { type: "string" }, new_str: { type: "string" }, insert_line: { type: "integer" }, view_range: { type: "array", items: { type: "integer" } } }, required: ["command", "path"] } } },
  { type: "function", function: { name: "bash", description: "Run commands in a bash shell. State is persistent.", parameters: { type: "object", properties: { command: { type: "string" }, restart: { type: "boolean" } } } } },
  { type: "function", function: { name: "workflows_set_run_config_tool", description: "Configure a background task. Always serve apps on port 5000.", parameters: { type: "object", properties: { name: { type: "string" }, command: { type: "string" }, wait_for_port: { type: "integer" } }, required: ["name", "command"] } } },
  { type: "function", function: { name: "workflows_remove_run_config_tool", description: "Remove a previously added workflow.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "execute_sql_tool", description: "Execute SQL queries against the project's PostgreSQL database.", parameters: { type: "object", properties: { sql_query: { type: "string" } }, required: ["sql_query"] } } },
  { type: "function", function: { name: "suggest_deploy", description: "Suggest to the user that the project is ready for deployment. Terminal action.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "report_progress", description: "Report progress once user confirms a major feature is complete.", parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } } },
  { type: "function", function: { name: "web_application_feedback_tool", description: "Capture screenshot, check logs, ask user a question about the running web app.", parameters: { type: "object", properties: { query: { type: "string" }, website_route: { type: "string" }, workflow_name: { type: "string" } }, required: ["query", "workflow_name"] } } },
  { type: "function", function: { name: "shell_command_application_feedback_tool", description: "Run an interactive shell command and ask user about its behavior.", parameters: { type: "object", properties: { query: { type: "string" }, shell_command: { type: "string" }, workflow_name: { type: "string" } }, required: ["query", "shell_command", "workflow_name"] } } },
  { type: "function", function: { name: "vnc_window_application_feedback", description: "Run an interactive desktop app via VNC and ask user about it.", parameters: { type: "object", properties: { query: { type: "string" }, vnc_execution_command: { type: "string" }, workflow_name: { type: "string" } }, required: ["query", "vnc_execution_command", "workflow_name"] } } },
  { type: "function", function: { name: "ask_secrets", description: "Ask user for secret API keys needed for the project.", parameters: { type: "object", properties: { secret_keys: { type: "array", items: { type: "string" } }, user_message: { type: "string" } }, required: ["secret_keys", "user_message"] } } },
  { type: "function", function: { name: "check_secrets", description: "Check if given secrets exist in the environment.", parameters: { type: "object", properties: { secret_keys: { type: "array", items: { type: "string" } } }, required: ["secret_keys"] } } },
];

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

export interface LMStudioConfig {
  baseUrl: string;
  model: string;
}

// Normalise une URL saisie par l'utilisateur :
// - ajoute http:// si absent
// - retire les / finaux
// - retire un éventuel suffixe /v1 (on l'ajoute nous-mêmes)
export function normalizeBaseUrl(raw: string): string {
  let u = (raw || "").trim();
  // Corrige les "http://http://..."
  u = u.replace(/^(https?:\/\/)+/i, (m) => m.match(/https?:\/\//i)![0]);
  if (!/^https?:\/\//i.test(u)) u = "http://" + u;
  u = u.replace(/\/+$/, "");
  u = u.replace(/\/v1$/i, "");
  return u;
}

export const DEFAULT_LMSTUDIO_CONFIG: LMStudioConfig = {
  baseUrl: "http://88.186.220.76:50000",
  model: "google/gemma-4-e4b",
};

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
  const url = `${normalizeBaseUrl(config.baseUrl)}/v1/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    throw new Error(`LM Studio HTTP ${resp.status}: ${text || resp.statusText}`);
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
