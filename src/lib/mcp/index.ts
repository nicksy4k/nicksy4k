import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import listCommitments from "./tools/list-commitments";
import listSavings from "./tools/list-savings";
import listCategories from "./tools/list-categories";
import createTransaction from "./tools/create-transaction";
import addItemsToTransaction from "./tools/add-items-to-transaction";
import markCommitmentPaid from "./tools/mark-commitment-paid";

// The OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL
// is rewritten to the `.lovable.cloud` proxy, which mcp-js rejects (RFC 8414
// issuer mismatch). VITE_SUPABASE_PROJECT_ID is inlined at build time by Vite
// and survives publish unchanged. The fallback keeps the string well-formed
// during the throwaway manifest-extract eval; a real token never verifies
// against the sentinel.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ledgerly-mcp",
  title: "Ledgerly",
  version: "0.2.0",
  instructions:
    "Tools for a signed-in Ledgerly user. Read transactions, commitments, savings pockets, and categories; log new spending transactions (including split payments); append line items to an existing (typically pending) transaction; and mark commitments as paid. Every tool acts as the authenticated user under Row Level Security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTransactions,
    listCommitments,
    listSavings,
    listCategories,
    createTransaction,
    addItemsToTransaction,
    markCommitmentPaid,
  ],
});
