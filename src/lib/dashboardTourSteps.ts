export type TourActionKind = "add-spend" | "filter-category" | "open-alert" | "expand-txn";

export interface TourAction {
  label: string;
  doneLabel: string;
  kind: TourActionKind;
}

export interface TourStep {
  /** CSS selector for the target element. */
  selector: string;
  title: string;
  body: string;
  /** Preferred tooltip placement relative to target. */
  placement?: "top" | "bottom" | "left" | "right";
  /** If true, tour engine will try to force-open the sidebar before measuring. */
  requiresSidebar?: boolean;
  /** Optional interactive "Try it" action for this step. */
  action?: TourAction;
}

export const dashboardTourSteps: TourStep[] = [
  {
    selector: "[data-tour='safe-to-spend']",
    title: "Your headline number",
    body: "This is what's safe to spend today after your main balance and any unpaid outgoings in this cycle. Try logging a demo £12 spend and watch it drop live.",
    placement: "bottom",
    action: { label: "Log a demo £12 coffee", doneLabel: "Logged — hit Next", kind: "add-spend" },
  },
  {
    selector: "[data-tour='category-chart']",
    title: "Where your money goes",
    body: "A live breakdown by category for the active cycle. Try filtering the chart to Groceries to see how focus works.",
    placement: "top",
    action: {
      label: "Filter to Groceries",
      doneLabel: "Filter on — hit Next",
      kind: "filter-category",
    },
  },
  {
    selector: "[data-tour='warranty-alerts']",
    title: "Return & warranty alerts",
    body: "Anything you tagged with a receipt and protection window shows up here as it nears expiry — so you never miss a return.",
    placement: "top",
    action: { label: "Open the first alert", doneLabel: "Opened — hit Next", kind: "open-alert" },
  },
  {
    selector: "[data-tour='recent']",
    title: "Recent activity",
    body: "The five most recent transactions, itemized. Expand one to see the line items and prices Ledgerly tracks per receipt.",
    placement: "top",
    action: {
      label: "Expand this transaction",
      doneLabel: "Expanded — hit Next",
      kind: "expand-txn",
    },
  },
  {
    selector: "[data-tour='nav-new']",
    title: "Log a new spend",
    body: "Add a transaction with itemization, split payments across pockets or BNPLs, and attach receipts.",
    placement: "right",
    requiresSidebar: true,
  },
  {
    selector: "[data-tour='nav-commitments']",
    title: "Bills & commitments",
    body: "Recurring bills roll forward automatically each cycle. Mark them paid, or use the +1 Month / +4 Weeks controls per bill.",
    placement: "right",
    requiresSidebar: true,
  },
  {
    selector: "[data-tour='nav-settings']",
    title: "Settings & re-runs",
    body: "Manage cycle, categories, and data. You can re-run this tour or the setup wizard any time from the Data tab.",
    placement: "right",
    requiresSidebar: true,
  },
];
