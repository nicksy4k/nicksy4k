export interface TourStep {
  /** CSS selector for the target element. */
  selector: string;
  title: string;
  body: string;
  /** Preferred tooltip placement relative to target. */
  placement?: "top" | "bottom" | "left" | "right";
  /** If true, tour engine will try to force-open the sidebar before measuring. */
  requiresSidebar?: boolean;
}

export const dashboardTourSteps: TourStep[] = [
  {
    selector: "[data-tour='left-to-spend']",
    title: "Your headline number",
    body: "This is what's left in your current cycle after income, savings, and every expense. If it goes red, you've overspent.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='category-chart']",
    title: "Where your money goes",
    body: "A live breakdown by category for the active cycle. Tap a slice to focus, and use Reports for longer date ranges.",
    placement: "top",
  },
  {
    selector: "[data-tour='warranty-alerts']",
    title: "Return & warranty alerts",
    body: "Anything you tagged with a receipt and protection window shows here as it nears expiry — so you never miss a return.",
    placement: "top",
  },
  {
    selector: "[data-tour='recent']",
    title: "Recent activity",
    body: "The five most recent transactions, itemized. Head to History for filters, edits, refunds, and settling pending holds.",
    placement: "top",
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
