import { createPandAuthClient } from "@pand/auth/client";
import { useQuery } from "@tanstack/react-query";

export const authClient = createPandAuthClient();

export interface AuthUser {
  id: string;
  name?: string;
  email: string;
  role?: string;
}

export function useSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        const res = await authClient.getSession();
        return (res?.data?.user as AuthUser) ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
  });
}
