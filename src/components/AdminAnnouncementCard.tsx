import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  useAnnouncement,
  useUpdateAnnouncement,
  type AnnouncementVariant,
} from "@/lib/announcement";
import { AnnouncementBody } from "@/components/AnnouncementBanner";

/** Admin-only editor for the site-wide announcement banner. */
export function AdminAnnouncementCard() {
  const { data, isLoading } = useAnnouncement();
  const update = useUpdateAnnouncement();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<AnnouncementVariant>("info");

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setMessage(data.message);
    setVariant(data.variant);
  }, [data]);

  async function save(patch?: { enabled: boolean }) {
    try {
      await update.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        variant,
        ...(patch ?? {}),
      });
      toast.success(
        patch
          ? patch.enabled
            ? "Announcement is now live."
            : "Announcement hidden."
          : "Announcement saved.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the announcement.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Announcement banner
        </CardTitle>
        <CardDescription>
          Show a message at the top of the dashboard and the sign-in page. Only admins can edit it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="announcement-on" className="text-sm font-medium">
              Show the banner
            </Label>
            <p className="text-xs text-muted-foreground max-w-md">
              When off, nobody sees it. Dismissing the banner hides it for the current session.
            </p>
          </div>
          <Switch
            id="announcement-on"
            checked={Boolean(data?.enabled)}
            disabled={isLoading || update.isPending}
            onCheckedChange={(next) => save({ enabled: next })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Title (optional)</Label>
            <Input
              id="announcement-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Email issues"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-variant">Style</Label>
            <Select value={variant} onValueChange={(v) => setVariant(v as AnnouncementVariant)}>
              <SelectTrigger id="announcement-variant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="announcement-message">Message</Label>
          <Textarea
            id="announcement-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Please use the Feedback button in the top right to contact me."
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
          <AnnouncementBody
            announcement={{
              title,
              message: message || "Your message will appear here.",
              variant,
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {data?.updated_at
              ? `Last updated ${format(parseISO(data.updated_at), "d MMM yyyy, HH:mm")}`
              : ""}
          </p>
          <Button onClick={() => save()} disabled={update.isPending}>
            Save message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
