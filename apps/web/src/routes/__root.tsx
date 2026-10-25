import { AppShell } from "@pand/ui";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { authClient, useSession } from "../lib/auth.js";
import { navItems } from "../nav.js";

export { authClient };

export function RootLayout({
  currentPath,
  onNavigate,
  children,
}: {
  currentPath: string;
  onNavigate: (to: string) => void;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data: user } = useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    queryClient.invalidateQueries({ queryKey: ["core"] });
    onNavigate("/login");
  };

  return (
    <AppShell
      title="Todo Pand"
      navItems={[
        ...navItems,
        ...(user
          ? []
          : [
              { label: "Sign In", to: "/login" },
              { label: "Sign Up", to: "/signup" },
            ]),
      ]}
      currentPath={currentPath}
      onNavigate={onNavigate}
      userEmail={user?.email ?? null}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
}
