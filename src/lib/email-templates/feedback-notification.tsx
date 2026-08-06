import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  type?: "bug" | "idea" | "general";
  severity?: "low" | "medium" | "high" | null;
  subject?: string;
  message?: string;
  email?: string;
  appVersion?: string;
  route?: string;
  userAgent?: string;
  attachmentPath?: string | null;
  submittedAt?: string;
}

const TYPE_LABEL: Record<string, string> = {
  bug: "🐞 Bug report",
  idea: "💡 Feature idea",
  general: "💬 General feedback",
};

const SEV_COLOR: Record<string, string> = {
  low: "#64748b",
  medium: "#f59e0b",
  high: "#ef4444",
};

const FeedbackNotification = ({
  type = "general",
  severity,
  subject = "(no subject)",
  message = "",
  email = "",
  appVersion = "",
  route = "",
  userAgent = "",
  attachmentPath = null,
  submittedAt = new Date().toISOString(),
}: Props) => {
  const typeLabel = TYPE_LABEL[type] ?? TYPE_LABEL.general;
  const sevColor = severity ? SEV_COLOR[severity] : null;

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${typeLabel}: ${subject}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={brand}>Ledgerly · Beta feedback</Text>
            <Heading style={h1}>{subject}</Heading>
            <div style={{ marginTop: "8px" }}>
              <span style={pill}>{typeLabel}</span>
              {severity && (
                <span
                  style={{
                    ...pill,
                    marginLeft: "6px",
                    background: `${sevColor}20`,
                    color: sevColor ?? "#64748b",
                    borderColor: `${sevColor}55`,
                  }}
                >
                  Severity: {severity}
                </span>
              )}
            </div>
          </Section>

          <Section style={card}>
            <Text style={label}>Message</Text>
            <Text style={messageStyle}>{message}</Text>
          </Section>

          <Section style={card}>
            <Text style={label}>From</Text>
            <Text style={value}>{email}</Text>
          </Section>

          <Section style={card}>
            <Text style={label}>Context</Text>
            <Text style={mono}>Version: {appVersion || "—"}</Text>
            <Text style={mono}>Page: {route || "—"}</Text>
            <Text style={mono}>Submitted: {submittedAt}</Text>
            {attachmentPath && <Text style={mono}>Attachment: {attachmentPath}</Text>}
          </Section>

          {userAgent && (
            <Section style={card}>
              <Text style={label}>Browser</Text>
              <Text style={{ ...mono, fontSize: "11px" }}>{userAgent}</Text>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>Sent automatically from the Ledgerly in-app feedback form.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: FeedbackNotification,
  subject: (data: Record<string, unknown>) =>
    `[Ledgerly ${data?.type ?? "feedback"}] ${data?.subject ?? "New feedback"}`,
  displayName: "Beta feedback notification",
  to: "admin@itemizedkeeper.co.uk",
  previewData: {
    type: "bug",
    severity: "high",
    subject: "Undo commitment doesn't revert due date",
    message:
      "Steps:\n1. Mark a bill paid\n2. Click Undo\nExpected: due date stays this cycle.\nGot: date jumps forward.",
    email: "tester@example.com",
    appVersion: "v2.0.0-beta",
    route: "/commitments",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    submittedAt: new Date().toISOString(),
  },
} satisfies TemplateEntry;

// Midnight Indigo palette — matches Ledgerly's brand
const main = {
  backgroundColor: "#ffffff",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  color: "#0f172a",
};
const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 24px",
};
const headerSection = {
  paddingBottom: "16px",
  borderBottom: "1px solid #e2e8f0",
  marginBottom: "20px",
};
const brand = {
  fontSize: "11px",
  letterSpacing: "0.16em",
  textTransform: "uppercase" as const,
  color: "#6366f1",
  fontWeight: 600,
  margin: 0,
};
const h1 = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "8px 0 0",
  lineHeight: "1.3",
};
const pill = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: "999px",
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: "11px",
  fontWeight: 600,
  border: "1px solid #c7d2fe",
};
const card = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "14px 16px",
  marginBottom: "12px",
};
const label = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0 0 6px",
};
const value = { fontSize: "14px", color: "#0f172a", margin: 0 };
const messageStyle = {
  fontSize: "14px",
  color: "#0f172a",
  margin: 0,
  whiteSpace: "pre-wrap" as const,
  lineHeight: "1.55",
};
const mono = {
  fontSize: "12px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  color: "#334155",
  margin: "2px 0",
  wordBreak: "break-all" as const,
};
const hr = { borderColor: "#e2e8f0", margin: "24px 0 12px" };
const footer = {
  fontSize: "11px",
  color: "#94a3b8",
  textAlign: "center" as const,
  margin: 0,
};
