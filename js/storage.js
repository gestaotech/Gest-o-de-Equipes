// ============================================================
// STORAGE - Camada de persistência (IndexedDB)
// Stores:
//   - kv    : chave -> valor (listas serializáveis)
//   - blobs : chave -> Blob (anexos)
// Dados são escopados por usuário (chaves "user:<uid>:...")
// ============================================================

const DB_NAME = 'gestao_equipes_db';
const DB_VERSION = 2;

let db = null;

// Abre (ou cria) o banco e as object stores necessárias
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const database = e.target.result;

            if (!database.objectStoreNames.contains('kv')) {
                database.createObjectStore('kv');
            }

            if (!database.objectStoreNames.contains('blobs')) {
                database.createObjectStore('blobs');
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onerror = (e) => {
            reject(e.target.error);
        };
    });
}

// Lê o valor armazenado em uma chave (store kv)
function dbGet(key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Grava um valor em uma chave (store kv)
function dbSet(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction('kv', 'readwrite');
        const req = tx.objectStore('kv').put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Remove uma chave (store kv)
function dbDelete(key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction('kv', 'readwrite');
        const req = tx.objectStore('kv').delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Lê um Blob (store blobs)
function dbGetBlob(key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction('blobs', 'readonly');
        const req = tx.objectStore('blobs').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Grava um Blob (store blobs)
function dbSetBlob(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction('blobs', 'readwrite');
        const req = tx.objectStore('blobs').put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Remove um Blob
function dbDeleteBlob(key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction('blobs', 'readwrite');
        const req = tx.objectStore('blobs').delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Lista todas as chaves (com prefixo opcional)
function dbKeys(prefix, store = 'kv') {
    return new Promise((resolve, reject) => {
        if (!db) return reject(new Error('Banco não aberto'));
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).openCursor();
        const keys = [];
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (!prefix || String(cursor.key).startsWith(prefix)) {
                    keys.push(cursor.key);
                }
                cursor.continue();
            } else {
                resolve(keys);
            }
        };
        req.onerror = () => reject(req.error);
    });
}
