import { openDB } from 'idb';

const DB_NAME = 'prok_ga_db';
const DB_VERSION = 1;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('directory')) {
        // We will store the entire JSON under a single key 'data' for simplicity,
        // or we could store individual collections. Since it's 6MB, a single object is fine,
        // but splitting it is better for querying.
        db.createObjectStore('directory');
      }
    },
  });
}

export async function saveDirectoryData(data) {
  const db = await initDB();
  const tx = db.transaction('directory', 'readwrite');
  const store = tx.objectStore('directory');
  
  await store.put(data.ministers || [], 'ministers');
  await store.put(data.churches || [], 'churches');
  await store.put(data.elders || [], 'elders');
  await store.put(data.addressbook || [], 'addressbook');
  
  await tx.done;
}

export async function getCollection(collectionName) {
  const db = await initDB();
  const data = await db.get('directory', collectionName);
  return data || [];
}
