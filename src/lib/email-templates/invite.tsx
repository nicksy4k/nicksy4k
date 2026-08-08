import * as React from "react";

import { Button, Link, Text } from "@react-email/components";

import { AuthLayout, button, link, text } from "./auth-theme";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <AuthLayout
    preview={`You've been invited to join ${siteName}`}
    heading="You've been invited"
    siteName={siteName}
    footerNote="If you weren't expecting this invitation, you can safely ignore this email."
  >
    <Text style={text}>
      You've been invited to join{" "}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . Accept below to create your account and start tracking your spending.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accept invitation
    </Button>
  </AuthLayout>
);

export default InviteEmail;
