import { normalizeOption } from "./catalog.js";
const DB_NAME = "p2pmate-db";
const DB_VERSION = 1;
const STORE = "history";
const LEGACY_KEY = "p2pmate.history.v1";
const BACKUP_VERSION = 1;

let dbPromise;

function openDB() {
  if (!("indexedDB" in globalThis)) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("date", "date");
          store.createIndex("type", "type");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir la base de datos."));
      request.onblocked = () => reject(new Error("La base de datos está bloqueada por otra pestaña."));
    }).catch(() => null);
  }
  return dbPromise;
}

function localRead() {
  try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]"); }
  catch { return []; }
}
function localWrite(items) { localStorage.setItem(LEGACY_KEY, JSON.stringify(items)); }
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Error de almacenamiento."));
  });
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("No se pudieron guardar los datos."));
    tx.onabort = () => reject(tx.error || new Error("La operación fue cancelada."));
  });
}

export async function initStorage() {
  const db = await openDB();
  if (!db) return { mode: "localStorage" };
  const tx = db.transaction(STORE, "readonly");
  const count = await requestResult(tx.objectStore(STORE).count());
  if (count === 0) {
    const legacy = localRead();
    if (legacy.length) {
      const writeTx = db.transaction(STORE, "readwrite");
      const compatible = legacy.filter(item => {
        try { normalizeOption(item.asset, "Opción de origen"); normalizeOption(item.currency, "Opción de referencia"); return true; }
        catch { return false; }
      });
      compatible.forEach((item, index) => writeTx.objectStore(STORE).put(normalizeRecord(item, index)));
      await transactionDone(writeTx);
    }
  }
  return { mode: "IndexedDB" };
}

const RECORD_NUMBERS = ["profit", "roi", "cost", "qty", "buyPrice", "sellPrice"];
const INPUT_FIELDS = new Set(["asset", "currency", "qty", "buyPrice", "sellPrice", "buyPct", "sellPct", "buyFixed", "sellFixed", "expenses"]);

function cleanInputs(inputs) {
  if (inputs == null) return undefined;
  if (typeof inputs !== "object" || Array.isArray(inputs)) throw new Error("Los datos de entrada del registro no son válidos.");
  const clean = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (!INPUT_FIELDS.has(key)) continue;
    if (!["string", "number"].includes(typeof value) || (typeof value === "number" && !Number.isFinite(value))) {
      throw new Error(`El campo ${key} contiene un valor no válido.`);
    }
    const text = String(value);
    if (text.length > 100) throw new Error(`El campo ${key} es demasiado largo.`);
    clean[key] = text;
  }
  if (clean.asset !== undefined) clean.asset = normalizeOption(clean.asset, "Opción de origen");
  if (clean.currency !== undefined) clean.currency = normalizeOption(clean.currency, "Opción de referencia");
  return clean;
}

function normalizeRecord(record, index = 0) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("El registro no tiene un formato válido.");
  const now = new Date().toISOString();
  const type = record.type ?? "hypothetical";
  if (!["real", "hypothetical"].includes(type)) throw new Error("El tipo de registro no es válido.");
  for (const key of RECORD_NUMBERS) {
    if (record[key] !== undefined && record[key] !== null && !Number.isFinite(Number(record[key]))) {
      throw new Error(`El campo ${key} debe ser numérico.`);
    }
  }
  const date = record.date || now;
  const createdAt = record.createdAt || date;
  for (const [key, value] of [["fecha", date], ["fecha de creación", createdAt]]) {
    if (typeof value !== "string" || value.length > 64 || !Number.isFinite(Date.parse(value))) {
      throw new Error(`La ${key} del registro no es válida.`);
    }
  }
  if (record.updatedAt !== undefined && (typeof record.updatedAt !== "string" || record.updatedAt.length > 64 || !Number.isFinite(Date.parse(record.updatedAt)))) {
    throw new Error("La fecha de actualización del registro no es válida.");
  }
  const id = String(record.id || `import-${Date.now()}-${index}`);
  if (id.length > 128) throw new Error("El identificador del registro es demasiado largo.");
  const note = String(record.note || "");
  if (note.length > 500) throw new Error("La nota del registro supera los 500 caracteres.");
  const clean = {
    id, type, date, createdAt,
    asset: normalizeOption(record.asset, "Opción de origen"),
    currency: normalizeOption(record.currency, "Opción de referencia"),
    note
  };
  for (const key of RECORD_NUMBERS) if (record[key] !== undefined) clean[key] = record[key] === null ? null : Number(record[key]);
  if (record.inputs !== undefined) clean.inputs = cleanInputs(record.inputs);
  if (record.updatedAt !== undefined) clean.updatedAt = record.updatedAt;
  return clean;
}

export async function getHistory() {
  const db = await openDB();
  if (!db) return localRead().flatMap((item, index) => {
    try { return [normalizeRecord(item, index)]; }
    catch { return []; }
  });
  const tx = db.transaction(STORE, "readonly");
  const rows = await requestResult(tx.objectStore(STORE).getAll());
  // Oculta registros antiguos con activos/monedas fuera del catálogo cerrado.
  const supported = rows.filter(item => {
    try { normalizeOption(item.asset, "Opción de origen"); normalizeOption(item.currency, "Opción de referencia"); return true; }
    catch { return false; }
  });
  return supported.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function saveHistory(items) {
  if (!Array.isArray(items)) throw new Error("El historial debe ser una lista.");
  const clean = items.map((item, index) => normalizeRecord(item, index));
  const db = await openDB();
  if (!db) { localWrite(clean); return clean; }
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  store.clear();
  clean.forEach(item => store.put(item));
  await transactionDone(tx);
  return clean;
}

export async function addRecord(record) {
  const now = new Date().toISOString();
  const item = normalizeRecord({ ...record, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, date: now, createdAt: now });
  const db = await openDB();
  if (!db) { const all = localRead(); all.unshift(item); localWrite(all); return all; }
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).add(item);
  await transactionDone(tx);
  return getHistory();
}

export async function updateRecord(id, record) {
  const all = await getHistory();
  const existing = all.find(item => item.id === id);
  if (!existing) throw new Error("No se encontró el registro que quieres editar.");
  const updated = normalizeRecord({ ...existing, ...record, id, date: existing.date, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
  const db = await openDB();
  if (!db) { localWrite(all.map(item => item.id === id ? updated : item)); return getHistory(); }
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(updated);
  await transactionDone(tx);
  return getHistory();
}

export async function deleteRecord(id) {
  const db = await openDB();
  if (!db) { const rows = localRead().filter(item => item.id !== id); localWrite(rows); return rows; }
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await transactionDone(tx);
  return getHistory();
}

export async function createBackup() {
  return { app: "P2P Mate", backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), records: await getHistory() };
}

export async function restoreBackup(data) {
  if (!data || data.app !== "P2P Mate" || data.backupVersion !== BACKUP_VERSION || !Array.isArray(data.records)) {
    throw new Error("El archivo no es una copia de seguridad válida de P2P Mate.");
  }
  if (data.records.length > 10000) throw new Error("La copia contiene demasiados registros.");
  const clean = data.records.map((item, index) => {
    try {
      if (!item || typeof item !== "object" || Array.isArray(item) || !item.id || !item.asset || !item.currency || item.profit === undefined || !Number.isFinite(Number(item.profit))) {
        throw new Error("Faltan campos obligatorios o el beneficio no es numérico.");
      }
      return normalizeRecord(item, index);
    } catch (error) {
      throw new Error(`El registro ${index + 1} no es válido: ${error.message}`);
    }
  });
  await saveHistory(clean);
  return clean;
}
