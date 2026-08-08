import * as React from "react";

import { Button, Text } from "@react-email/components";

import { AuthLayout, button, text } from "./auth-theme";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <AuthLayout
    preview={`Reset your password for ${siteName}`}
    heading="Reset your password"
    siteName={siteName}
    footerNote="If you didn't request a password reset, you can safely ignore this email — your password will not be changed."
  >
    <Text style={text}>
      We received a request to reset the password for your {siteName} account. Choose a new one
      below.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Choose a new password
    </Button>
  </AuthLayout>
);

export default RecoveryEmail;
