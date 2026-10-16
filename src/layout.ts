import { useWindowDimensions } from "react-native";

/** Widths where the desktop composition stops fitting. */
export function useScreen() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    /** Header and page padding stack before the desktop row overflows. */
    compact: width < 1000,
    /** Illustration labels move out of the scene so they stay readable. */
    narrow: width < 640,
  };
}
