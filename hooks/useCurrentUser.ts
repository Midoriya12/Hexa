// Current authenticated user's profile row + loading flag, from userStore.
import { useUserStore } from '@/stores/userStore';

export function useCurrentUser() {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);
  return { user, isLoading };
}
