import { Coffee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FULL_STORY = [
  "Hi, I'm Nick 👋",
  "Ledgerly started as a personal quest to solve a very specific headache. For a long time, I managed my money using spreadsheets—but wrestling with fragile Excel formulas, 28-day pay cycles, and itemized receipt math quickly became a chaotic mess.",
  "As someone navigating suspected ADHD & Autism, generic budgeting apps just didn't fit how my brain works. I needed absolute structure, itemized clarity, and a friction-free keyboard setup that gets out of the way so I can log spends without getting overwhelmed.",
  "Fueled by late-night coding sessions and a steady supply of Monster Energy, I decided to build my own solution using React, Supabase, and AI tools like Lovable.",
  "While Ledgerly was built primarily for my own daily use, I've taken a huge amount of pride in how fast, private, and polished it's become—and I'm excited to share it with fellow organizers and budget nerds!",
];

const CONDENSED_STORY = [
  "Hi, I'm Nick 👋",
  "Ledgerly began as a spreadsheet replacement — fragile Excel formulas, 28-day pay cycles, and itemized receipt math had become a chaotic mess. Navigating suspected ADHD & Autism, I needed absolute structure and a friction-free keyboard setup that generic budgeting apps never offered.",
  "So I built my own with React, Supabase and Lovable, fuelled by late nights and Monster Energy. It's my daily driver — and I'm glad to share it with fellow organizers and budget nerds.",
];

/**
 * "The Story Behind Ledgerly" — presentational only, safe to render on the
 * public landing page as well as inside authenticated Settings.
 */
export function AboutStory({
  variant = "full",
  className,
}: {
  variant?: "full" | "condensed";
  className?: string;
}) {
  const paragraphs = variant === "full" ? FULL_STORY : CONDENSED_STORY;

  return (
    <Card className={`border-border/60 bg-card/40 backdrop-blur-sm ${className ?? ""}`}>
      <CardContent className="p-4 md:p-5 md:p-7">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            <Coffee className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              The story behind Ledgerly
            </p>
            <h2 className="mt-1.5 text-xl md:text-2xl font-display font-semibold tracking-tight text-balance">
              Built for Real-World Cash Flow. Fuelled by Caffeine.
            </h2>
          </div>
        </div>

        <div className="mt-4 space-y-3 max-w-prose text-sm md:text-[0.95rem] leading-relaxed text-muted-foreground">
          {paragraphs.map((p, i) => (
            <p key={i} className={i === 0 ? "text-foreground font-medium" : undefined}>
              {p}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
