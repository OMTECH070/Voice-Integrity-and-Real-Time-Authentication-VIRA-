package com.vira.voiceintegrity;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "ViraAudioRouting")
public class ViraAudioRoutingPlugin extends Plugin {
    private static final String TAG = "ViraAudioRouting";

    @PluginMethod
    public void setSpeakerEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Missing 'enabled' parameter");
            return;
        }

        try {
            Context context = getContext();
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) {
                call.reject("AudioManager not available");
                return;
            }

            // Ensure communication mode is active for telephony / WebRTC voice calls
            if (audioManager.getMode() != AudioManager.MODE_IN_COMMUNICATION) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            }

            boolean routed = false;
            String activeRoute = enabled ? "speaker" : "earpiece";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                List<AudioDeviceInfo> availableDevices = audioManager.getAvailableCommunicationDevices();
                AudioDeviceInfo targetDevice = null;

                for (AudioDeviceInfo device : availableDevices) {
                    int type = device.getType();
                    if (enabled) {
                        if (type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                            targetDevice = device;
                            break;
                        }
                    } else {
                        if (type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                            targetDevice = device;
                            break;
                        }
                    }
                }

                if (targetDevice != null) {
                    routed = audioManager.setCommunicationDevice(targetDevice);
                    Log.d(TAG, "setCommunicationDevice routed to " + activeRoute + ": " + routed);
                } else {
                    // Fallback for devices where availableDevices list does not expose discrete type
                    audioManager.setSpeakerphoneOn(enabled);
                    routed = true;
                    Log.d(TAG, "Fallback setSpeakerphoneOn: " + enabled);
                }
            } else {
                audioManager.setSpeakerphoneOn(enabled);
                routed = true;
                Log.d(TAG, "Legacy setSpeakerphoneOn: " + enabled);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("speakerOn", enabled);
            ret.put("route", activeRoute);
            ret.put("applied", routed);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error setting speaker route: " + e.getMessage(), e);
            call.reject("Failed to set audio route: " + e.getMessage());
        }
    }

    @PluginMethod
    public void resetAudioMode(PluginCall call) {
        try {
            Context context = getContext();
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice();
                }
                audioManager.setSpeakerphoneOn(false);
                audioManager.setMode(AudioManager.MODE_NORMAL);
                Log.d(TAG, "Reset audio mode to MODE_NORMAL");
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error resetting audio mode: " + e.getMessage(), e);
            call.reject("Failed to reset audio mode: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAudioRoute(PluginCall call) {
        try {
            Context context = getContext();
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) {
                call.reject("AudioManager not available");
                return;
            }

            boolean isSpeaker = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioDeviceInfo commDevice = audioManager.getCommunicationDevice();
                if (commDevice != null) {
                    isSpeaker = (commDevice.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);
                } else {
                    isSpeaker = audioManager.isSpeakerphoneOn();
                }
            } else {
                isSpeaker = audioManager.isSpeakerphoneOn();
            }

            JSObject ret = new JSObject();
            ret.put("speakerOn", isSpeaker);
            ret.put("mode", audioManager.getMode());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get audio route: " + e.getMessage());
        }
    }
}
