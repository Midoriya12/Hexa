// Custom hexagon icon for the Map tab — the design spec (§2.6) lists the hex as a
// custom icon (not in the Tabler set). Flat-top hexagon, outline or filled.
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface HexIconProps {
  size?: number;
  color: ColorValue;
  filled?: boolean;
}

// Flat-top hexagon inscribed in a 24x24 box.
const HEX_PATH = 'M7 4 L17 4 L22 12 L17 20 L7 20 L2 12 Z';

export function HexIcon({ size = 24, color, filled = false }: HexIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={HEX_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default HexIcon;
