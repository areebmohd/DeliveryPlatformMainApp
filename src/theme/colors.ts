export const Colors = {
  primary: '#007bff', // Main Blue
  secondary: '#0056b3', // Darker Blue
  background: '#F8F9FA',
  surface: '#F8F9FA',
  text: '#121212',
  textSecondary: '#6C757D',
  error: '#DC3545',
  border: '#E9ECEF',
  success: '#28A745',
  warning: '#F59E0B',
  info: '#3B82F6', // Keeping info for consistency
  white: '#FFFFFF',
  black: '#000000',
  primaryLight: '#e7f1ff', // Light Blue
  successLight: '#d4edda', // Light Green
  errorLight: '#f8d7da',   // Light Red
  warningLight: '#fff3cd', // Light Yellow
  infoLight: '#d1ecf1',    // Light Info Blue
  glass: 'rgba(255, 255, 255, 0.85)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  gradients: {
    primary: ['#007bff', '#00c6ff'],
    premium: ['#121212', '#333333'],
    business: ['#FF512F', '#DD2476'],
    customer: ['#00B4DB', '#0083B0'],
    surface: ['#FFFFFF', '#F8F9FA'],
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 40, // Also reducing xxl slightly
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const Typography = {
  header: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};
