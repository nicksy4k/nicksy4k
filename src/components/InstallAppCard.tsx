import { Smartphone } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallAppButton } from "@/components/InstallAppButton";

/** Settings card offering home-screen installation. */
export function InstallAppCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 shrink-0" /> Install Ledgerly
        </CardTitle>
        <CardDescription>
          Add Ledgerly to your home screen or desktop. It gets its own app icon and opens
          full-screen, so logging a spend is two taps instead of typing the web address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <InstallAppButton className="w-full sm:w-auto" label="Install Ledgerly" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          On iPhone use Safari&apos;s Share menu → Add to Home Screen. On Android and desktop
          Chrome/Edge the button installs it directly.
        </p>
      </CardContent>
    </Card>
  );
}
