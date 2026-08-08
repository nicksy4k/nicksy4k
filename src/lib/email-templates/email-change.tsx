import * as React from "react";

import { Button, Link, Text } from "@react-email/components";

import { AuthLayout, button, link, text } from "./auth-theme";

interface EmailChangeEmailProps {
  siteName: string;
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <AuthLayout
    preview={`Confirm your email change for ${siteName}`}
    heading="Confirm your email change"
    siteName={siteName}
    footerNote="If you didn't request this change, please secure your account immediately."
  >
    <Text style={text}>
      You asked to change the email address on your {siteName} account from{" "}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{" "}
      to{" "}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirm email change
    </Button>
  </AuthLayout>
);

export default EmailChangeEmail;
