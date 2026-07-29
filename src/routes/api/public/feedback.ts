import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["bug", "idea", "general"]),
  severity: z.enum(["low", "medium", "high"]).optional(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
  email: z.string().trim().email().max(255),
  user_id: z.string().uuid().nullable().optional(),
  app_version: z.string().max(64).nullable().optional(),
  route: z.string().max(256).nullable().optional(),
  user_agent: z.string().max(1024).nullable().optional(),
  attachment_path: z.string().max(512).nullable().optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/feedback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400, headers: cors });
        }
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid input" }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        const data = parsed.data;

        // Insert with service role so RLS doesn't get in the way (and we can
        // record submissions from both signed-in and anonymous testers).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Simple rate limit: max 5 submissions / 10 min for this email
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("email", data.email)
          .gte("created_at", tenMinAgo);
        if ((count ?? 0) >= 5) {
          return new Response(
            JSON.stringify({ error: "Too many submissions — please wait a few minutes." }),
            { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }

        const { data: inserted, error } = await supabaseAdmin
          .from("feedback")
          .insert({
            type: data.type,
            severity: data.severity ?? null,
            subject: data.subject,
            message: data.message,
            email: data.email,
            user_id: data.user_id ?? null,
            app_version: data.app_version ?? null,
            route: data.route ?? null,
            user_agent: data.user_agent ?? null,
            attachment_path: data.attachment_path ?? null,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[feedback] insert failed", error);
          return new Response(
            JSON.stringify({ error: "Failed to save feedback." }),
            { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }

        // Email delivery to the app owner is wired once the Lovable Emails
        // domain finishes DNS verification. Submissions are always saved to
        // the feedback table so nothing is lost in the meantime.

        return new Response(
          JSON.stringify({ ok: true, id: inserted?.id }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      },
    },
  },
});
