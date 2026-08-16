import { createFileRoute, redirect } from "@tanstack/react-router";

/** Subscriptions now live on the combined Outgoings page. */
export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — Ledgerly Outgoings" },
      {
        name: "description",
        content:
          "Your subscriptions now live on the combined Ledgerly Outgoings page, alongside bills and recurring payments.",
      },
      { property: "og:title", content: "Subscriptions — Ledgerly Outgoings" },
      {
        property: "og:description",
        content:
          "Your subscriptions now live on the combined Ledgerly Outgoings page, alongside bills and recurring payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/commitments", search: { view: "subs" } });
  },
});
