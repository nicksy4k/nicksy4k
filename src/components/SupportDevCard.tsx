import { Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Swap these for the real handles once the accounts are live. */
const BUY_ME_A_MONSTER_URL = "https://buymeacoffee.com/ledgerly";
const KOFI_URL = "https://ko-fi.com/ledgerly";

/**
 * Compact "Support Development" card — used on the landing page and in
 * Settings › About. Purely presentational.
 */
export function SupportDevCard({ className }: { className?: string }) {
  return (
    <Card className={`border-primary/25 bg-primary/5 ${className ?? ""}`}>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-lg bg-primary/15 p-2 text-primary">
            <Heart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-semibold tracking-tight">
              Buy the Dev a Monster ⚡
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-prose">
              Enjoying Ledgerly? If this app saves you spreadsheet headaches, consider
              supporting hosting costs or fueling the next feature update!
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <a href={BUY_ME_A_MONSTER_URL} target="_blank" rel="noopener noreferrer">
              ⚡ Buy Me a Monster
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
              ☕ Support on Ko-fi
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
