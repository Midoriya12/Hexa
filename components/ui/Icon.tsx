// Icon set — thin wrappers over @expo/vector-icons MaterialCommunityIcons.
// Replaces @tabler/icons-react-native, which exploded into thousands of modules and
// caused Metro EMFILE crashes + slow builds on Windows. MCI is font-based (a few
// modules, no native rebuild). Same prop API as before (size/color/strokeWidth/onPress)
// so call sites are unchanged; strokeWidth is accepted but ignored (font icons).
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { type ColorValue } from 'react-native';

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface IconProps {
  size?: number;
  color?: ColorValue;
  strokeWidth?: number; // ignored (font icons); kept for call-site compatibility
  onPress?: () => void;
}

const make =
  (name: MciName) =>
  ({ size = 24, color, onPress }: IconProps) =>
    <MaterialCommunityIcons name={name} size={size} color={color as string | undefined} onPress={onPress} />;

export const IconBell = make('bell');
export const IconCamera = make('camera');
export const IconChevronLeft = make('chevron-left');
export const IconChevronRight = make('chevron-right');
export const IconClock = make('clock-outline');
export const IconColorSwatch = make('palette-swatch');
export const IconCrown = make('crown');
export const IconFlag = make('flag');
export const IconGhost2 = make('ghost');
export const IconGift = make('gift');
export const IconHeart = make('heart-outline');
export const IconHelpCircle = make('help-circle-outline');
export const IconHexagonFilled = make('hexagon');
export const IconHexagons = make('hexagon-multiple-outline');
export const IconLanguage = make('translate');
export const IconLayoutGrid = make('view-grid-outline');
export const IconLock = make('lock');
export const IconMapPin = make('map-marker');
export const IconMedal = make('medal');
export const IconMessageCircle = make('message-outline');
export const IconPalette = make('palette');
export const IconPencil = make('pencil');
export const IconSearch = make('magnify');
export const IconSettings = make('cog');
export const IconShieldLock = make('shield-lock');
export const IconTrophy = make('trophy');
export const IconUser = make('account');
export const IconUserCircle = make('account-circle');
export const IconUserPlus = make('account-plus');
export const IconUsers = make('account-group');
export const IconWalk = make('walk');
export const IconWatch = make('watch');
export const IconNews = make('newspaper-variant-outline');
