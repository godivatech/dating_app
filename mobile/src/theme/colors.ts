export const Colors = {
  // Brand Primary & Accents
  primary: '#FD5D65', // Coral/Salmon Pink
  primaryDark: '#E44850', // Darker coral for active/pressed
  primaryLight: '#FFF0F1', // Soft pink tint for badges & tag selection
  primaryGlow: 'rgba(253, 93, 101, 0.25)', // Elevation & focus glow
  primaryGradient: ['#FD5D65', '#FE7A80'], // Vibrant CTA gradient

  // Dark Accents & Text
  dark: '#111827', // Pitch Dark for active stepper & hero like button
  darkSecondary: '#1F2937',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textWhite: '#FFFFFF',

  // Core basic colors
  white: '#FFFFFF',
  black: '#000000',

  // Backgrounds & Surfaces
  background: '#FFFFFF',
  backgroundSecondary: '#F5F6F8', // Soft background for input boxes, cards
  cardBackground: '#FFFFFF',
  surfaceLight: '#F3F4F6',

  // Borders & Dividers
  border: '#E5E7EB',
  borderLight: '#F0F0F0',
  borderDashed: '#D1D5DB',

  // Status & Utility Colors
  success: '#10B981', // Online indicator green
  warning: '#F59E0B',
  error: '#EF4444',
  gold: '#F59E0B',
  star: '#FD5D65',

  // Overlay
  overlayDark: 'rgba(0, 0, 0, 0.45)',
  overlayLight: 'rgba(255, 255, 255, 0.85)',
} as const;

export type ColorType = keyof typeof Colors;
