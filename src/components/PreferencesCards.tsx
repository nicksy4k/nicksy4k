import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Coins, Palette, HeartHandshake, Check } from "lucide-react";
import {
  CURRENCIES, CUSTOM_CURRENCY, THEMES, usePreferences, formatMoney,
} from "@/lib/preferences";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */

export function CurrencySettingsCard() {
  const { prefs, update } = usePreferences();
  const [customDraft, setCustomDraft] = useState(prefs.customSymbol);

  const isCustom = prefs.currency === CUSTOM_CURRENCY;
  const sample = formatMoney(1234.5, prefs);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" /> Currency
        </CardTitle>
        <CardDescription>
          Changes how amounts are displayed everywhere. Your recorded figures are never
          converted or altered — only the symbol and formatting change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pref-currency">Currency</Label>
            <Select
              value={prefs.currency}
              onValueChange={(v) => {
                update({ currency: v });
                toast.success("Currency updated");
              }}
            >
              <SelectTrigger id="pref-currency"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} {c.symbol} — {c.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_CURRENCY}>Custom symbol…</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pref-position">Symbol position</Label>
            <Select
              value={prefs.symbolPosition}
              onValueChange={(v) => update({ symbolPosition: v === "after" ? "after" : "before" })}
            >
              <SelectTrigger id="pref-position"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before the amount</SelectItem>
                <SelectItem value="after">After the amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isCustom && (
          <div className="space-y-1.5 max-w-40">
            <Label htmlFor="pref-symbol">Custom symbol</Label>
            <Input
              id="pref-symbol"
              maxLength={4}
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onBlur={() => update({ customSymbol: customDraft.trim() || "¤" })}
              placeholder="₿"
            />
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Preview</p>
          <p className="mt-1 text-2xl font-display font-semibold tabular-nums">{sample}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function ThemePickerCard() {
  const { prefs, update } = usePreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" /> Theme
        </CardTitle>
        <CardDescription>
          Pick the palette that feels most comfortable. Every theme is contrast-checked
          for readability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEMES.map((t) => {
            const active = prefs.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ theme: t.id })}
                aria-pressed={active}
                className={`group rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:border-border hover:bg-accent/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.name}</span>
                  {active && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Check className="h-3 w-3" /> Active
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.blurb}</p>
                <div className="mt-3 flex items-center gap-1.5">
                  {t.swatches.map((s, i) => (
                    <span
                      key={i}
                      className="h-6 w-6 rounded-md border border-border/40"
                      style={{ background: s }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function ComfortCard({ categories }: { categories: string[] }) {
  const { prefs, update } = usePreferences();

  function toggleJoy(cat: string) {
    const next = prefs.joyCategories.includes(cat)
      ? prefs.joyCategories.filter((c) => c !== cat)
      : [...prefs.joyCategories, cat];
    update({ joyCategories: next });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-primary" /> Comfort &amp; charts
        </CardTitle>
        <CardDescription>
          Ledgerly is a record, not a report card. Tune how much it shows you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="pref-blur" className="text-sm">Blur balances until hovered</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keeps headline figures private on shared screens. Hover or tap to reveal.
            </p>
          </div>
          <Switch
            id="pref-blur"
            checked={prefs.blurAmounts}
            onCheckedChange={(v) => update({ blurAmounts: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="pref-pie" className="text-sm">Hide the category breakdown chart</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              No pie chart on the dashboard — your totals stay, the visual judgement goes.
            </p>
          </div>
          <Switch
            id="pref-pie"
            checked={prefs.hideCategoryChart}
            onCheckedChange={(v) => update({ hideCategoryChart: v })}
          />
        </div>

        <div>
          <Label className="text-sm">Fun money categories</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">
            Mark the things you spend on for enjoyment. They're grouped as planned fun on the
            dashboard instead of being singled out.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.length === 0 && (
              <span className="text-xs text-muted-foreground">No categories yet.</span>
            )}
            {categories.map((c) => {
              const on = prefs.joyCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleJoy(c)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    on
                      ? "border-transparent bg-[var(--joy)]/20 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  {on ? "★ " : ""}{c}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
