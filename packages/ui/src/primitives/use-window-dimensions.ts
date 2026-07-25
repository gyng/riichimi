import { useEffect, useState } from "react";

export interface WindowDimensions {
  readonly height: number;
  readonly width: number;
}

function measure(): WindowDimensions {
  return { height: window.innerHeight, width: window.innerWidth };
}

/**
 * The viewport size, tracked across resizes and rotations. Layouts read it to
 * choose between a phone and a desktop arrangement; a media query cannot, because
 * the choice also changes which elements exist, not only how they look.
 */
export function useWindowDimensions(): WindowDimensions {
  const [dimensions, setDimensions] = useState<WindowDimensions>(measure);

  useEffect(() => {
    const onResize = () =>
      setDimensions((current) => {
        const next = measure();
        return current.height === next.height && current.width === next.width ? current : next;
      });
    window.addEventListener("resize", onResize);
    // A resize between the first render and this subscription would be missed.
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return dimensions;
}
