import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus, ArrowRight, Globe, Smartphone, LayoutGrid, Layers, Film,
  RefreshCw, Sparkles, ChevronDown, Trash2, Folder, Clock,
} from "lucide-react";
import { listProjects, deleteProject, setCurrentProjectId, type Project } from "@/lib/projects";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Replit Clone — What will you build?" },
      { name: "description", content: "Décrivez votre idée, on la construit pour vous avec un agent IA." },
    ],
  }),
});

const examples = [
  "Startup pitch explainer",
  "Product launch presentation",
  "3D racing game",
  "SaaS landing page",
  "Todo app avec drag & drop",
];

const categories = [
  { icon: Globe, label: "Website" },
  { icon: Smartphone, label: "Mobile" },
  { icon: LayoutGrid, label: "Design" },
  { icon: Layers, label: "Slides" },
  { icon: Film, label: "Animation" },
];

function Home() {
  const [prompt, setPrompt] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  const submit = () => {
    if (!prompt.trim()) return;
    setCurrentProjectId(null); // force creation of a new one
    navigate({ to: "/agent", search: { p: prompt } });
  };

  const openProject = (id: string) => {
    setCurrentProjectId(id);
    navigate({ to: "/agent", search: { id } });
  };

  const remove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce projet ?")) return;
    deleteProject(id);
    setProjects(listProjects());
  };

  const newProject = () => {
    setCurrentProjectId(null);
    navigate({ to: "/agent", search: {} });
  };

  return (
    <div className="min-h-screen bg-[#faf6f1] text-neutral-900 selection:bg-orange-200">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-200/40 rounded-full blur-[120px]" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-pink-200/30 rounded-full blur-[100px]" />
      </div>

      <div className="relative">
        <header className="flex items-center justify-between px-6 lg:px-10 py-5">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold">
              <span className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-pink-500 grid place-items-center">
                <Sparkles className="w-4 h-4 text-white" />
              </span>
              Replit
            </Link>
            <nav className="hidden lg:flex items-center gap-6 text-sm text-neutral-700">
              {["Products", "For Work", "Resources"].map((l) => (
                <button key={l} className="flex items-center gap-1 hover:text-black">
                  {l} <ChevronDown className="w-3 h-3" />
                </button>
              ))}
              <button className="hover:text-black">Pricing</button>
              <button onClick={newProject} className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-3 py-1 text-sm font-medium flex items-center gap-2 transition">
                Agent <span className="bg-white/25 rounded-full px-1.5 text-[10px] font-semibold">{projects.length}</span>
              </button>
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-5 text-sm">
            <button className="hover:text-black text-neutral-700">Contact sales</button>
            <button className="hover:text-black text-neutral-700">Log in</button>
            <button className="border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition rounded-full px-4 py-1.5 font-medium">Create account</button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-4 bg-gradient-to-b from-neutral-900 to-neutral-700 bg-clip-text text-transparent">
              What will you build?
            </h1>
            <p className="text-neutral-500 mb-10 text-base">You can always make changes later.</p>

            <div className="bg-white border border-neutral-200/70 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] p-4 text-left transition focus-within:border-orange-300 focus-within:shadow-[0_20px_60px_-20px_rgba(251,146,60,0.3)]">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Describe your idea, Replit will bring it to life..."
                rows={2}
                className="w-full resize-none outline-none bg-transparent text-base placeholder:text-neutral-400 px-2 py-1"
              />
              <div className="flex items-center justify-between mt-2">
                <button className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600">
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={submit}
                  disabled={!prompt.trim()}
                  className="bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full p-2.5 transition shadow-md shadow-orange-500/30"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 md:gap-6 mt-10 flex-wrap">
              {categories.map(({ icon: Icon, label }) => (
                <button key={label} className="group flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-white border border-neutral-200 grid place-items-center group-hover:shadow-md group-hover:-translate-y-0.5 transition">
                    <Icon className="w-5 h-5 text-neutral-700" />
                  </div>
                  <span className="text-xs text-neutral-600 group-hover:text-neutral-900">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 mt-10 mb-3">
              Try an example prompt <RefreshCw className="w-3 h-3" />
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="border border-neutral-200 bg-white/80 backdrop-blur rounded-full px-4 py-1.5 text-sm hover:bg-white hover:border-neutral-300 hover:shadow-sm transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Projects list */}
          <section className="mt-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Folder className="w-5 h-5 text-orange-500" /> Vos projets
                <span className="text-sm text-neutral-400 font-normal">({projects.length})</span>
              </h2>
              <button onClick={newProject} className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Nouveau
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white/60 border border-dashed border-neutral-300 rounded-2xl p-12 text-center text-neutral-500 text-sm">
                Aucun projet pour l'instant. Décrivez votre idée ci-dessus pour commencer.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => openProject(p.id)}
                    className="group cursor-pointer bg-white border border-neutral-200/70 rounded-2xl p-5 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] hover:border-orange-300 hover:-translate-y-0.5 transition relative"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 grid place-items-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <button
                        onClick={(e) => remove(e, p.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="font-medium text-neutral-900 truncate">{p.name}</div>
                    <div className="text-xs text-neutral-500 mt-1 line-clamp-2 min-h-[2rem]">{p.prompt || "—"}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-3">
                      <Clock className="w-3 h-3" />
                      {new Date(p.updatedAt).toLocaleString()}
                      <span className="ml-auto text-neutral-400">{Object.keys(p.files).length} fichiers</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
