// Component gallery — visual QA for the design-system library (design spec §3).
// Dev-only route: /_devtools/components. Not part of the product nav.
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GorhomBottomSheet from '@gorhom/bottom-sheet';

import {
  Avatar,
  Badge,
  BottomSheet,
  BottomToast,
  Button,
  Card,
  CircularProgress,
  EmptyState,
  FeatureGate,
  HoldToConfirm,
  Input,
  LinearProgress,
  MetricRow,
  OtpInput,
  Spinner,
  SubToggle,
  TopBanner,
} from '@/components/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-8">
      <Text style={{ letterSpacing: 0.5 }} className="mb-3 text-label-sm uppercase text-ink-600">
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

const AVATAR_SIZES = [24, 32, 40, 48, 64, 96] as const;

export default function ComponentsGallery() {
  const [toggle, setToggle] = useState('Pincode');
  const [otp, setOtp] = useState('');
  const [topBanner, setTopBanner] = useState(false);
  const [bottomToast, setBottomToast] = useState(false);
  const sheetRef = useRef<GorhomBottomSheet>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-ink-50">
        <ScrollView contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 16, paddingBottom: 96 }}>
          <Text className="mb-8 text-display-sm text-ink-900">Hexa UI</Text>

          <Section title="Button — variants">
            <Button label="Capture this hex" variant="primary" />
            <Button label="Maybe later" variant="secondary" />
            <Button label="Skip" variant="ghost" />
            <Button label="Release hex" variant="danger" />
            <Button label="Recenter" variant="glass" />
          </Section>

          <Section title="Button — sizes / states">
            <Button label="Small" size="sm" />
            <Button label="Medium" size="md" />
            <Button label="Large" size="lg" />
            <Button label="Loading" loading />
            <Button label="Disabled" disabled />
          </Section>

          <Section title="Card">
            <Card>
              <Text className="text-body-md text-ink-800">Default card</Text>
            </Card>
            <Card bordered>
              <Text className="text-body-md text-ink-800">Bordered card</Text>
            </Card>
            <Card contentHeavy onPress={() => undefined}>
              <Text className="text-body-md text-ink-800">Pressable, content-heavy card</Text>
            </Card>
          </Section>

          <Section title="Badge — tones">
            <View className="flex-row flex-wrap gap-2">
              <Badge tone="neutral" label="Neutral" />
              <Badge tone="success" label="Captured" />
              <Badge tone="danger" label="Stolen" />
              <Badge tone="warning" label="GPS weak" />
              <Badge tone="saffron" label="L3 Patroller" />
              <Badge tone="info" label="Tip" />
            </View>
          </Section>

          <Section title="Avatar">
            <View className="flex-row flex-wrap items-center gap-3">
              {AVATAR_SIZES.map((size) => (
                <Avatar key={size} size={size} name="Sai" />
              ))}
              <Avatar size={64} name="Priya" bordered />
            </View>
          </Section>

          <Section title="Input">
            <Input label="Username" placeholder="rohit_walks_bangalore" />
            <Input label="ZIP code" placeholder="10012" error="Enter a 5-digit US ZIP code" />
            <Text className="text-body-sm text-ink-700">OTP</Text>
            <OtpInput value={otp} onChangeText={setOtp} />
          </Section>

          <Section title="MetricRow">
            <Card>
              <MetricRow
                metrics={[
                  { value: '47', label: 'Hexes' },
                  { value: '4,210', label: 'Points' },
                  { value: '13', label: 'Streak' },
                ]}
                dividers
              />
            </Card>
            <Card>
              <MetricRow
                size="sm"
                metrics={[
                  { value: '1.42', unit: 'km', label: 'Distance' },
                  { value: '12:34', label: 'Duration' },
                  { value: '5', label: 'Hexes' },
                  { value: '150', label: 'IP' },
                ]}
              />
            </Card>
          </Section>

          <Section title="ProgressIndicator">
            <LinearProgress progress={0.65} />
            <View className="flex-row items-center gap-6">
              <CircularProgress progress={0.65} size={96}>
                <Text className="text-heading-md text-ink-900">65%</Text>
              </CircularProgress>
              <Spinner size="large" />
            </View>
          </Section>

          <Section title="SubToggle">
            <SubToggle options={['ZIP', 'City', 'Friends']} value={toggle} onChange={setToggle} />
          </Section>

          <Section title="HoldToConfirm">
            <HoldToConfirm
              label="Hold to release hex"
              holdingLabel="Releasing…"
              completeLabel="Released"
              onConfirm={() => setBottomToast(true)}
            />
          </Section>

          <Section title="FeatureGate">
            <FeatureGate
              title="Reach Level 3 to unlock Friends"
              progressLabel="Level 2 — 850 / 2,500 XP"
              steps={['Capture 3 hexes today', 'Add a profile photo', 'Use a referral code']}
              actionLabel="Go to Profile"
              onAction={() => undefined}
            />
          </Section>

          <Section title="EmptyState">
            <Card>
              <View className="h-64">
                <EmptyState
                  title="No medals yet"
                  body="Capture your first hex to break the seal."
                  actionLabel="Open the map"
                  onAction={() => undefined}
                />
              </View>
            </Card>
          </Section>

          <Section title="Toast / BottomSheet">
            <Button label="Show top banner" variant="secondary" onPress={() => setTopBanner(true)} />
            <Button label="Show bottom toast" variant="secondary" onPress={() => setBottomToast(true)} />
            <Button label="Open bottom sheet" variant="secondary" onPress={() => sheetRef.current?.expand()} />
          </Section>
        </ScrollView>

        <TopBanner
          visible={topBanner}
          message="Priya stole 3 of your hexes in SoHo."
          avatarName="Priya"
          actionLabel="Get back"
          onAction={() => setTopBanner(false)}
          onDismiss={() => setTopBanner(false)}
        />
        <BottomToast
          visible={bottomToast}
          message="Hex released."
          onDismiss={() => setBottomToast(false)}
        />

        <BottomSheet ref={sheetRef}>
          <Text className="text-heading-lg text-ink-900">Hex #4A2B</Text>
          <Text className="mt-2 text-body-md text-ink-700">
            Bottom sheet content. Drag down or tap the backdrop to dismiss.
          </Text>
          <View className="mt-4">
            <Button label="Capture this hex" onPress={() => sheetRef.current?.close()} />
          </View>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}
