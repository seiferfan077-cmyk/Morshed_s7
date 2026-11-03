import { useId } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import type { AppTabName } from './TabPreferences';

type Props = { name: AppTabName; size: number; active?: boolean };

const RASTER_ICONS: Partial<Record<AppTabName, ImageSourcePropType>> = {
  'القناة الرسمية': require('../../assets/tab-icons/channel.webp'),
  المعرض: require('../../assets/tab-icons/gallery.webp'),
  الذاكرة: require('../../assets/tab-icons/memory.webp'),
};

/** Small, crisp enamel-style symbols for the tabs without generated raster artwork. */
export function MurshidTabIcon({ name, size, active = false }: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const generated = RASTER_ICONS[name];
  if (generated) {
    return (
      <View style={[styles.generatedFrame, { width: size, height: size, opacity: active ? 1 : 0.82, transform: [{ scale: active ? 1.06 : 0.96 }] }]}>
        <Image source={generated} resizeMode="contain" style={styles.generatedImage} accessibilityIgnoresInvertColors />
      </View>
    );
  }

  const base = `${rawId}-base`;
  const metal = `${rawId}-metal`;
  const jewel = `${rawId}-jewel`;
  const stroke = active ? '#A3F5E4' : '#95AEBB';

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image" accessible={false} style={{ opacity: active ? 1 : 0.86, transform: [{ scale: active ? 1.05 : 0.97 }] }}>
      <Defs>
        <LinearGradient id={base} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#497F91" />
          <Stop offset="0.42" stopColor="#173B4A" />
          <Stop offset="1" stopColor="#07141D" />
        </LinearGradient>
        <LinearGradient id={metal} x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#FFF0C5" />
          <Stop offset="0.42" stopColor="#E6A950" />
          <Stop offset="1" stopColor="#A94E31" />
        </LinearGradient>
        <LinearGradient id={jewel} x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#C6FFF4" />
          <Stop offset="0.4" stopColor="#32D5C2" />
          <Stop offset="1" stopColor="#087A83" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="32" cy="57" rx="19" ry="3.2" fill="#02070A" opacity="0.28" />
      <Circle cx="32" cy="30" r="25" fill="#030B11" opacity="0.55" />
      <Circle cx="32" cy="28" r="24" fill={`url(#${base})`} stroke={stroke} strokeWidth="1.2" />
      <Circle cx="32" cy="28" r="20.5" fill="#102C38" stroke="#E8BD75" strokeOpacity="0.48" strokeWidth="0.8" />
      <Ellipse cx="23" cy="13" rx="8" ry="2.2" fill="#E4FFFF" opacity="0.2" transform="rotate(-27 23 13)" />
      {name === 'الرئيسية' && <>
        <Path d="M18 30 32 18l14 12v14c0 1.1-.9 2-2 2H20c-1.1 0-2-.9-2-2V30Z" fill={`url(#${jewel})`} stroke={`url(#${metal})`} strokeWidth="2" strokeLinejoin="round" />
        <Path d="M27 46V35h10v11" fill="#0C2732" stroke="#C9FFF5" strokeWidth="1.5" strokeLinejoin="round" />
        <Path d="m21 29 11-9 11 9" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" />
      </>}
      {name === 'مُرشد AI' && <>
        <Path d="M18 22c0-2.2 1.8-4 4-4h20c2.2 0 4 1.8 4 4v14c0 2.2-1.8 4-4 4H31l-8 6v-6h-1c-2.2 0-4-1.8-4-4V22Z" fill={`url(#${jewel})`} stroke={`url(#${metal})`} strokeWidth="1.8" strokeLinejoin="round" />
        <Circle cx="27" cy="29" r="2" fill="#07313A" />
        <Circle cx="33" cy="29" r="2" fill="#07313A" />
        <Circle cx="39" cy="29" r="2" fill="#07313A" />
        <Path d="m45 15 1.5 3.5L50 20l-3.5 1.5L45 25l-1.5-3.5L40 20l3.5-1.5L45 15Z" fill="#FFF0C5" />
      </>}
      {name === 'الرسائل' && <>
        <Path d="M17 23c0-2.2 1.8-4 4-4h17c2.2 0 4 1.8 4 4v12c0 2.2-1.8 4-4 4H28l-7 5v-5c-2.2 0-4-1.8-4-4V23Z" fill={`url(#${jewel})`} stroke={`url(#${metal})`} strokeWidth="1.7" strokeLinejoin="round" />
        <Path d="M29 40h11l7 5v-5c2.2 0 4-1.8 4-4v-9c0-2.2-1.8-4-4-4h-2" fill="#154653" stroke="#B8FFF1" strokeWidth="1.5" strokeLinejoin="round" />
        <Circle cx="26" cy="29" r="1.7" fill="#07313A" /><Circle cx="32" cy="29" r="1.7" fill="#07313A" /><Circle cx="38" cy="29" r="1.7" fill="#07313A" />
      </>}
      {name === 'المتصفح' && <>
        <Circle cx="32" cy="30" r="14" fill={`url(#${jewel})`} stroke={`url(#${metal})`} strokeWidth="2" />
        <Path d="m39 22-4.3 11.4L24 38l4.3-11.4L39 22Z" fill={`url(#${metal})`} stroke="#FFF4D1" strokeWidth="1.2" strokeLinejoin="round" />
        <Circle cx="32" cy="30" r="2.1" fill="#0A2632" stroke="#E8FFFA" strokeWidth="1" />
      </>}
      {name === 'المميزات' && <>
        <Path d="m32 15 4.8 11.2L49 31l-12.2 4.8L32 48l-4.8-12.2L15 31l12.2-4.8L32 15Z" fill={`url(#${metal})`} stroke="#FFF4D1" strokeWidth="1.6" strokeLinejoin="round" />
        <Path d="m45 37 2.2 5.2 5.3 2.1-5.3 2.1-2.2 5.3-2.1-5.3-5.2-2.1 5.2-2.1 2.1-5.2Z" fill={`url(#${jewel})`} stroke="#BFFFF2" strokeWidth="1" strokeLinejoin="round" />
        <Circle cx="21" cy="20" r="1.6" fill="#E7FFFF" />
      </>}
      {name === 'الإعدادات' && <>
        <Polygon points="32,15 37,19 44,18 45,25 51,30 47,35 48,42 41,43 36,49 31,45 24,46 23,39 17,34 21,29 20,22 27,21" fill={`url(#${metal})`} stroke="#FFF0C5" strokeWidth="1.3" strokeLinejoin="round" />
        <Circle cx="34" cy="32" r="8.2" fill={`url(#${jewel})`} stroke="#D8FFF7" strokeWidth="1.4" />
        <Circle cx="34" cy="32" r="3.1" fill="#0D2631" stroke="#FFF1C9" strokeWidth="1.1" />
      </>}
    </Svg>
  );
}

const styles = StyleSheet.create({
  generatedFrame: { alignItems: 'center', justifyContent: 'center' },
  generatedImage: { width: '100%', height: '100%' },
});
