// Stockage local simple des projets créés via l'agent.
export type Project = {
  id: string;
  name: string;
  prompt: string;
  files: Record<string, string>;
  createdAt: number;
  updatedAt: number;
};

const KEY = "replit-clone:projects:v1";
const CURRENT_KEY = "replit-clone:current-project";

function read(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function write(list: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listProjects(): Project[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): Project | null {
  return read().find((p) => p.id === id) ?? null;
}

export function createProject(prompt: string): Project {
  const id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const name = prompt.trim().slice(0, 48) || "Nouveau projet";
  const now = Date.now();
  const proj: Project = { id, name, prompt, files: {}, createdAt: now, updatedAt: now };
  const list = read();
  list.push(proj);
  write(list);
  return proj;
}

export function updateProjectFiles(id: string, files: Record<string, string>) {
  const list = read();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  list[idx].files = files;
  list[idx].updatedAt = Date.now();
  write(list);
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));
  if (typeof window !== "undefined" && localStorage.getItem(CURRENT_KEY) === id) {
    localStorage.removeItem(CURRENT_KEY);
  }
}

export function setCurrentProjectId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(CURRENT_KEY, id);
  else localStorage.removeItem(CURRENT_KEY);
}

export function getCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_KEY);
}
