// MetricRow — design spec §3.14. 3-4 equal-width cells of headline numbers.
import { Text, View } from 'react-native';

export interface Metric {
  value: string;
  unit?: string;
  label: string;
}

interface MetricRowProps {
  metrics: Metric[];
  size?: 'sm' | 'md';
  dividers?: boolean;
}

export function MetricRow({ metrics, size = 'md', dividers = false }: MetricRowProps) {
  const numberClass = size === 'sm' ? 'text-display-sm' : 'text-display-md';

  return (
    <View className="flex-row">
      {metrics.map((metric, index) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={`flex-1 items-center px-2 py-3 ${
            dividers && index > 0 ? 'border-l border-ink-400' : ''
          }`}
        >
          <View className="flex-row items-baseline">
            <Text style={{ fontVariant: ['tabular-nums'] }} className={`${numberClass} text-ink-900`}>
              {metric.value}
            </Text>
            {metric.unit ? <Text className="ml-1 text-body-sm text-ink-700">{metric.unit}</Text> : null}
          </View>
          <Text style={{ letterSpacing: 0.5 }} className="mt-1 text-label-sm uppercase text-ink-600">
            {metric.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default MetricRow;
