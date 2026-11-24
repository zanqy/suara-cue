export interface StoredCard {
  id: string;
  name: string;
  blob: Blob;
  vol: number;
  fout: number;
  fin: number;
}

const DB_NAME = 'suara-cue';
const STORE = 'cards';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'id'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCards(): Promise<StoredCard[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredCard[]);
    req.onerror = () => reject(req.error);
  });
}

export async function putCard(card: StoredCard): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(card);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCard(id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
