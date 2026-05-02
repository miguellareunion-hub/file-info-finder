import { createFileRoute } from "@tanstack/react-router";
import { AgentChat } from "@/components/AgentChat";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Replit Assistant Clone — LM Studio" },
      { name: "description", content: "Agent IA reproduisant le Replit Assistant, branché sur LM Studio en local." },
    ],
  }),
});

function Index() {
  return <AgentChat />;
}
