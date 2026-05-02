import { createFileRoute } from "@tanstack/react-router";
import { AgentChat } from "@/components/AgentChat";
import { Play, Plus, Search, Sidebar } from "lucide-react";

export const Route = createFileRoute("/agent")({
  component: AgentWorkspace,
  validateSearch: (s: Record<string, unknown>) => ({ p: (s.p as string) ?? "" }),
  head: () => ({ meta: [{ title: "Agent Workspace — Replit Clone" }] }),
});

function AgentWorkspace() {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#0e0e10] text-neutral-200 overflow-hidden">
      {/* Top bar */}
      <header className="h-11 flex items-center justify-between px-3 border-b border-neutral-800 bg-[#161618]">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 font-bold">✦</span>
          <div className="flex items-center gap-2 bg-[#1f1f22] rounded-md px-3 py-1 text-sm">
            <span>Welcome Page</span>
            <Play className="w-3.5 h-3.5 text-green-500 fill-green-500" />
          </div>
          <button className="bg-blue-600 text-white text-xs rounded px-2 py-1 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Upgrade
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Search className="w-4 h-4 text-neutral-400" />
          <button className="text-neutral-300">Invite</button>
          <button className="bg-blue-600 text-white rounded px-3 py-1 text-xs">Publish</button>
          <Sidebar className="w-4 h-4 text-neutral-400" />
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 flex min-h-0">
        {/* Left: chat */}
        <div className="w-[440px] border-r border-neutral-800 flex flex-col min-h-0 bg-[#0e0e10]">
          <div className="flex-1 min-h-0 overflow-hidden">
            <AgentChat />
          </div>
        </div>

        {/* Right: preview/canvas */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0e0e10]">
          <div className="h-9 border-b border-neutral-800 flex items-center px-3 gap-2 text-xs bg-[#161618]">
            <span className="bg-[#1f1f22] px-3 py-1 rounded-md">Preview</span>
            <span className="px-3 py-1 text-neutral-500">New tab</span>
            <Plus className="w-3 h-3 text-neutral-500" />
            <div className="ml-auto flex items-center gap-2 text-neutral-500">
              <span className="bg-[#1f1f22] px-2 py-0.5 rounded">Canvas</span>
              <span>Page de Bienvenue</span>
            </div>
          </div>
          <div className="flex-1 grid place-items-center text-neutral-500 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 grid grid-cols-3 gap-0.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-purple-500/60 rounded-sm" />
                ))}
              </div>
              View all your creations in 'Library' panel
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
