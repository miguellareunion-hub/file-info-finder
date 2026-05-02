import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, ArrowRight, Globe, Smartphone, LayoutGrid, Layers, Film, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Replit Clone — What will you build?" },
      { name: "description", content: "Décrivez votre idée, on la construit pour vous." },
    ],
  }),
});

const examples = ["Startup pitch explainer", "Product launch presentation", "3D racing game"];
const categories = [
  { icon: Globe, label: "Website" },
  { icon: Smartphone, label: "Mobile" },
  { icon: LayoutGrid, label: "Design" },
  { icon: Layers, label: "Slides" },
  { icon: Film, label: "Animation" },
];

function Home() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const submit = () => {
    if (!prompt.trim()) return;
    navigate({ to: "/agent", search: { p: prompt } as any });
  };

  return (
    <div className="min-h-screen bg-[#faf6f1] text-neutral-900">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 text-2xl font-bold">
            <span className="text-orange-500">✦</span> Replit
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-700">
            <span className="cursor-pointer hover:text-black">Products ⌄</span>
            <span className="cursor-pointer hover:text-black">For Work ⌄</span>
            <span className="cursor-pointer hover:text-black">Resources ⌄</span>
            <span className="cursor-pointer hover:text-black">Security</span>
            <span className="cursor-pointer hover:text-black">Pricing</span>
            <Link to="/agent" className="bg-orange-500 text-white rounded-full px-3 py-1 text-sm font-medium flex items-center gap-2">
              Agent <span className="bg-white/30 rounded-full px-1.5 text-xs">4</span>
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <span className="cursor-pointer">Contact sales</span>
          <span className="cursor-pointer">Log in</span>
          <button className="border border-orange-500 text-orange-500 rounded-full px-4 py-1.5">Create account</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-100/60 border border-orange-200 rounded-full px-4 py-1.5 text-sm mb-12">
          Replit Agent is free today for our 10th birthday!
          <button className="bg-orange-200/70 rounded-full px-2 py-0.5 text-xs">Learn more</button>
        </div>

        <h1 className="text-6xl font-semibold tracking-tight mb-3">What will you build?</h1>
        <p className="text-neutral-500 mb-10">You can always make changes later.</p>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 text-left">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Describe your idea, Replit will bring it to life..."
            className="w-full resize-none outline-none bg-transparent text-base placeholder:text-neutral-400 min-h-[40px]"
          />
          <div className="flex items-center justify-between mt-2">
            <button className="p-1.5 rounded-md hover:bg-neutral-100"><Plus className="w-4 h-4" /></button>
            <button onClick={submit} className="bg-orange-400 hover:bg-orange-500 text-white rounded-full p-2">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-8">
          {categories.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <button className="w-12 h-12 rounded-xl bg-white border border-neutral-200 flex items-center justify-center hover:shadow-sm">
                <Icon className="w-5 h-5 text-neutral-600" />
              </button>
              <span className="text-xs text-neutral-600">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 mt-8 mb-3">
          Try an example prompt <RefreshCw className="w-3 h-3" />
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="border border-neutral-200 bg-white rounded-full px-4 py-1.5 text-sm hover:bg-neutral-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
