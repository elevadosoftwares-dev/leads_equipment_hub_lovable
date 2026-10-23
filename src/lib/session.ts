import { useQuery } from "@tanstack/react-query";
import { getSession, type AppRole, type SessionInfo } from "@/lib/auth.functions";

export type { AppRole, SessionInfo };

export const sessionQueryKey = ["session"] as const;

export function useSession() {
  return useQuery<SessionInfo>({
    queryKey: sessionQueryKey,
    queryFn: () => getSession(),
    staleTime: 60_000,
  });
}
