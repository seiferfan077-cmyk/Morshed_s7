export type ThemeColors = {
  ink: string; inkMuted: string; inkFaint: string; surface: string; paper: string; line: string;
  teal: string; tealDark: string; tealSoft: string; coral: string; coralSoft: string; amber: string; amberSoft: string; blue: string; blueSoft: string; danger: string;
};

export const lightColors: ThemeColors = {
  ink: '#10212B', inkMuted: '#61727D', inkFaint: '#91A0A8', surface: '#F6F8F7', paper: '#FFFFFF', line: '#E6ECEA',
  teal: '#16B8A6', tealDark: '#087C73', tealSoft: '#DDF6F1', coral: '#FF765D', coralSoft: '#FFF0EC', amber: '#D9952B', amberSoft: '#FFF5DF', blue: '#5488C7', blueSoft: '#EAF2FC', danger: '#D85C5C',
};

export const darkColors: ThemeColors = {
  ink: '#F1F5F4', inkMuted: '#B4C0C4', inkFaint: '#84949B', surface: '#10171B', paper: '#1B262C', line: '#2B3A40',
  teal: '#3CCDBB', tealDark: '#51D6C5', tealSoft: '#193B39', coral: '#FF8C78', coralSoft: '#402A28', amber: '#F1BC61', amberSoft: '#3B321F', blue: '#83B1EF', blueSoft: '#26364B', danger: '#FF8585',
};

// Static palette retained for one-time onboarding screens that intentionally keep their designed appearance.
export const colors = lightColors;
export const fontFamilies = { regular: 'ArefRuqaa-Regular', bold: 'ArefRuqaa-Bold' } as const;
export const spacing = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30, xxl: 40 } as const;
export const radii = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.8 }, h1: { fontFamily: fontFamilies.bold, fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.3 }, h2: { fontFamily: fontFamilies.bold, fontSize: 18, lineHeight: 24, fontWeight: '700' as const }, body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22, fontWeight: '400' as const }, label: { fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.5 },
};
export const shadows = { card: { shadowColor: '#10212B', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 } };
