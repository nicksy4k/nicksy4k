import * as React from "react";

import { Button, Link, Text } from "@react-email/components";

import { AuthLayout, button, link, text } from "./auth-theme";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <AuthLayout
    preview={`Confirm your email for ${siteName}`}
    heading="Confirm your email"
    siteName={siteName}
    footerNote="If you didn't create an account, you can safely ignore this email."
  >
    <Text style={text}>
      Thanks for signing up for{" "}
      <Link href={siteUrl} style={link}>
        <strong>{siteName}</strong>
      </Link>
      . One quick step and your ledger is ready.
    </Text>
    <Text style={text}>
      Confirm{" "}
      <Link href={`mailto:${recipient}`} style={link}>
        {recipient}
      </Link>{" "}
      by tapping the button below.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirm my email
    </Button>
  </AuthLayout>
);

export default SignupEmail;
