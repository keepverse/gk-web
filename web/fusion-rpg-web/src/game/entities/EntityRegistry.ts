/**
 * base-defense `board-render` (module 16): a generic entity registry, parameterized over key type
 * and record shape — generalizes `PtrEntityRegistry`'s own exact method set (`get`/`set`/`delete`/
 * `clear`/`entries`/`keys`) so a siege board's actor-key-keyed records and the lawn's own
 * ptr-keyed, trim+uppercase-normalized records can share one implementation instead of two.
 *
 * Deliberately takes an OPTIONAL `normalizeKey` (the lawn's own trim+uppercase behavior is now a
 * caller-supplied option, not hardcoded) and an OPTIONAL `dispose` callback (called per record by
 * `clear()` — the lawn's own `rec.go.destroy(true)`; a registry of plain, non-Phaser data supplies
 * none and needs no disposal). No lawn-specific field name (`ptr`, `go`, `chips`, ...) appears
 * anywhere in this file.
 */

export type EntityRegistryOptions<TKey, TRecord> = {
  /** Identity if omitted — e.g. an actor-key registry needs no normalization at all. */
  normalizeKey?: (key: TKey) => TKey;
  /** A no-op if omitted — e.g. a registry of plain data needs no per-record cleanup. */
  dispose?: (record: TRecord) => void;
};

export class EntityRegistry<TKey, TRecord> {
  private readonly byKey = new Map<TKey, TRecord>();
  private readonly normalizeKey: (key: TKey) => TKey;
  private readonly disposeRecord: (record: TRecord) => void;

  constructor(options: EntityRegistryOptions<TKey, TRecord> = {}) {
    this.normalizeKey = options.normalizeKey ?? ((key) => key);
    this.disposeRecord = options.dispose ?? (() => undefined);
  }

  get(key: TKey): TRecord | undefined {
    return this.byKey.get(this.normalizeKey(key));
  }

  entries(): IterableIterator<TRecord> {
    return this.byKey.values();
  }

  set(key: TKey, record: TRecord): void {
    this.byKey.set(this.normalizeKey(key), record);
  }

  delete(key: TKey): TRecord | undefined {
    const normalized = this.normalizeKey(key);
    const prev = this.byKey.get(normalized);
    this.byKey.delete(normalized);
    return prev;
  }

  /** Disposes every record (via the caller-supplied `dispose`, if any) before emptying. */
  clear(): void {
    for (const record of this.byKey.values()) {
      this.disposeRecord(record);
    }
    this.byKey.clear();
  }

  keys(): TKey[] {
    return [...this.byKey.keys()];
  }
}
