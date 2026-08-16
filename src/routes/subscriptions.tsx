import { createFileRoute, redirect } from "@tanstack/react-router";

/** Subscriptions now live on the combined Outgoings page. */
export const Route = createFileRoute("/subscriptions")({
  beforeLoad: () => {
    throw redirect({ to: "/commitments", search: { view: "subs" } });
  },
});
