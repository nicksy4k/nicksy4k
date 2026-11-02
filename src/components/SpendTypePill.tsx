import { cn } from "@/lib/utils";
import { itemSpendType, type SpendType } from "@/lib/spendType";

/** One-tap Essential / Fun toggle. Shows the category default until tapped. */
export function SpendTypePill({
  category,
  value,
  onChange,
}: {
  category: string;
  value?: SpendType | null;
  onChange: (v: SpendType | null) => void;
}) {
  const current = itemSpendType({ category, spend_type: value });
  const essential = current === "essential";
  return (
    <button
      type="button"
      onClick={() => {
        const flipped: SpendType = essential ? "fun" : "essential";
        // Flipping back to the category default clears the override.
        onChange(itemSpendType({ category, spend_type: null }) === flipped ? null : flipped);
      }}
      title="Tap to switch between Essential and Fun / Personal"
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        essential
          ? "border-border bg-muted text-muted-foreground"
          : "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      {essential ? "Essential" : "Fun / Personal"}
      {value ? " ·" : ""}
    </button>
  );
}
