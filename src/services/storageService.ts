import Dexie, { type Table } from "dexie";
import type { ScanDocument } from "../types/scan";
class ScanStore extends Dexie {
  documents!: Table<ScanDocument, string>;
  constructor() {
    super("ScanGo");
    this.version(1).stores({ documents: "id, updatedAt, createdAt" });
  }
}
export const db = new ScanStore();
export async function saveDocument(doc: ScanDocument) {
  await db.documents.put(doc);
}
export async function listDocuments() {
  return db.documents.orderBy("updatedAt").reverse().toArray();
}
