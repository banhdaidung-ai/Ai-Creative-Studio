
const DB_NAME = 'YodyAIStudioDB';
const STORE_NAME = 'app_state';
const DB_VERSION = 1;

interface DBState {
  id: string;
  value: any;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveState = async (key: string, value: any): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // IndexedDB requires specific object structure if keyPath is used
      // Or we can use put(value, key) if keyPath is not used. 
      // Here we defined keyPath as 'id', so we wrap the value.
      const request = store.put({ id: key, value: value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`IndexedDB Save Error for ${key}:`, error);
  }
};

export const loadState = async (key: string): Promise<any> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        // Result matches the shape { id: key, value: ... }
        const result = request.result as DBState | undefined;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`IndexedDB Load Error for ${key}:`, error);
    return null;
  }
};

export const clearState = async (key: string): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`IndexedDB Delete Error for ${key}:`, error);
    }
};
