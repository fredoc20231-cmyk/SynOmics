import { useEffect, type RefObject } from "react";

export type PersistentMenuDismissEvent =
  | { type: "pointermove" }
  | { type: "mousemove" }
  | { type: "mouseleave" }
  | { type: "mouseout" }
  | { type: "pointerdown"; inside: boolean }
  | { type: "mousedown"; inside: boolean }
  | { type: "click"; inside: boolean }
  | { type: "keydown"; key: string }
  | { type: "trigger-toggle" }
  | { type: "action" };

/**
 * Click-to-open menus stay open until an action, an outside press, Escape,
 * or a second trigger click. Pointer travel and mouse leave never dismiss.
 */
export function persistentMenuShouldDismiss(event: PersistentMenuDismissEvent): boolean {
  if (
    event.type === "pointermove" ||
    event.type === "mousemove" ||
    event.type === "mouseleave" ||
    event.type === "mouseout"
  ) {
    return false;
  }
  if (event.type === "action" || event.type === "trigger-toggle") return true;
  if (event.type === "keydown") return event.key === "Escape";
  if (event.type === "pointerdown" || event.type === "mousedown" || event.type === "click") {
    return !event.inside;
  }
  return false;
}

export function usePersistentMenu(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  restoreFocus?: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      const inside = target instanceof Node && Boolean(containerRef.current?.contains(target));
      if (persistentMenuShouldDismiss({ type: "pointerdown", inside })) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (!persistentMenuShouldDismiss({ type: "keydown", key: event.key })) return;
      event.preventDefault();
      onClose();
      window.requestAnimationFrame(() => restoreFocus?.());
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [containerRef, onClose, open, restoreFocus]);
}

export function flipMenuIntoViewport(node: HTMLElement | null): void {
  if (!node || typeof window === "undefined") return;
  node.style.top = "";
  node.style.bottom = "";
  node.style.left = "";
  node.style.right = "";
  const rect = node.getBoundingClientRect();
  const margin = 8;
  if (rect.bottom > window.innerHeight - margin) {
    node.style.top = "auto";
    node.style.bottom = "100%";
  }
  if (rect.right > window.innerWidth - margin) {
    node.style.left = "auto";
    node.style.right = "0";
  }
  if (rect.left < margin) {
    node.style.left = "0";
    node.style.right = "auto";
  }
}
