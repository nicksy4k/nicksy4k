import { createFileRoute } from "@tanstack/react-router";
import { SetupWizard } from "@/components/setup/SetupWizard";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Setup wizard — Ledgerly" },
      {
        name: "description",
        content:
          "Configure your cycle, balance, categories, and recurring income to get Ledgerly ready in a few minutes.",
      },
      { property: "og:title", content: "Setup wizard — Ledgerly" },
      {
        property: "og:description",
        content:
          "Configure your cycle, balance, categories, and recurring income to get Ledgerly ready in a few minutes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupWizard,
});
