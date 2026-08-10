import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { Bug, Lightbulb, MessageSquare, Loader2, Paperclip, X, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, FEEDBACK_EMAIL } from "@/lib/support";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";

const MAX_ATTACHMENT_MB = 5;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"];

const schema = z.object({
  type: z.enum(["bug", "idea", "general"]),
  severity: z.enum(["low", "medium", "high"]).optional(),
  subject: z.string().trim().min(3, "Give it a short title (3+ chars).").max(120),
  message: z.string().trim().min(10, "A little more detail helps (10+ chars).").max(4000),
  email: z.string().trim().email("Enter a valid email so I can reply.").max(255),
});

type Type = "bug" | "idea" | "general";
type Severity = "low" | "medium" | "high";

interface Props {
  children: ReactNode;
  defaultType?: Type;
  /** Anonymous mode = no signed-in user; force the email field to be required and editable. */
  anonymous?: boolean;
}

export function FeedbackDialog({ children, defaultType = "general", anonymous = false }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<Type>(defaultType);
  const [severity, setSeverity] = useState<Severity>("medium");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Load session so signed-in testers don't have to retype their email
  useEffect(() => {
    if (!open || anonymous) return;
    supabase.auth.getUser().then(({ data }) => {
      const em = data.user?.email ?? null;
      setSignedInEmail(em);
      setUserId(data.user?.id ?? null);
      if (em && !email) setEmail(em);
    });
  }, [open, anonymous, email]);

  useEffect(() => {
    if (open) setType(defaultType);
  }, [open, defaultType]);

  const reset = () => {
    setSubject("");
    setMessage("");
    setFile(null);
    setFileError(null);
    setSeverity("medium");
  };

  const handleFile = (f: File | null) => {
    setFileError(null);
    if (!f) return setFile(null);
    if (!ALLOWED_MIME.includes(f.type)) {
      setFileError("Only PNG, JPG, GIF, WebP or PDF files.");
      return;
    }
    if (f.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setFileError(`Attachment must be under ${MAX_ATTACHMENT_MB} MB.`);
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    const parsed = schema.safeParse({
      type,
      severity: type === "bug" ? severity : undefined,
      subject,
      message,
      email,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setSubmitting(true);
    try {
      // 1) Optional attachment upload
      let attachment_path: string | null = null;
      if (file) {
        const folder = userId ?? "anon";
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const key = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feedback-attachments")
          .upload(key, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        attachment_path = key;
      }

      // 2) Submit through the public feedback endpoint. The server derives the
      // account from this token — it never trusts a client-supplied user id.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const res = await fetch("/api/public/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && !anonymous ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          ...parsed.data,
          app_version: APP_VERSION,
          route: pathname,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          attachment_path,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Server responded ${res.status}`);
      }

      trackEvent("feedback_sent");
      toast.success("Feedback sent — thank you! 🙏");
      reset();
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg, {
        description: `You can also email ${FEEDBACK_EMAIL} directly.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const typeIcon =
    type === "bug" ? (
      <Bug className="h-4 w-4" />
    ) : type === "idea" ? (
      <Lightbulb className="h-4 w-4" />
    ) : (
      <MessageSquare className="h-4 w-4" />
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{typeIcon} Share feedback</DialogTitle>
          <DialogDescription>
            Ledgerly is in beta — your notes go straight to the developer's inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["bug", "idea", "general"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition ${
                    type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t === "bug" ? "🐞 Bug" : t === "idea" ? "💡 Idea" : "💬 General"}
                </button>
              ))}
            </div>
          </div>

          {/* Severity (bugs only) */}
          {type === "bug" && (
            <div className="space-y-2">
              <Label>Severity</Label>
              <RadioGroup
                value={severity}
                onValueChange={(v) => setSeverity(v as Severity)}
                className="flex gap-4"
              >
                {(["low", "medium", "high"] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <RadioGroupItem value={s} id={`sev-${s}`} />
                    <Label htmlFor={`sev-${s}`} className="capitalize text-sm font-normal">
                      {s}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="fb-subject">Subject</Label>
            <Input
              id="fb-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={type === "bug" ? "e.g. Refund button doesn't save" : "Short summary"}
              maxLength={120}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="fb-message">
              {type === "bug" ? "What happened & how to reproduce" : "Details"}
            </Label>
            <Textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={
                type === "bug"
                  ? "Steps to reproduce, what you expected, what you got..."
                  : "Tell me more..."
              }
              maxLength={4000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/4000</p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="fb-email">
              Your email{" "}
              {signedInEmail && !anonymous && (
                <span className="text-xs text-muted-foreground font-normal">
                  (from your account)
                </span>
              )}
            </Label>
            <Input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              readOnly={!!signedInEmail && !anonymous}
              className={signedInEmail && !anonymous ? "bg-muted/50" : ""}
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label>
              Screenshot or file{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (optional, max {MAX_ATTACHMENT_MB} MB)
              </span>
            </Label>
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs flex-1 truncate">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setFile(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-4 cursor-pointer hover:bg-muted/50 hover:border-primary/40 transition">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Click to attach an image or PDF
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept={ALLOWED_MIME.join(",")}
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>

          {/* Auto-context */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
              Automatically included
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {APP_VERSION}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                page: {pathname}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                browser info
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
