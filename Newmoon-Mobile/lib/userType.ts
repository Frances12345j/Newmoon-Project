export type MobileUserType = 'staff' | 'rider' | 'customer';

export function normalizeUserType(role?: string | null): MobileUserType | null {
  const value = (role || '').toLowerCase();
  if (value === 'delivery_rider' || value === 'rider') return 'rider';
  if (value === 'customer') return 'customer';
  if (value === 'staff') return 'staff';
  return null;
}

export function getDashboardPath(
  userType: MobileUserType
): '/Staff/Dashboard' | '/Rider/Dashboard' | '/Customer/Home' {
  if (userType === 'rider') return '/Rider/Dashboard';
  if (userType === 'customer') return '/Customer/Home';
  return '/Staff/Dashboard';
}
