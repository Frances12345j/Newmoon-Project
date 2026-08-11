import { getJsonItem, setJsonItem } from './appStorage';

const PRODUCTS_CACHE_KEY = 'cached_products';

export async function cacheProducts(data: unknown): Promise<void> {
  await setJsonItem(PRODUCTS_CACHE_KEY, {
    data,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedProducts<T = unknown>(): Promise<T | null> {
  const cached = await getJsonItem<{ data: T; cachedAt: string }>(PRODUCTS_CACHE_KEY);
  return cached?.data ?? null;
}

const FACE_STATUS_CACHE_KEY = 'cached_face_status';

export async function cacheFaceStatus(enrolled: boolean): Promise<void> {
  await setJsonItem(FACE_STATUS_CACHE_KEY, {
    enrolled,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedFaceStatus(): Promise<boolean | null> {
  const cached = await getJsonItem<{ enrolled: boolean; cachedAt: string }>(FACE_STATUS_CACHE_KEY);
  return cached ? cached.enrolled : null;
}
