import { openDB } from 'idb';

const dbName = 'sticky-notes-db';
const storeName = 'notes';

export async function initDB() {
  const db = await openDB(dbName, 1, {
    upgrade(db) {
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('pinned', 'pinned');
    },
  });
  return db;
}

export async function getAllNotes() {
  const db = await initDB();
  return db.getAll(storeName);
}

export async function addNote(note) {
  const db = await initDB();
  return db.add(storeName, note);
}

export async function updateNote(note) {
  const db = await initDB();
  return db.put(storeName, note);
}

export async function deleteNote(id) {
  const db = await initDB();
  return db.delete(storeName, id);
}

export async function importNotes(notes) {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readwrite');
  await Promise.all([
    ...notes.map(note => tx.store.put(note)),
    tx.done
  ]);
}

export async function clearAllNotes() {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.store.clear();
  await tx.done;
}