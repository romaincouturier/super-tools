import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface UseKanbanDndOptions {
  enableKeyboard?: boolean;
}

export function useKanbanDnd({ enableKeyboard = false }: UseKanbanDndOptions = {}) {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(
    pointerSensor,
    ...(enableKeyboard ? [keyboardSensor] : []),
  );

  return { sensors };
}
