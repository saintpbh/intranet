// localStorage-based favorites (bookmarks) utility for churches

const STORAGE_KEY = 'prok_map_favorites';

export function getFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFavorite(church) {
  const favs = getFavorites();
  if (favs.some(f => f.id === church.id)) return favs;
  const entry = {
    id: church.id,
    name: church.name,
    noh: church.noh,
    pastor_name: church.pastor_name,
    address: church.address,
    lat: church.lat,
    lng: church.lng,
    phone: church.phone,
    addedAt: Date.now()
  };
  const updated = [entry, ...favs];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeFavorite(churchId) {
  const favs = getFavorites();
  const updated = favs.filter(f => f.id !== churchId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function isFavorite(churchId) {
  return getFavorites().some(f => f.id === churchId);
}

export function toggleFavorite(church) {
  if (isFavorite(church.id)) {
    return { favorites: removeFavorite(church.id), added: false };
  } else {
    return { favorites: addFavorite(church), added: true };
  }
}
