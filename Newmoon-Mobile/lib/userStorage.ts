import { deleteSecureItem, getSecureItem, setSecureItem } from './appStorage';

const USER_KEY = 'user';

export async function saveUser(user: unknown): Promise<void> {
  await setSecureItem(USER_KEY, JSON.stringify(user));
}

export async function getUser<T = Record<string, unknown>>(): Promise<T | null> {
  const raw = await getSecureItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function deleteUser(): Promise<void> {
  await deleteSecureItem(USER_KEY);
}