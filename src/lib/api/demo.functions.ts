import { createServerFn } from "@tanstack/react-start";

/**
 * Starts a shared demo session.
 *
 * The demo password lives only in `DEMO_ACCOUNT_PASSWORD` on the server; the
 * browser never sees it. Every session wipes and re-seeds the demo account so
 * it always looks pristine, and all writes are scoped to the demo user's id.
 */
export const startDemoSession = createServerFn({ method: "POST" }).handler(async () => {
  const { DEMO_EMAIL } = await import("@/lib/demoAccount");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { wipeAndSeedDemo } = await import("./demo-seed.server");
  const { createClient } = await import("@supabase/supabase-js");

  const password = process.env["DEMO_ACCOUNT_PASSWORD"];
  const url = process.env["SUPABASE_URL"];
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!password || !url || !publishable) {
    throw new Error("Demo mode isn't configured on this deployment.");
  }

  // 1. Ensure the demo user exists (created once, email pre-confirmed)
  let userId: string | null = null;
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL);
  if (existing) {
    userId = existing.id;
    // Keep the password in sync with the current secret.
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
  } else {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Demo User",
        display_name: "Demo",
        country: "United Kingdom",
        currency: "GBP",
      },
    });
    if (createErr || !created?.user) {
      throw new Error("Could not prepare the demo account.");
    }
    userId = created.user.id;
  }

  // 2. Fresh sandbox data
  await wipeAndSeedDemo(supabaseAdmin, userId);

  // 3. Sign in and hand the session back to the browser
  const anon = createClient(url, publishable, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInErr } = await anon.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password,
  });
  if (signInErr || !session.session) {
    throw new Error("Could not start the demo session.");
  }

  return {
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
  };
});
