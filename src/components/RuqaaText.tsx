import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { fontFamilies } from '../theme';

function fontFamilyFor(style: StyleProp<TextStyle>) {
  const fontWeight = StyleSheet.flatten(style)?.fontWeight;
  if (fontWeight === 'bold') return fontFamilies.bold;
  if (typeof fontWeight === 'string' && Number(fontWeight) >= 600) return fontFamilies.bold;
  return fontFamilies.regular;
}

export const RuqaaText = forwardRef<NativeText, TextProps>(({ style, ...props }, ref) => (
  <NativeText {...props} ref={ref} style={[style, { fontFamily: fontFamilyFor(style) }]} />
));
RuqaaText.displayName = 'RuqaaText';

export const RuqaaTextInput = forwardRef<NativeTextInput, TextInputProps>(({ style, ...props }, ref) => (
  <NativeTextInput {...props} ref={ref} style={[style, { fontFamily: fontFamilyFor(style) }]} />
));
RuqaaTextInput.displayName = 'RuqaaTextInput';
