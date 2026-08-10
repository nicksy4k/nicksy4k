import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, EyeOff, History, Lock, KeyRound, Database, FileLock2 } from "lucide-react";
import type { ReactNode } from "react";

const PRIVACY_UPDATES: { date: string; title: string; details: string[] }[] = [
  {
    date: "2026-07-27",
    title: "Beta launch privacy baseline",
    details: [
      "Row Level Security enabled on every user table (transactions, incomes, commitments, debts, loans, savings, categories, settings).",
      "Receipts stored in a private storage bucket — no public URLs.",
      "Data at rest is encrypted by the managed database provider; all traffic uses HTTPS.",
      "Sign-in supports email + password or Google OAuth.",
    ],
  },
];

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/15 grid place-items-center text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function PrivacyDetailsDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Privacy & security details
          </DialogTitle>
          <DialogDescription>
            A plain-language look at how Ledgerly protects your financial data during the beta.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="how" className="mt-2">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="how" className="gap-2">
              <Lock className="h-3.5 w-3.5" /> Protection
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <EyeOff className="h-3.5 w-3.5" /> Access
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="how" className="mt-4 space-y-3">
            <Row icon={<Database className="h-4 w-4" />} title="Row Level Security on every table">
              Each row in the database is stamped with your user ID. Database rules enforce
              <span className="mx-1 font-mono text-[11px] px-1 py-0.5 rounded bg-background/60 border border-border/60">
                auth.uid() = user_id
              </span>
              on select, insert, update, and delete — so a query for anyone else's rows returns
              nothing, at the database level.
            </Row>
            <Row icon={<FileLock2 className="h-4 w-4" />} title="Receipts live in a private bucket">
              Uploaded receipts (images and PDFs) are stored in a private storage bucket. They
              aren't served over public URLs — the app opens them for you through authenticated,
              short-lived signed requests.
            </Row>
            <Row
              icon={<KeyRound className="h-4 w-4" />}
              title="Encrypted at rest, HTTPS in transit"
            >
              The managed database provider encrypts data on disk. All network traffic between your
              device and the backend uses HTTPS.
            </Row>
            <Row icon={<ShieldCheck className="h-4 w-4" />} title="Sign-in options">
              You can sign in with email + password or Google OAuth. Passwords are never stored by
              the app — auth is handled by the managed identity provider.
            </Row>
          </TabsContent>

          <TabsContent value="access" className="mt-4 space-y-3">
            <Row
              icon={<EyeOff className="h-4 w-4" />}
              title="What the app developer can and can't see"
            >
              Through the normal Ledgerly app the developer cannot read your financial records — RLS
              blocks it just like it blocks any other user. Administrative database tooling exists
              (it has to, so backups and schema migrations work), but it is never used to browse
              your rows.
            </Row>
            <Row icon={<Database className="h-4 w-4" />} title="What is necessarily processed">
              Your auth email, sign-in timestamps, and diagnostic error logs are processed to keep
              the service running. Optional, opt-in Google Analytics measures page and feature usage only if you accept it — never your amounts or entries. No advertising trackers are embedded.
            </Row>
            <Row icon={<History className="h-4 w-4" />} title="You own the export">
              Use "Download my data" in Settings to pull a complete ZIP of every row plus your
              receipt files at any time.
            </Row>
            <p className="text-[11px] text-muted-foreground italic">
              This is a personal beta project, not a certified financial service. No absolute
              guarantees are made — please don't store data you couldn't recreate.
            </p>
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {PRIVACY_UPDATES.map((entry) => (
              <div key={entry.date} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{entry.date}</p>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground leading-relaxed">
                  {entry.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Future changes to how Ledgerly stores or protects data will be logged here.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
