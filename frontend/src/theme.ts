/**
 * Lexis theme - editorial light personality.
 */
export const theme = {
  color: {
    surface: '#FAF9F6',
    onSurface: '#1C1917',
    surfaceSecondary: '#F5F5F0',
    onSurfaceSecondary: '#44403C',
    surfaceTertiary: '#EAE9E4',
    onSurfaceTertiary: '#57534E',
    surfaceInverse: '#1C1917',
    onSurfaceInverse: '#FAF9F6',
    brand: '#A16207',
    onBrand: '#FFFFFF',
    brandSecondary: '#CA8A04',
    brandTertiary: '#FEF08A',
    onBrandTertiary: '#713F12',
    success: '#4D7C0F',
    warning: '#D97706',
    error: '#B91C1C',
    border: '#E7E5DF',
    borderStrong: '#D6D3CD',
    divider: '#E7E5DF',
    muted: '#78716C',
  },
  // Use platform serif/sans-serif (no bundled font files).
  font: {
    display: undefined as any,   // RN auto-falls back to system serif via fontFamily 'serif'
    displayKey: 'serif',
    text: undefined as any,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
};

export type Theme = typeof theme;
