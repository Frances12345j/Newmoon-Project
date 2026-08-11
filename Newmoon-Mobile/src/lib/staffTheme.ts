export const COLORS = {
  PRIMARY_RED: '#E53935',
  PRIMARY_NAVY: '#1A237E',
  ACCENT_LIGHT: '#E3F2FD',
  ACCENT_WARM: '#FFEBEE',
  BG_PAGE: '#F8FAFC',
  CARD_BG: '#FFFFFF',
  CARD_BORDER: '#E3F2FD',
  TEXT_PRIMARY: '#1A237E',
  TEXT_SECONDARY: '#64748B',
  TEXT_MUTED: '#94A3B8',
  INPUT_BG: '#F1F5F9',
  INPUT_BORDER: '#CBD5E1',
  DIVIDER: '#E2E8F0',
  STATUS_APPROVED_BG: '#DCFCE7',
  STATUS_APPROVED_TEXT: '#16A34A',
  STATUS_PENDING_BG: '#FEF3C7',
  STATUS_PENDING_TEXT: '#D97706',
  STATUS_REJECTED_BG: '#FEE2E2',
  STATUS_REJECTED_TEXT: '#DC2626',
  STATUS_INFO_BG: '#DBEAFE',
  STATUS_INFO_TEXT: '#2563EB',
  SHADOW: '#000000',
};

export const GRADIENT = {
  PRIMARY: [COLORS.PRIMARY_RED, COLORS.PRIMARY_NAVY] as const,
  HEADER: [COLORS.PRIMARY_RED, '#C62828', COLORS.PRIMARY_NAVY] as const,
};

export const CARD = {
  backgroundColor: COLORS.CARD_BG,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.CARD_BORDER,
  shadowColor: COLORS.SHADOW,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
} as const;

export const CARD_COMPACT = {
  ...CARD,
  padding: 12,
} as const;

export function getStatusColors(status: string) {
  switch (status) {
    case 'pending':
      return { bg: COLORS.STATUS_PENDING_BG, text: COLORS.STATUS_PENDING_TEXT, label: 'Pending' };
    case 'approved':
      return { bg: COLORS.STATUS_APPROVED_BG, text: COLORS.STATUS_APPROVED_TEXT, label: 'Approved' };
    case 'rejected':
      return { bg: COLORS.STATUS_REJECTED_BG, text: COLORS.STATUS_REJECTED_TEXT, label: 'Rejected' };
    default:
      return { bg: COLORS.INPUT_BG, text: COLORS.TEXT_SECONDARY, label: status };
  }
}
