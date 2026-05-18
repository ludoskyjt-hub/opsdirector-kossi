import * as React from "react";

interface UseCompositionOptions<T extends HTMLElement> {
  onKeyDown?: (e: React.KeyboardEvent<T>) => void;
  onCompositionStart?: (e: React.CompositionEvent<T>) => void;
  onCompositionEnd?: (e: React.CompositionEvent<T>) => void;
}

interface UseCompositionResult<T extends HTMLElement> {
  onKeyDown: (e: React.KeyboardEvent<T>) => void;
  onCompositionStart: (e: React.CompositionEvent<T>) => void;
  onCompositionEnd: (e: React.CompositionEvent<T>) => void;
}

export function useComposition<T extends HTMLElement>(
  options: UseCompositionOptions<T> = {}
): UseCompositionResult<T> {
  const isComposing = React.useRef(false);

  const onCompositionStart = React.useCallback(
    (e: React.CompositionEvent<T>) => {
      isComposing.current = true;
      options.onCompositionStart?.(e);
    },
    [options.onCompositionStart]
  );

  const onCompositionEnd = React.useCallback(
    (e: React.CompositionEvent<T>) => {
      isComposing.current = false;
      options.onCompositionEnd?.(e);
    },
    [options.onCompositionEnd]
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<T>) => {
      options.onKeyDown?.(e);
    },
    [options.onKeyDown]
  );

  return { onKeyDown, onCompositionStart, onCompositionEnd };
}
