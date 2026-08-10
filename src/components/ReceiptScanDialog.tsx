import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsDemoUser } from "@/lib/demoAccount";
import { scanReceipt } from "@/lib/api/receipt-scan.functions";
import { trackEvent } from "@/lib/analytics";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScanLine, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { matchRetailer, normaliseItem, itemsTotal, type ScannedItem } from "@/lib/receiptParse";

const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_BYTES = 10 * 1024 * 1024;

export interface ScanApplyPayload {
  retailer: string;
  date: string | null;
  total: number | null;
  storagePath: string;
  items: ScannedItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing retailer names so extracted spellings match your history. */
  knownRetailers: string[];
  /** Category names the AI should choose from. */
  categories: string[];
  currency?: string;
  /** Settle mode keeps the existing retailer/date — only items + total apply. */
  keepHeader?: boolean;
  onApply: (payload: ScanApplyPayload) => void;
}

type Row = ScannedItem & { id: string; include: boolean };

export function ReceiptScanDialog({
  open,
  onOpenChange,
  knownRetailers,
  categories,
  currency = "GBP",
  keepHeader = false,
  onApply,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDemo = useIsDemoUser();
  const scan = useServerFn(scanReceipt);
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState("");
  const [retailer, setRetailer] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  function reset() {
    setBusy(false);
    setPath("");
    setRetailer("");
    setDate("");
    setTotal("");
    setRows(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Unsupported file. Use PDF, JPG, PNG, WEBP or HEIC.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 10 MB).");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("receipts").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      // Demo uploads are transient — never keep the file or attach it.
      setPath(isDemo ? "" : storagePath);

      try {
        const result = await scan({
          data: { path: storagePath, currency, categories },
        });

        const parsed = (result.items ?? [])
          .map((i) => normaliseItem(i))
          .filter((i): i is ScannedItem => i !== null)
          .map((i) => ({ ...i, id: crypto.randomUUID(), include: true }));

        setRetailer(matchRetailer(result.retailer ?? "", knownRetailers));
        setDate(result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date) ? result.date : "");
        setTotal(result.total != null ? String(result.total) : "");
        setRows(parsed);

        if (parsed.length === 0) {
          toast.warning("No line items found — I filled in what I could read.");
        } else {
          trackEvent("receipt_scan");
          toast.success(`Found ${parsed.length} item${parsed.length === 1 ? "" : "s"}.`);
        }
      } finally {
        if (isDemo) {
          try {
            await supabase.storage.from("receipts").remove([storagePath]);
          } catch {
            /* best-effort cleanup */
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Receipt scan failed");
      setRows(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const included = (rows ?? []).filter((r) => r.include);
  const sum = itemsTotal(included);
  const receiptTotal = parseFloat(total);
  const diff = Number.isFinite(receiptTotal) ? +(receiptTotal - sum).toFixed(2) : 0;

  function apply() {
    onApply({
      retailer: retailer.trim(),
      date: date || null,
      total: Number.isFinite(receiptTotal) ? receiptTotal : null,
      storagePath: path,
      items: included.map(({ id: _id, include: _inc, ...rest }) => rest),
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" /> Scan receipt
          </DialogTitle>
          <DialogDescription>
            Upload a photo or PDF and I'll read the retailer, date, total and every line item.
            Nothing is saved until you review and hit save on the form.
          </DialogDescription>
        </DialogHeader>

        <Input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        {!rows && (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-24 flex-col gap-2"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {busy ? "Reading receipt…" : "Choose a photo or PDF"}
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG, WEBP or HEIC · max 10 MB. The file is stored privately and attached to
              the transaction, so you don't need to upload it twice.
            </p>
          </div>
        )}

        {rows && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Retailer</Label>
                <Input
                  value={retailer}
                  onChange={(e) => setRetailer(e.target.value)}
                  disabled={keepHeader}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={keepHeader}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Receipt total</Label>
                <Input
                  inputMode="decimal"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border divide-y divide-border">
              {rows.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  No line items were detected. You can still use the retailer, date and total above.
                </p>
              )}
              {rows.map((r, idx) => (
                <div key={r.id} className="flex items-center gap-2 p-2">
                  <Checkbox
                    checked={r.include}
                    aria-label={`Include item ${idx + 1}`}
                    onCheckedChange={(v) =>
                      setRows((cur) =>
                        (cur ?? []).map((x) => (x.id === r.id ? { ...x, include: v === true } : x)),
                      )
                    }
                  />
                  <Input
                    value={r.name}
                    aria-label={`Item ${idx + 1} name`}
                    className={cn("flex-1 h-8", r.confidence < 0.6 && "border-amber-500/60")}
                    onChange={(e) =>
                      setRows((cur) =>
                        (cur ?? []).map((x) =>
                          x.id === r.id ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    value={String(r.quantity)}
                    aria-label={`Item ${idx + 1} quantity`}
                    inputMode="numeric"
                    className="h-8 w-16"
                    onChange={(e) =>
                      setRows((cur) =>
                        (cur ?? []).map((x) =>
                          x.id === r.id
                            ? { ...x, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }
                            : x,
                        ),
                      )
                    }
                  />
                  <Input
                    value={String(r.price)}
                    aria-label={`Item ${idx + 1} price`}
                    inputMode="decimal"
                    className={cn("h-8 w-24", r.confidence < 0.6 && "border-amber-500/60")}
                    onChange={(e) =>
                      setRows((cur) =>
                        (cur ?? []).map((x) =>
                          x.id === r.id ? { ...x, price: parseFloat(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                Math.abs(diff) > 0.01
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  : "border-border bg-muted/30",
              )}
            >
              <span>
                {included.length} item{included.length === 1 ? "" : "s"} · {fmt(sum)}
              </span>
              <span>
                {Math.abs(diff) > 0.01
                  ? `${diff > 0 ? "Missing" : "Over by"} ${fmt(Math.abs(diff))} vs receipt total`
                  : "Matches the receipt total"}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => reset()}>
                Scan another
              </Button>
              <Button onClick={apply}>Use these items</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
