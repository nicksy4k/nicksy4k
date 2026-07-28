import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import listCommitments from "./tools/list-commitments";
import listSavings from "./tools/list-savings";
import listCategories from "./tools/list-categories";
import listIncomes from "./tools/list-incomes";
import getActiveCycle from "./tools/get-active-cycle";
import getMainBalance from "./tools/get-main-balance";
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
  version: "0.3.0",
  instructions:
    "Tools for a signed-in Ledgerly user. Read transactions, incomes, commitments, savings pockets, and categories; inspect the active financial cycle window; compute the main-balance 'Left to Spend' for a cycle; log new spending transactions (including split payments); append line items to an existing (typically pending) transaction; and mark commitments as paid. When the user asks 'what's left', 'how much can I spend', or about their main balance, call get_main_balance (it defaults to the active cycle). Every tool acts as the authenticated user under Row Level Security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTransactions,
    listIncomes,
    listCommitments,
    listSavings,
    listCategories,
    getActiveCycle,
    getMainBalance,
    createTransaction,
    addItemsToTransaction,
    markCommitmentPaid,
  ],
});
