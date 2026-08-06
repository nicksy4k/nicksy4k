import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import * as React from "react";
import { render } from "@react-email/render";

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

const SITE_NAME = "Ledgerly";
const SENDER_DOMAIN = "notify.itemizedkeeper.co.uk";
const FROM_DOMAIN = "itemizedkeeper.co.uk";

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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Never trust a client-supplied user_id. Only attribute feedback to an
        // account when a valid access token is presented and verified here.
        let verifiedUserId: string | null = null;
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (token) {
          const { data: userData } = await supabaseAdmin.auth.getUser(token);
          verifiedUserId = userData.user?.id ?? null;
        }

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
            user_id: verifiedUserId,
            app_version: data.app_version ?? null,
            route: data.route ?? null,
            user_agent: data.user_agent ?? null,
            attachment_path: data.attachment_path ?? null,
          })
          .select("id")
          .single();

        if (error) {
          console.error("[feedback] insert failed", error);
          return new Response(JSON.stringify({ error: "Failed to save feedback." }), {
            status: 500,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }

        // Enqueue the notification email to the app owner. Non-fatal —
        // submission is already saved to the feedback table.
        try {
          const { TEMPLATES } = await import("@/lib/email-templates/registry");
          const entry = TEMPLATES["feedback-notification"];
          if (entry && entry.to) {
            const submittedAt = new Date().toISOString();
            const templateData = {
              type: data.type,
              severity: data.severity ?? null,
              subject: data.subject,
              message: data.message,
              email: data.email,
              appVersion: data.app_version ?? "",
              route: data.route ?? "",
              userAgent: data.user_agent ?? "",
              attachmentPath: data.attachment_path ?? null,
              submittedAt,
            };
            const element = React.createElement(entry.component, templateData);
            const html = await render(element);
            const text = await render(element, { plainText: true });
            const resolvedSubject =
              typeof entry.subject === "function" ? entry.subject(templateData) : entry.subject;
            const messageId = crypto.randomUUID();

            // email_send_log / enqueue_email are provisioned by the email infrastructure
            // migration and aren't in the generated types until the next regeneration.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const admin = supabaseAdmin as any;

            await admin.from("email_send_log").insert({
              message_id: messageId,
              template_name: "feedback-notification",
              recipient_email: entry.to,
              status: "pending",
            });

            const { error: enqErr } = await admin.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                message_id: messageId,
                to: entry.to,
                from: `${SITE_NAME} Feedback <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: resolvedSubject,
                html,
                text,
                purpose: "transactional",
                label: "feedback-notification",
                idempotency_key: `feedback-${inserted?.id}`,
                // Fixed dev-owner recipient — no user unsubscribe surface needed.
                unsubscribe_token: "",
                queued_at: new Date().toISOString(),
              },
            });
            if (enqErr) {
              console.error("[feedback] enqueue failed", enqErr);
            } else {
              await supabaseAdmin
                .from("feedback")
                .update({ email_sent: true, email_sent_at: new Date().toISOString() })
                .eq("id", inserted!.id);
            }
          }
        } catch (mailErr) {
          console.error("[feedback] email send failed", mailErr);
        }

        return new Response(JSON.stringify({ ok: true, id: inserted?.id }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      },
    },
  },
});
