// App notifications — the `notifications` table (migration 010): events that AREN'T derivable from
// pending rows (a hex was stolen from you, you levelled up, …). Owner-only RLS; written by the
// SECURITY DEFINER economy functions; the client only reads + marks read.
import { supabase } from './client';

export interface AppNotification {
  id: number;
  type: string; // 'steal' | 'level_up' | …
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown>) ?? {},
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function unreadNotificationCount(): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}

export async function markNotificationsRead(): Promise<void> {
  await supabase.rpc('mark_notifications_read');
}
