import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, X, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  value: string;
  onChange: (path: string) => void;
}

function isStoragePath(v: string) {
  return !!v && !v.startsWith("http") && v.includes("/") && !v.includes(" ");
}

export function ReceiptUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const hasFile = isStoragePath(value);
  const filename = hasFile ? value.split("/").pop() : "";

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Unsupported file. Use PDF, JPG, PNG, WEBP, or HEIC.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 10 MB).");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      // remove previous file if any
      if (hasFile) {
        await supabase.storage.from("receipts").remove([value]);
      }
      onChange(path);
      toast.success("Receipt uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openFile() {
    if (!hasFile) return;
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(value, 3600);
    if (error || !data) {
      toast.error("Could not open receipt");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove() {
    if (hasFile) {
      await supabase.storage.from("receipts").remove([value]);
    }
    onChange("");
  }

  return (
    <div className="space-y-2">
      <Input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {hasFile ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 p-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm truncate flex-1" title={filename}>{filename}</span>
          <Button type="button" variant="ghost" size="sm" onClick={openFile}>
            <ExternalLink className="h-3.5 w-3.5" /> View
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={remove} disabled={uploading}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload receipt (PDF or image)"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WEBP or HEIC · max 10 MB</p>
    </div>
  );
}

export { isStoragePath };
