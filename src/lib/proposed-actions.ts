// Parse les balises XML <proposed_*> émises par le modèle (style Replit Assistant)
// et les transforme en actions exécutables sur le WebContainer.

export type ProposedAction =
  | { kind: "create_or_replace"; path: string; content: string; summary?: string }
  | { kind: "replace_substring"; path: string; oldStr: string; newStr: string; summary?: string }
  | { kind: "insert"; path: string; lineNumber: number; content: string; summary?: string }
  | { kind: "shell"; command: string; cwd?: string; dangerous?: boolean }
  | { kind: "package_install"; language: string; packages: string[] }
  | { kind: "workflow"; name: string; commands: string[]; setRunButton?: boolean; mode?: "parallel" | "sequential" };

// Récupère un attribut XML d'une chaîne tag-ouvrante (ex: ' file_path="x" change_summary="y"')
function getAttr(attrStr: string, name: string): string | undefined {
  const m = attrStr.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ||
            attrStr.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m?.[1];
}

// Trouve toutes les occurrences <tag ...>...</tag> (non-greedy, multi-ligne)
function findBlocks(text: string, tag: string): Array<{ attrs: string; body: string }> {
  const re = new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)</${tag}>`, "gi");
  const out: Array<{ attrs: string; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ attrs: m[1] || "", body: m[2] ?? "" });
  }
  return out;
}

// Extrait <old_str>...</old_str> et <new_str>...</new_str> depuis le body
function extractOldNew(body: string): { oldStr: string; newStr: string } | null {
  const o = body.match(/<old_str>([\s\S]*?)<\/old_str>/i);
  const n = body.match(/<new_str>([\s\S]*?)<\/new_str>/i);
  if (!o || !n) return null;
  return { oldStr: o[1], newStr: n[1] };
}

export function parseProposedActions(text: string): ProposedAction[] {
  const actions: ProposedAction[] = [];

  // 1) Création / remplacement complet de fichier
  for (const b of findBlocks(text, "proposed_file_replace")) {
    const path = getAttr(b.attrs, "file_path");
    if (!path) continue;
    actions.push({
      kind: "create_or_replace",
      path,
      content: stripLeadingNewline(b.body),
      summary: getAttr(b.attrs, "change_summary"),
    });
  }

  // 2) Remplacement d'une sous-chaîne
  for (const b of findBlocks(text, "proposed_file_replace_substring")) {
    const path = getAttr(b.attrs, "file_path");
    if (!path) continue;
    const on = extractOldNew(b.body);
    if (!on) continue;
    actions.push({
      kind: "replace_substring",
      path,
      oldStr: on.oldStr,
      newStr: on.newStr,
      summary: getAttr(b.attrs, "change_summary"),
    });
  }

  // 3) Insertion à un line_number donné
  for (const b of findBlocks(text, "proposed_file_insert")) {
    const path = getAttr(b.attrs, "file_path");
    const lineNumber = Number(getAttr(b.attrs, "line_number") ?? "0");
    if (!path) continue;
    actions.push({
      kind: "insert",
      path,
      lineNumber,
      content: stripLeadingNewline(b.body),
      summary: getAttr(b.attrs, "change_summary"),
    });
  }

  // 4) Commande shell
  for (const b of findBlocks(text, "proposed_shell_command")) {
    const command = b.body.trim();
    if (!command) continue;
    actions.push({
      kind: "shell",
      command,
      cwd: getAttr(b.attrs, "working_directory"),
      dangerous: getAttr(b.attrs, "is_dangerous") === "true",
    });
  }

  // 5) Installation de package
  for (const b of findBlocks(text, "proposed_package_install")) {
    const language = getAttr(b.attrs, "language") || "nodejs";
    const list = (getAttr(b.attrs, "package_list") || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) continue;
    actions.push({ kind: "package_install", language, packages: list });
  }

  // 6) Configuration de workflow (ex: serveur de dev)
  for (const b of findBlocks(text, "proposed_workflow_configuration")) {
    const name = getAttr(b.attrs, "workflow_name") || "default";
    const commands = b.body.split("\n").map((s) => s.trim()).filter(Boolean);
    if (commands.length === 0) continue;
    actions.push({
      kind: "workflow",
      name,
      commands,
      setRunButton: getAttr(b.attrs, "set_run_button") === "true",
      mode: (getAttr(b.attrs, "mode") as "parallel" | "sequential") || "sequential",
    });
  }

  return actions;
}

function stripLeadingNewline(s: string): string {
  return s.replace(/^\r?\n/, "").replace(/\r?\n\s*$/, "\n");
}

// Retire les balises <proposed_*>...</proposed_*> du texte affiché à l'utilisateur
// pour que le markdown reste lisible.
export function stripProposedTags(text: string): string {
  return text
    .replace(/<proposed_file_replace_substring[\s\S]*?<\/proposed_file_replace_substring>/gi, "")
    .replace(/<proposed_file_replace[\s\S]*?<\/proposed_file_replace>/gi, "")
    .replace(/<proposed_file_insert[\s\S]*?<\/proposed_file_insert>/gi, "")
    .replace(/<proposed_shell_command[\s\S]*?<\/proposed_shell_command>/gi, "")
    .replace(/<proposed_package_install[\s\S]*?<\/proposed_package_install>/gi, "")
    .replace(/<proposed_workflow_configuration[\s\S]*?<\/proposed_workflow_configuration>/gi, "")
    .replace(/<proposed_deployment_configuration[\s\S]*?<\/proposed_deployment_configuration>/gi, "")
    .replace(/<proposed_actions[^>]*\/?>/gi, "")
    .replace(/<\/?proposed_actions>/gi, "")
    .trim();
}
