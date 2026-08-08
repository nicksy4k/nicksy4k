import { Link } from "@tanstack/react-router";

/** Slim legal footer rendered under every signed-in page. */
export function LegalFooter() {
  return (
    <footer className="border-t border-border/60 px-4 py-4 md:px-6 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <Link to="/privacy" className="hover:text-foreground hover:underline">
          Privacy Policy
        </Link>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        <Link to="/beta-disclaimer" className="hover:text-foreground hover:underline">
          Beta Disclaimer
        </Link>
        <span aria-hidden className="opacity-40">
          ·
        </span>
        <Link to="/cookies" className="hover:text-foreground hover:underline">
          Cookie Notice
        </Link>
      </div>
      <p className="mt-1.5 text-center">
        © {new Date().getFullYear()} Ledgerly · Built by Nicksy4K. All rights reserved.
      </p>
    </footer>
  );
}
