## The problem

`supabase.auth.linkIdentity()` requires the **Manual Linking** setting to be turned on in Supabase Auth. On Lovable Cloud that toggle is not exposed — neither in the Cloud UI nor through the `configure_auth` tool available to me. So the button we built in `ConnectedAccountsCard` cannot work on this project as it stands, and there is no code change that will make `linkIdentity` succeed.

## Options

**Option A — Remove the linking UI and use "same email" auto‑association (recommended)**
- Delete the Link/Unlink buttons from `ConnectedAccountsCard.tsx`; keep it as a read‑only "Connected sign‑in methods" card that lists identities from `supabase.auth.getUserIdentities()`.
- Document in the card: to add Google to your existing account, sign out, click **Continue with Google**, and use the Google account whose email matches your Ledgerly email. Supabase will attach that Google identity to your existing user (works when both emails are verified).
- If your Google email is different from your Ledgerly email, linking is not possible on Lovable Cloud today — you'd sign in as a separate account.

**Option B — Keep the UI, ask you to enable Manual Linking yourself**
- Only viable if you connect this project to Supabase directly (Connectors → Supabase) so you get dashboard access. Then: Authentication → Sign In / Providers → enable **Manual linking**. After that, the existing Link Google button will start working. This is a bigger change to your project setup.

**Option C — Build an email‑change bridge**
- Add a flow that changes your account email to your Google email first, then prompts a Google sign‑in so the "same email" auto‑match happens. More moving parts, easier to get wrong, and still can't unlink later without Manual Linking.

## Recommendation

Go with **Option A**. It's the honest fix for the Lovable Cloud constraint, removes the broken button, and gives you a working path (sign in with Google using the matching email) to consolidate accounts.

## Files touched (Option A)

- `src/components/ConnectedAccountsCard.tsx` — drop `linkIdentity`/`unlinkIdentity` calls and the Link/Disconnect buttons; render identities list + short instructions.
- No DB or auth‑config changes.

Confirm Option A and I'll implement, or tell me if you'd rather pursue B or C.