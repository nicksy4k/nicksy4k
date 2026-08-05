import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI receipt scanner.
 *
 * Access is gated by the `receiptScan` feature flag: the caller must hold one
 * of the required roles. The UI hides the entry point, but this server-side
 * check is the real lock — widen ALLOWED_ROLES (or set it to null) to open the
 * feature up to beta testers later.
 */
const ALLOWED_ROLES: string[] | null = ["admin"];
const DAILY_SCAN_LIMIT = 30;
const MODEL = "openai/gpt-5.6-sol";

const ScanInput = z.object({
  path: z.string().min(1),
  currency: z.string().min(1).default("GBP"),
  categories: z.array(z.string()).default([]),
});

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    retailer: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "ISO yyyy-mm-dd" },
    currency: { type: ["string", "null"] },
    total: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          price: { type: "number", description: "Unit price" },
          quantity: { type: "number" },
          category: { type: ["string", "null"] },
          confidence: { type: "number", description: "0 to 1" },
        },
        required: ["name", "price", "quantity", "category", "confidence"],
      },
    },
  },
  required: ["retailer", "date", "currency", "total", "items"],
} as const;

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"];

function mimeFor(ext: string): string {
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "heic": return "image/heic";
    case "heif": return "image/heif";
    case "gif": return "image/gif";
    default: return "image/jpeg";
  }
}

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Feature gate (server-side source of truth)
    if (ALLOWED_ROLES !== null) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const has = (roles ?? []).some((r: { role: string }) => ALLOWED_ROLES.includes(r.role));
      if (!has) {
        throw new Error("Receipt scanning isn't available on your account yet.");
      }
    }

    // 2. Daily rate limit
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("receipt_scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_SCAN_LIMIT) {
      throw new Error(`Daily scan limit reached (${DAILY_SCAN_LIMIT}). Try again tomorrow.`);
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured on this project.");

    // 3. Signed URL for the already-uploaded file (RLS-scoped to the caller)
    const { data: signed, error: signErr } = await supabase.storage
      .from("receipts")
      .createSignedUrl(data.path, 600);
    if (signErr || !signed?.signedUrl) {
      throw new Error("Could not read the uploaded receipt.");
    }

    const ext = data.path.split(".").pop()?.toLowerCase() ?? "jpg";
    const isImage = IMAGE_EXT.includes(ext);

    let filePart: Record<string, unknown>;
    if (isImage) {
      filePart = { type: "input_image", image_url: signed.signedUrl, detail: "high" };
    } else {
      const res = await fetch(signed.signedUrl);
      if (!res.ok) throw new Error("Could not download the receipt file.");
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i += 8192) {
        binary += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      const base64 = btoa(binary);
      filePart = {
        type: "input_file",
        filename: data.path.split("/").pop() ?? `receipt.${ext}`,
        file_data: `data:${mimeFor(ext)};base64,${base64}`,
      };
    }

    const categoryHint = data.categories.length
      ? `Pick each item's category from this list where sensible: ${data.categories.join(", ")}. Use null if none fit.`
      : "Use null for category if you are unsure.";

    const instructions = [
      "You read retail receipts and return structured data.",
      `Amounts are in ${data.currency}.`,
      "Extract the retailer name, the purchase date (ISO yyyy-mm-dd), the printed grand total, and every purchased line item.",
      "price is the UNIT price, not the line total. If a line reads '2 @ 1.50', return quantity 2 and price 1.50.",
      "Skip subtotal, VAT, change, loyalty-point and payment lines. Keep genuine charges such as delivery or bag fees as items.",
      "Discounts and vouchers may be returned as items with a negative price.",
      categoryHint,
      "confidence is 0 to 1 and reflects how legible that line was.",
      "If something is unreadable, use null rather than inventing it.",
    ].join(" ");

    // 4. Streamed Responses API call (reasoning models must stream)
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        instructions,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extract this receipt." },
              filePart,
            ],
          },
        ],
        reasoning: { effort: "low", summary: "auto" },
        text: {
          format: {
            type: "json_schema",
            name: "receipt",
            strict: true,
            schema: RECEIPT_SCHEMA,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI is rate limited right now. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits are exhausted. Top up to keep scanning.");
      throw new Error(`Receipt scan failed (${res.status}). ${body.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt.type === "response.completed" && !text) {
            text = evt.response?.output_text ?? "";
          } else if (evt.type === "error") {
            throw new Error(evt.error?.message ?? "AI error");
          }
        } catch {
          // ignore malformed keep-alive chunks
        }
      }
    }

    if (!text.trim()) {
      throw new Error("The AI couldn't read anything from that receipt.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("The AI returned an unreadable result. Try a clearer photo.");
    }

    const Result = z.object({
      retailer: z.string().nullable(),
      date: z.string().nullable(),
      currency: z.string().nullable(),
      total: z.number().nullable(),
      items: z
        .array(
          z.object({
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
            category: z.string().nullable(),
            confidence: z.number(),
          }),
        )
        .default([]),
    });
    const out = Result.parse(parsed);

    // 5. Log the scan for rate limiting
    await supabase.from("receipt_scans").insert({ user_id: userId });

    return out;
  });
