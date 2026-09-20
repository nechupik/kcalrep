import { useEffect, useRef, useState } from "react";

export type ModalAnimationState = "enter" | "exit" | null;

// Matches the 650ms slide/fade keyframes in index.css.
const ENTER_MS = 650;
const EXIT_MS = 800;

/**
 * Drives the slide-up / slide-down CSS classes of a bottom sheet.
 *
 * - The exit phase only runs if the sheet was actually opened, and its cleanup timer is cancelled on reopen. The old
 *   per-page copies left the timer running, so reopening within the exit window let it fire mid-slide and hide the
 *   sheet (it appeared to slide up halfway and vanish).
 * - `canDismiss` stays false while the sheet is sliding in, so a second tap on the "open" button (which by then is
 *   covered by the backdrop) can't close it again.
 */
export function useModalAnimation(isOpen: boolean) {
  const [animationState, setAnimationState] = useState<ModalAnimationState>(null);
  const [canDismiss, setCanDismiss] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      setAnimationState("enter");
      setCanDismiss(false);
      const timer = setTimeout(() => setCanDismiss(true), ENTER_MS);
      return () => clearTimeout(timer);
    }
    if (!wasOpen.current) return;
    setAnimationState("exit");
    const timer = setTimeout(() => {
      wasOpen.current = false;
      setAnimationState(null);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return { animationState, canDismiss };
}
