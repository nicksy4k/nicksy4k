import * as React from "react";

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

/** Ledgerly brand tokens, flattened to hex for email clients. */
export const brand = {
  indigo: "#6558D6",
  indigoDark: "#4F44B5",
  ink: "#181A2A",
  body: "#4B4F63",
  muted: "#8A8FA3",
  border: "#E7E6F4",
  tint: "#F5F4FE",
};

export const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "24px 0",
};

export const container = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "28px 32px 32px",
  border: `1px solid ${brand.border}`,
  borderRadius: "14px",
};

export const brandMark = {
  fontSize: "13px",
  fontWeight: 700 as const,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: brand.indigo,
  margin: "0 0 18px",
};

export const h1 = {
  fontSize: "22px",
  fontWeight: 700 as const,
  color: brand.ink,
  lineHeight: "1.3",
  margin: "0 0 16px",
};

export const text = {
  fontSize: "15px",
  color: brand.body,
  lineHeight: "1.6",
  margin: "0 0 18px",
};

export const link = { color: brand.indigo, textDecoration: "underline" };

export const button = {
  display: "inline-block",
  backgroundColor: brand.indigo,
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600 as const,
  borderRadius: "10px",
  padding: "13px 24px",
  textDecoration: "none",
};

export const codeBox = {
  display: "block",
  backgroundColor: brand.tint,
  border: `1px solid ${brand.border}`,
  borderRadius: "10px",
  padding: "18px",
  fontSize: "30px",
  fontWeight: 700 as const,
  letterSpacing: "0.24em",
  color: brand.ink,
  textAlign: "center" as const,
  margin: "0 0 22px",
};

export const hr = { borderColor: brand.border, margin: "28px 0 16px" };

export const footer = { fontSize: "12px", color: brand.muted, lineHeight: "1.6", margin: "0" };

/** Shared shell so every auth email has the same header, frame and footer. */
export function AuthLayout({
  preview,
  heading,
  siteName,
  children,
  footerNote,
}: {
  preview: string;
  heading: string;
  siteName: string;
  children: React.ReactNode;
  footerNote?: string;
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brandMark}>{siteName}</Text>
          <Heading style={h1}>{heading}</Heading>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            {footerNote ??
              "If you didn't request this, you can safely ignore this email — no changes will be made."}
          </Text>
          <Text style={{ ...footer, marginTop: "8px" }}>
            {siteName} — your personal spending and commitments tracker.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
