import * as React from "react";

import { Text } from "@react-email/components";

import { AuthLayout, codeBox, text } from "./auth-theme";

interface ReauthenticationEmailProps {
  siteName?: string;
  token: string;
}

export const ReauthenticationEmail = ({
  siteName = "Ledgerly",
  token,
}: ReauthenticationEmailProps) => (
  <AuthLayout
    preview="Your verification code"
    heading="Confirm it's you"
    siteName={siteName}
    footerNote="This code expires shortly. If you didn't request it, you can safely ignore this email."
  >
    <Text style={text}>Enter this code in {siteName} to confirm your identity:</Text>
    <Text style={codeBox}>{token}</Text>
  </AuthLayout>
);

export default ReauthenticationEmail;
