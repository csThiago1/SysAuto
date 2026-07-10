import Dexie, { type EntityTable } from "dexie";

export type DraftStatus = "pending" | "syncing" | "conflict" | "failed";

/**
 * Mutation enfileirada offline. Replay genérico por URL+método —
 * o body JSON (ou os campos do FormData) é remontado no drain.
 */
export interface DraftMutation {
  /** client_uuid v7 — também injetado no payload pra idempotência no backend */
  id: string;
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  headers: Record<string, string>;
  /** body JSON, ou campos texto do FormData (multipart) */
  payload?: Record<string, unknown>;
  /** arquivo do FormData, se houver (Blob é serializável em IndexedDB) */
  blob?: Blob;
  blobField?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: DraftStatus;
}

// ponytail: sem tabelas de cache de leitura — o SW NetworkFirst (onda 2) já
// serve GETs offline; adicionar cache estruturado só se o HTTP cache faltar.
export const db = new Dexie("dscar-offline") as Dexie & {
  drafts: EntityTable<DraftMutation, "id">;
};

db.version(1).stores({
  drafts: "id, status, createdAt",
});
