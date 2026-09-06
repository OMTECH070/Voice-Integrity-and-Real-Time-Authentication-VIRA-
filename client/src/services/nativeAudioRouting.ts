import { Capacitor, registerPlugin } from "@capacitor/core";

export interface ViraAudioRoutingPlugin {
  setSpeakerEnabled(options: { enabled: boolean }): Promise<{
    success: boolean;
    speakerOn: boolean;
    route: string;
    applied: boolean;
  }>;
  resetAudioMode(): Promise<{ success: boolean }>;
  getAudioRoute(): Promise<{ speakerOn: boolean; mode: number }>;
}

let nativePlugin: ViraAudioRoutingPlugin | null = null;

function getNativePlugin(): ViraAudioRoutingPlugin | null {
  if (nativePlugin) return nativePlugin;

  if (typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    try {
      nativePlugin = registerPlugin<ViraAudioRoutingPlugin>("ViraAudioRouting");
      return nativePlugin;
    } catch (err) {
      console.warn("[VIRA][AUDIO] Failed to register native ViraAudioRouting plugin:", err);
      return null;
    }
  }

  return null;
}

/**
 * Returns true if running natively inside Android Capacitor container.
 */
export function isNativeAndroidAudioAvailable(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/**
 * Sets native audio routing.
 * speakerOn = true: Route WebRTC call audio to Android loudspeaker.
 * speakerOn = false: Route WebRTC call audio to Android phone earpiece/receiver.
 *
 * In web browsers, falls back gracefully to web setSinkId logic if supported.
 * Remote audio is NEVER muted by this function.
 */
export async function setNativeSpeakerEnabled(
  enabled: boolean,
  fallbackAudioEl?: HTMLAudioElement | null
): Promise<{ success: boolean; native: boolean; route: string }> {
  const plugin = getNativePlugin();

  if (plugin) {
    try {
      const res = await plugin.setSpeakerEnabled({ enabled });
      console.log(`[VIRA][AUDIO] Native Android audio route set: speakerOn=${enabled}, route=${res.route}, applied=${res.applied}`);
      return { success: true, native: true, route: res.route };
    } catch (err) {
      console.warn("[VIRA][AUDIO] Native audio routing call failed, falling back to web route:", err);
    }
  }

  // Web Browser Fallback
  if (fallbackAudioEl) {
    await applyWebAudioRouteFallback(fallbackAudioEl, enabled);
  }

  return { success: true, native: false, route: enabled ? "speaker" : "earpiece" };
}

/**
 * Resets native audio state when call ends.
 * Restores Android audio manager to MODE_NORMAL and speakerphone off so phone does not stay in call mode.
 */
export async function resetNativeAudioMode(): Promise<void> {
  const plugin = getNativePlugin();
  if (plugin) {
    try {
      await plugin.resetAudioMode();
      console.log("[VIRA][AUDIO] Native Android audio mode reset to normal");
    } catch (err) {
      console.warn("[VIRA][AUDIO] Failed to reset native audio mode:", err);
    }
  }
}

/**
 * Graceful web fallback for desktop and mobile browsers.
 * Never mutes remote audio in either state.
 */
export async function applyWebAudioRouteFallback(
  audioEl: HTMLAudioElement | null,
  isSpeakerOn: boolean
): Promise<void> {
  if (!audioEl) return;

  // Remote caller audio MUST remain audible in both states
  audioEl.muted = false;

  if (!("setSinkId" in audioEl) || typeof (audioEl as any).setSinkId !== "function") {
    return;
  }

  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      await (audioEl as any).setSinkId("");
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

    if (audioOutputs.length === 0) {
      await (audioEl as any).setSinkId("");
      return;
    }

    if (isSpeakerOn) {
      const speakerDevice = audioOutputs.find((d) => {
        const label = d.label.toLowerCase();
        return (
          (label.includes("speaker") || label.includes("loudspeaker")) &&
          !label.includes("earpiece") &&
          !label.includes("handset") &&
          !label.includes("headphone") &&
          !label.includes("headset")
        );
      });

      const targetId = speakerDevice
        ? speakerDevice.deviceId
        : (audioOutputs.find((d) => d.deviceId === "default")?.deviceId || "");
      await (audioEl as any).setSinkId(targetId);
    } else {
      const earpieceDevice = audioOutputs.find((d) => {
        const label = d.label.toLowerCase();
        return (
          label.includes("earpiece") ||
          label.includes("handset") ||
          label.includes("receiver") ||
          label.includes("phone") ||
          label.includes("headphone") ||
          label.includes("headset") ||
          label.includes("communications")
        );
      });

      const targetId = earpieceDevice ? earpieceDevice.deviceId : "";
      await (audioEl as any).setSinkId(targetId);
    }
  } catch (err) {
    console.warn("[VIRA][AUDIO] Web setSinkId routing fallback (audio remains audible):", err);
    audioEl.muted = false;
  }
}
