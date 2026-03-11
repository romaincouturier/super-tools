import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

/**
 * Collision detection optimised for multi-container kanban boards.
 * Uses pointerWithin for reliable container detection (handles empty columns),
 * then closestCenter among matched droppables for card-level precision.
 */
export const kanbanCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const ids = new Set(pointerCollisions.map((c) => c.id));
    const filtered = args.droppableContainers.filter((c) => ids.has(c.id));
    if (filtered.length > 0) {
      const refined = closestCenter({ ...args, droppableContainers: filtered });
      if (refined.length > 0) return refined;
    }
    return pointerCollisions;
  }
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCenter(args);
};
