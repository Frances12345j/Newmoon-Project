import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_BRANCH_KEY = 'customer_selected_branch';

export type CustomerBranch = {
  id: number;
  name: string;
  code?: string;
  address?: string | null;
  phone?: string | null;
};

export async function saveSelectedBranch(branch: CustomerBranch): Promise<void> {
  await AsyncStorage.setItem(SELECTED_BRANCH_KEY, JSON.stringify(branch));
}

export async function getSelectedBranch(): Promise<CustomerBranch | null> {
  const raw = await AsyncStorage.getItem(SELECTED_BRANCH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerBranch;
  } catch {
    return null;
  }
}

export async function clearSelectedBranch(): Promise<void> {
  await AsyncStorage.removeItem(SELECTED_BRANCH_KEY);
}
