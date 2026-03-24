/**
 * Abstract Repository contract.
 *
 * Services that manage a domain entity should satisfy this interface.
 * The type-check at the bottom of each service file (`satisfies CrudRepository<...>`)
 * catches missing or mistyped methods at compile time — no runtime cost.
 *
 * Not all services are CRUD (e.g. activityLog is insert-only). Only apply where relevant.
 */

/** Minimal CRUD contract for entity services. */
export interface CrudRepository<
  T,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
> {
  fetch(): Promise<T[]>;
  fetchById(id: string): Promise<T>;
  create(input: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  remove(id: string): Promise<void>;
}

/**
 * Read-only repository for services that don't support mutations.
 */
export interface ReadRepository<T> {
  fetch(): Promise<T[]>;
  fetchById(id: string): Promise<T>;
}

/**
 * Repository with position/kanban support.
 */
export interface KanbanRepository<T, TCreate, TUpdate, TStatus extends string>
  extends CrudRepository<T, TCreate, TUpdate> {
  move(id: string, newStatus: TStatus, newPosition: number): Promise<void>;
}
