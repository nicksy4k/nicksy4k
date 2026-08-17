import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChangelogList } from "@/components/ChangelogList";
import {
  changelog,
  currentVersion,
  currentVersionDate,
  downloadChangelogCsv,
  markChangelogSeen,
  printChangelog,
} from "@/lib/changelog";
import { useEffect } from "react";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — Ledgerly" },
      {
        name: "description",
        content: "Every release note for Ledgerly, newest first.",
      },
      { property: "og:title", content: "Changelog — Ledgerly" },
      {
        property: "og:description",
        content: "Every release note for Ledgerly, newest first.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangelogPage,
  errorComponent: RouteError,
});

function ChangelogPage() {
  useEffect(() => {
    markChangelogSeen();
  }, []);

  return (
    <>
      <div className="max-w-3xl mx-auto px-1 py-3 md:p-10">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" /> Back to settings
          </Link>
        </Button>

        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            Release notes
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-semibold">Changelog</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {currentVersion}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {format(parseISO(currentVersionDate), "d MMM yyyy")}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Everything shipped in Ledgerly, newest first.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant="outline" size="sm" onClick={downloadChangelogCsv}>
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={printChangelog}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 md:p-6">
          <ChangelogList />
        </div>
      </div>

      {/* Printable snapshot — hidden on screen, shown by @media print */}
      <div className="print-only">
        <header className="print-header">
          <h1>Ledgerly changelog</h1>
          <p>
            {currentVersion} · Updated {format(parseISO(currentVersionDate), "d MMM yyyy")}
          </p>
          <p className="print-muted">Generated {format(new Date(), "d MMM yyyy HH:mm")}</p>
        </header>
        {changelog.map((e) => (
          <section key={e.version}>
            <h2>
              {e.version} — {e.title}{" "}
              <span style={{ fontWeight: 400, color: "#666" }}>
                ({format(parseISO(e.date), "d MMM yyyy")})
              </span>
            </h2>
            <ul>
              {e.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
