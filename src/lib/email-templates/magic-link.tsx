import * as React from "react";

import { Button, Text } from "@react-email/components";

import { AuthLayout, button, text } from "./auth-theme";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <AuthLayout
    preview={`Your login link for ${siteName}`}
    heading="Your login link"
    siteName={siteName}
    footerNote="If you didn't request this link, you can safely ignore this email."
  >
    <Text style={text}>
      Tap the button below to sign in to {siteName}. For your security, the link expires shortly and
      can only be used once.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Sign in
    </Button>
  </AuthLayout>
);

export default MagicLinkEmail;
