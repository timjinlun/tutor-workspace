import { systemPreferences } from "electron";

/** Electron returns the system accent as RRGGBBAA. */
export function systemAccent(platform: NodeJS.Platform = process.platform): string | null {
  if (platform !== "darwin" && platform !== "win32") return null;
  try {
    const rgba = systemPreferences.getAccentColor();
    return /^[\da-f]{8}$/i.test(rgba) ? "#" + rgba.slice(0, 6) : null;
  } catch {
    return null;
  }
}

export function watchSystemAccent(onChange: (hex: string) => void, platform: NodeJS.Platform = process.platform): () => void {
  const changed = () => {
    const hex = systemAccent(platform);
    if (hex) onChange(hex);
  };
  if (platform === "darwin") {
    const id = systemPreferences.subscribeNotification("AppleColorPreferencesChangedNotification", changed);
    return () => systemPreferences.unsubscribeNotification(id);
  }
  if (platform === "win32") {
    systemPreferences.on("accent-color-changed", changed);
    return () => systemPreferences.off("accent-color-changed", changed);
  }
  return () => {};
}
