import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus, ArrowRight, Globe, Smartphone, LayoutGrid, Layers, Film,
  RefreshCw, Sparkles, ChevronDown,
} from "lucide-react";

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
  const navigate = useNavigate();

  const submit = () => {
    if (!prompt.trim()) return;
    navigate({ to: "/agent", search: { p: prompt } });
  };

  return (
    <div className="min-h-screen bg-[#faf6f1] text-neutral-900 selection:bg-orange-200">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-200/40 rounded-full blur-[120px]" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-pink-200/30 rounded-full blur-[100px]" />
      </div>

      <div className="relative">
        {/* Header */}
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
              <button className="hover:text-black">Security</button>
              <button className="hover:text-black">Pricing</button>
              <Link to="/agent" search={{ p: undefined }} className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-3 py-1 text-sm font-medium flex items-center gap-2 transition">
                Agent <span className="bg-white/25 rounded-full px-1.5 text-[10px] font-semibold">4</span>
              </Link>
            </nav>
          </div>
          <div className="hidden md:flex items-center gap-5 text-sm">
            <button className="hover:text-black text-neutral-700">Contact sales</button>
            <button className="hover:text-black text-neutral-700">Log in</button>
            <button className="border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition rounded-full px-4 py-1.5 font-medium">Create account</button>
          </div>
        </header>

        {/* Hero */}
        <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 text-center">
          <button className="inline-flex items-center gap-2 bg-orange-100/80 hover:bg-orange-100 border border-orange-200 rounded-full pl-4 pr-1 py-1 text-sm mb-12 transition">
            <span>Replit Agent is free today for our 10th birthday!</span>
            <span className="bg-orange-200/80 rounded-full px-2.5 py-0.5 text-xs font-medium">Learn more</span>
          </button>

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
        </main>
      </div>
    </div>
  );
}
