import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "transactions",
  "incomes",
  "recurring_incomes",
  "commitments",
  "debts",
  "debt_items",
  "loans",
  "savings",
  "categories",
  "user_settings",
] as const;

type Row = Record<string, unknown>;

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(
    rows.reduce((set, row) => {
      for (const k of Object.keys(row)) set.add(k);
      return set;
    }, new Set<string>()),
  );
  const header = cols.join(",");
  const body = rows.map((row) => cols.map((c) => csvEscape(row[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ExportProgress = (msg: string) => void;

export async function exportUserData(onProgress?: ExportProgress): Promise<void> {
  const zip = new JSZip();
  const manifest: string[] = [];
  const all: Record<string, Row[]> = {};

  onProgress?.("Collecting your records…");
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      manifest.push(`[warn] ${table}: ${error.message}`);
      all[table] = [];
      zip.file(`csv/${table}.csv`, "");
      continue;
    }
    const rows = (data ?? []) as Row[];
    all[table] = rows;
    zip.file(`csv/${table}.csv`, toCsv(rows));
    manifest.push(`[ok] ${table}: ${rows.length} rows`);
  }

  zip.file(
    "ledgerly-export.json",
    JSON.stringify({ exportedAt: new Date().toISOString(), tables: all }, null, 2),
  );

  // Collect receipt paths from transactions + savings (savings.notes may reference receipts).
  const receiptPaths = new Set<string>();
  for (const t of all.transactions ?? []) {
    const loc = (t.receipt_location as string | undefined)?.trim();
    if (loc) receiptPaths.add(loc);
  }

  if (receiptPaths.size > 0) {
    onProgress?.(
      `Downloading ${receiptPaths.size} receipt file${receiptPaths.size === 1 ? "" : "s"}…`,
    );
    let ok = 0;
    let fail = 0;
    for (const path of receiptPaths) {
      try {
        // Normalize: strip a leading "receipts/" if the location was stored as a public URL fragment.
        const cleanPath = path.replace(/^\/+/, "").replace(/^receipts\//, "");
        const { data, error } = await supabase.storage.from("receipts").download(cleanPath);
        if (error || !data) {
          manifest.push(`[warn] receipt "${path}": ${error?.message ?? "no data"}`);
          fail++;
          continue;
        }
        zip.file(`receipts/${cleanPath}`, data);
        ok++;
      } catch (err) {
        manifest.push(
          `[warn] receipt "${path}": ${err instanceof Error ? err.message : "download failed"}`,
        );
        fail++;
      }
    }
    manifest.push(`[info] receipts: ${ok} downloaded, ${fail} skipped`);
  } else {
    manifest.push("[info] receipts: none referenced");
  }

  zip.file(
    "README.txt",
    [
      "Ledgerly data export",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Contents:",
      "- csv/            One CSV per database table.",
      "- receipts/       Original receipt files (images or PDFs) stored on your account.",
      "- ledgerly-export.json   Full JSON dump of every table.",
      "- export-manifest.txt    Row counts and any items that were skipped.",
      "",
      "This archive contains everything Ledgerly stores for you. Keep it safe — it can be re-imported into a future version.",
    ].join("\n"),
  );
  zip.file("export-manifest.txt", manifest.join("\n"));

  onProgress?.("Packaging archive…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `ledgerly-export-${stamp}.zip`);
}
