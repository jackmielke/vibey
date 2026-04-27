import * as React from "react";

/**
 * Returns true when the app is running as an installed PWA
 * (iOS standalone or display-mode: standalone on Android/desktop).
 */
export function useIsStandalone() {
  const [standalone, setStandalone] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      const mql = window.matchMedia("(display-mode: standalone)").matches;
      // iOS Safari
      const iosStandalone = (window.navigator as any).standalone === true;
      setStandalone(mql || iosStandalone);
    };
    check();
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener?.("change", check);
    return () => mql.removeEventListener?.("change", check);
  }, []);

  return standalone;
}
