// HexInfo — bottom card shown when you tap a hex on the map. Shows who holds it (name, level,
// points, colour) and how long, or an "unclaimed" prompt. Read-only; fetches on open.
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Avatar, Button } from '@/components/ui';
import { HexIcon } from '@/components/shared/HexIcon';
import { supabase } from '@/lib/supabase/client';
import { colors } from '@/theme';

interface Owner {
  name: string;
  level: number;
  points: number;
  colour: string | null;
  capturedAt: string | null;
}

function heldFor(iso: string | null): string {
  if (!iso) return '—';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-md font-extrabold text-ink-900">
        {value}
      </Text>
      <Text className="mt-0.5 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

export function HexInfo({ h3, onClose }: { h3: string | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [unclaimed, setUnclaimed] = useState(false);

  useEffect(() => {
    if (!h3) return;
    let alive = true;
    setLoading(true);
    setOwner(null);
    setUnclaimed(false);
    (async () => {
      const { data: own } = await supabase
        .from('hex_ownership')
        .select('owner_id, captured_at')
        .eq('h3_index', h3)
        .maybeSingle();
      if (!alive) return;
      if (!own?.owner_id) {
        setUnclaimed(true);
        setLoading(false);
        return;
      }
      const { data: prof } = await supabase
        .from('public_users')
        .select('display_name, username, level, current_round_points, hex_colour')
        .eq('id', own.owner_id)
        .maybeSingle();
      if (!alive) return;
      setOwner({
        name: prof?.display_name || prof?.username || 'Player',
        level: prof?.level ?? 1,
        points: prof?.current_round_points ?? 0,
        colour: prof?.hex_colour ?? null,
        capturedAt: own.captured_at,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [h3]);

  return (
    <Modal transparent animationType="slide" visible={!!h3} onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable className="rounded-t-3xl bg-ink-100 px-6 pb-10 pt-4" onPress={() => undefined}>
          <View className="mb-4 items-center">
            <View className="h-1 w-10 rounded-full bg-ink-500" />
          </View>

          {loading ? (
            <Text className="py-6 text-center text-body-md text-ink-700">Loading…</Text>
          ) : unclaimed ? (
            <View className="items-center py-2">
              <HexIcon size={36} color={colors.ink[500]} />
              <Text className="mt-2 text-heading-md text-ink-900">Unclaimed hex</Text>
              <Text className="mt-1 text-body-sm text-ink-700">Walk in and hold it to make it yours.</Text>
              <View className="mt-5 w-full">
                <Button label="Close" onPress={onClose} />
              </View>
            </View>
          ) : owner ? (
            <View>
              <View className="flex-row items-center">
                <Avatar size={48} name={owner.name} />
                <View className="ml-3 flex-1">
                  <Text className="text-heading-md text-ink-900">{owner.name}</Text>
                  <Text className="text-body-sm text-ink-700">Level {owner.level} · holds this hex</Text>
                </View>
                <View
                  className="h-6 w-6 rounded-md"
                  style={{ backgroundColor: owner.colour || colors.player.saffron }}
                />
              </View>
              <View className="mt-5 flex-row justify-around">
                <Metric value={owner.points.toLocaleString('en-IN')} label="Points" />
                <Metric value={heldFor(owner.capturedAt)} label="Held" />
              </View>
              <View className="mt-6">
                <Button label="Close" onPress={onClose} />
              </View>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
