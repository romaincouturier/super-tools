import {
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

interface UseKanbanDndOptions {
  enableKeyboard?: boolean;
}

export function useKanbanDnd({ enableKeyboard = false }: UseKanbanDndOptions = {}) {
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 8 },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(
    mouseSensor,
    touchSensor,
    ...(enableKeyboard ? [keyboardSensor] : []),
  );

  return { sensors };
}
