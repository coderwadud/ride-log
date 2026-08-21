package com.ridelog.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

@CapacitorPlugin(
        name = "BackgroundGps",
        permissions = {
                @Permission(
                        alias = "location",
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }
                ),
                @Permission(
                        alias = "notifications",
                        strings = {
                                Manifest.permission.POST_NOTIFICATIONS
                        }
                )
        }
)
public class BackgroundGpsPlugin extends Plugin {

    private static final String TAG = "BackgroundGpsPlugin";
    private BackgroundGpsService gpsService;
    private boolean isBound = false;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            BackgroundGpsService.LocalBinder binder = (BackgroundGpsService.LocalBinder) service;
            gpsService = binder.getService();
            isBound = true;
            Log.d(TAG, "Connected to native BackgroundGpsService.");
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            gpsService = null;
            isBound = false;
            Log.d(TAG, "Disconnected from native BackgroundGpsService.");
        }
    };

    @Override
    public void load() {
        super.load();

        // Connect global location listener from Service to Capacitor Web event stream
        BackgroundGpsService.setLocationUpdateListener(locationJson -> {
            try {
                JSObject jsObj = JSObject.fromJSONObject(locationJson);
                notifyListeners("onLocationUpdate", jsObj);
            } catch (Exception e) {
                Log.w(TAG, "Listener notification error: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        Context context = getContext();

        // Check and request fine location permission if missing
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermsCallback");
            return;
        }

        try {
            Intent serviceIntent = new Intent(context, BackgroundGpsService.class);
            serviceIntent.setAction(BackgroundGpsService.ACTION_START_TRACKING);
            ContextCompat.startForegroundService(context, serviceIntent);
            context.bindService(serviceIntent, serviceConnection, Context.BIND_AUTO_CREATE);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Native Android Background GPS tracking started.");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start native GPS service: " + e.getMessage());
            call.reject("Failed to start native GPS service: " + e.getMessage());
        }
    }

    @PermissionCallback
    private void locationPermsCallback(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            startTracking(call);
        } else {
            call.reject("Location permission was denied.");
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Context context = getContext();
        try {
            List<JSONObject> points = null;
            JSONObject summary = null;

            if (gpsService != null) {
                points = gpsService.getRecordedPoints();
                summary = gpsService.getTrackingSummary();
            }

            Intent serviceIntent = new Intent(context, BackgroundGpsService.class);
            serviceIntent.setAction(BackgroundGpsService.ACTION_STOP_TRACKING);
            context.startService(serviceIntent);

            if (isBound) {
                try {
                    context.unbindService(serviceConnection);
                } catch (Exception ignored) {}
                isBound = false;
            }
            gpsService = null;

            JSObject ret = new JSObject();
            ret.put("success", true);

            JSArray jsPoints = new JSArray();
            if (points != null) {
                for (JSONObject pt : points) {
                    jsPoints.put(JSObject.fromJSONObject(pt));
                }
            }
            ret.put("points", jsPoints);

            if (summary != null) {
                ret.put("summary", JSObject.fromJSONObject(summary));
            }

            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop native GPS service: " + e.getMessage());
            call.reject("Failed to stop native GPS service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getRecordedPoints(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            JSArray jsPoints = new JSArray();

            if (gpsService != null) {
                List<JSONObject> points = gpsService.getRecordedPoints();
                for (JSONObject pt : points) {
                    jsPoints.put(JSObject.fromJSONObject(pt));
                }
                ret.put("isTracking", gpsService.isTrackingActive());
                ret.put("summary", JSObject.fromJSONObject(gpsService.getTrackingSummary()));
            } else {
                ret.put("isTracking", false);
            }

            ret.put("points", jsPoints);
            ret.put("count", jsPoints.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error retrieving points: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getTrackingStatus(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            if (gpsService != null) {
                ret.put("isActive", gpsService.isTrackingActive());
                ret.put("summary", JSObject.fromJSONObject(gpsService.getTrackingSummary()));
            } else {
                ret.put("isActive", false);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Status error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        Context context = getContext();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                String packageName = context.getPackageName();
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent();
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    JSObject ret = new JSObject();
                    ret.put("requested", true);
                    call.resolve(ret);
                    return;
                }
            }
            JSObject ret = new JSObject();
            ret.put("requested", false);
            ret.put("alreadyIgnored", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("requested", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
}
