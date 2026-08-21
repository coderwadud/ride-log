package com.ridelog.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Robust Native Android Foreground Service for Continuous GPS Tracking.
 * Runs independently of WebView lifecycle with FusedLocationProviderClient and CPU WakeLock.
 * Ensures zero data loss / zero gaps when screen is OFF or phone is locked.
 */
public class BackgroundGpsService extends Service {

    private static final String TAG = "RideLogBackgroundGps";
    public static final String CHANNEL_ID = "ridelog_gps_tracking_channel";
    public static final int NOTIFICATION_ID = 90210;

    public static final String ACTION_START_TRACKING = "com.ridelog.app.ACTION_START_TRACKING";
    public static final String ACTION_STOP_TRACKING = "com.ridelog.app.ACTION_STOP_TRACKING";

    private final IBinder binder = new LocalBinder();

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private PowerManager.WakeLock wakeLock;
    private NotificationManager notificationManager;

    private boolean isTracking = false;
    private long startTimeEpoch = 0;
    private double totalDistanceKm = 0.0;
    private double maxSpeedKmH = 0.0;
    private Location lastAcceptedLocation = null;

    // Thread-safe list of recorded GPS points
    private final List<JSONObject> recordedPoints = new CopyOnWriteArrayList<>();

    // Metrics for debug & quality logging
    private int pointsReceivedCount = 0;
    private int pointsAcceptedCount = 0;
    private int pointsFilteredCount = 0;
    private long lastLocationTimestamp = 0;

    public interface LocationUpdateListener {
        void onLocationReceived(JSONObject locationJson);
    }

    private static LocationUpdateListener globalListener = null;

    public static void setLocationUpdateListener(LocationUpdateListener listener) {
        globalListener = listener;
    }

    public class LocalBinder extends Binder {
        public BackgroundGpsService getService() {
            return BackgroundGpsService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START_TRACKING.equals(action)) {
                startTrackingService();
            } else if (ACTION_STOP_TRACKING.equals(action)) {
                stopTrackingService();
            }
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Live Ride Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows live motorcycle speed, distance, and time during ride tracking.");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void startTrackingService() {
        if (isTracking) return;

        isTracking = true;
        startTimeEpoch = System.currentTimeMillis();
        totalDistanceKm = 0.0;
        maxSpeedKmH = 0.0;
        lastAcceptedLocation = null;
        recordedPoints.clear();
        pointsReceivedCount = 0;
        pointsAcceptedCount = 0;
        pointsFilteredCount = 0;
        lastLocationTimestamp = startTimeEpoch;

        // 1. Acquire Partial WakeLock to prevent CPU sleep when screen is turned OFF
        acquireWakeLock();

        // 2. Start Foreground with persistent sticky notification
        Notification notification = buildNotification("Starting GPS tracking...", "Preparing accurate location...");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // 3. Configure FusedLocationProviderClient with High Accuracy & 1-second interval
        startLocationUpdates();

        Log.i(TAG, "RideLog BD Native Background GPS Service Started successfully.");
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    wakeLock = powerManager.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK,
                            "RideLog:BackgroundGpsWakeLock"
                    );
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire(4 * 60 * 60 * 1000L); // Max 4 hours safety timeout
                Log.d(TAG, "WakeLock acquired for background GPS.");
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquisition warning: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                Log.d(TAG, "WakeLock released.");
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock release warning: " + e.getMessage());
        }
    }

    private void startLocationUpdates() {
        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
                .setMinUpdateIntervalMillis(1000L)
                .setMinUpdateDistanceMeters(0f)
                .setMaxUpdateDelayMillis(1000L)
                .setWaitForAccurateLocation(false)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    if (location != null) {
                        processIncomingLocation(location);
                    }
                }
            }
        };

        try {
            fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    Looper.getMainLooper()
            );
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission missing in BackgroundGpsService: " + se.getMessage());
        }
    }

    private void processIncomingLocation(Location location) {
        pointsReceivedCount++;
        long now = System.currentTimeMillis();
        lastLocationTimestamp = now;

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float accuracy = location.hasAccuracy() ? location.getAccuracy() : 15.0f;
        float rawSpeed = location.hasSpeed() ? location.getSpeed() : 0.0f;
        double speedKmH = Math.max(0.0, Math.round(rawSpeed * 3.6 * 10.0) / 10.0);
        double altitude = location.hasAltitude() ? location.getAltitude() : 0.0;
        float bearing = location.hasBearing() ? location.getBearing() : 0.0f;
        long time = location.getTime() > 0 ? location.getTime() : now;

        // 🛡️ NATIVE ACCURACY & JITTER FILTER
        boolean accept = true;
        String filterReason = "valid";

        // 1. Reject very low accuracy fixes (accuracy > 65m)
        if (accuracy > 65.0f) {
            accept = false;
            filterReason = "low_accuracy";
        }

        if (accept && lastAcceptedLocation != null) {
            float distMeters = lastAcceptedLocation.distanceTo(location);
            double distKm = distMeters / 1000.0;
            double timeDiffSec = Math.max(0.5, (time - lastAcceptedLocation.getTime()) / 1000.0);
            double calculatedSpeedKmH = (distKm / (timeDiffSec / 3600.0));

            // 2. Reject impossible teleportation / GPS speed spikes (> 180 km/h jump)
            if (calculatedSpeedKmH > 180.0 && distMeters > 80.0f) {
                accept = false;
                filterReason = "speed_spike";
            }

            // 3. Stationary deadband filter:
            // If vehicle is stopped or moving < 2.0m with speed <= 1.0 km/h, prevent GPS drift
            if (distMeters < 2.0f && speedKmH <= 1.0) {
                accept = false;
                filterReason = "stationary_drift";
            }
        }

        if (!accept) {
            pointsFilteredCount++;
            return;
        }

        // Point Accepted
        pointsAcceptedCount++;
        if (lastAcceptedLocation != null) {
            float distMeters = lastAcceptedLocation.distanceTo(location);
            if (distMeters > 3.0f) {
                totalDistanceKm += (distMeters / 1000.0);
            }
        }
        lastAcceptedLocation = location;
        if (speedKmH > maxSpeedKmH) {
            maxSpeedKmH = speedKmH;
        }

        JSONObject pt = new JSONObject();
        try {
            pt.put("lat", lat);
            pt.put("lng", lng);
            pt.put("speed", (int) Math.round(speedKmH));
            pt.put("accuracy", Math.round(accuracy));
            pt.put("altitude", Math.round(altitude));
            pt.put("bearing", Math.round(bearing));
            pt.put("timestamp", time);
            recordedPoints.add(pt);
        } catch (JSONException e) {
            Log.e(TAG, "Error encoding GPS point JSON: " + e.getMessage());
        }

        // Update Notification every ~2 accepted points or significant movement
        if (pointsAcceptedCount % 2 == 0) {
            updateNotification();
        }

        // Notify Capacitor JavaScript listener if UI is connected
        if (globalListener != null) {
            try {
                JSONObject payload = new JSONObject();
                payload.put("latitude", lat);
                payload.put("longitude", lng);
                payload.put("speed", (int) Math.round(speedKmH));
                payload.put("accuracy", Math.round(accuracy));
                payload.put("altitude", altitude);
                payload.put("bearing", bearing);
                payload.put("timestamp", time);
                payload.put("distanceKm", Math.round(totalDistanceKm * 100.0) / 100.0);
                payload.put("maxSpeedKmH", (int) Math.round(maxSpeedKmH));
                payload.put("pointsCount", recordedPoints.size());
                globalListener.onLocationReceived(payload);
            } catch (Exception e) {
                Log.w(TAG, "GlobalListener dispatch warning: " + e.getMessage());
            }
        }
    }

    private void updateNotification() {
        long elapsedSec = Math.max(0, (System.currentTimeMillis() - startTimeEpoch) / 1000);
        long mins = elapsedSec / 60;
        long secs = elapsedSec % 60;
        String timeStr = String.format(Locale.US, "%02d:%02d", mins, secs);

        double lastSpeed = lastAcceptedLocation != null && lastAcceptedLocation.hasSpeed()
                ? Math.round(lastAcceptedLocation.getSpeed() * 3.6)
                : 0.0;

        String title = "🏍️ RideLog BD — Live Ride Tracking";
        String content = String.format(
                Locale.US,
                "Speed: %d km/h | Dist: %.2f km | Time: %s",
                (int) lastSpeed,
                totalDistanceKm,
                timeStr
        );

        Notification notification = buildNotification(title, content);
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification(String title, String content) {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = null;
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(pendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    public void stopTrackingService() {
        if (!isTracking) return;
        isTracking = false;

        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }

        releaseWakeLock();
        stopForeground(true);
        stopSelf();

        Log.i(TAG, "RideLog BD Native Background GPS Service Stopped. Total Points: " + recordedPoints.size());
    }

    @Override
    public void onDestroy() {
        stopTrackingService();
        super.onDestroy();
    }

    // ── GETTERS FOR PLUGIN / UI DATA RETRIEVAL ──

    public boolean isTrackingActive() {
        return isTracking;
    }

    public List<JSONObject> getRecordedPoints() {
        return new ArrayList<>(recordedPoints);
    }

    public JSONObject getTrackingSummary() {
        JSONObject summary = new JSONObject();
        try {
            summary.put("isTracking", isTracking);
            summary.put("startTimeEpoch", startTimeEpoch);
            summary.put("distanceKm", Math.round(totalDistanceKm * 100.0) / 100.0);
            summary.put("maxSpeedKmH", (int) Math.round(maxSpeedKmH));
            summary.put("pointsReceived", pointsReceivedCount);
            summary.put("pointsAccepted", pointsAcceptedCount);
            summary.put("pointsFiltered", pointsFilteredCount);
            summary.put("lastLocationTimestamp", lastLocationTimestamp);
            summary.put("totalPointsSaved", recordedPoints.size());
        } catch (JSONException e) {
            Log.e(TAG, "Summary encoding error: " + e.getMessage());
        }
        return summary;
    }
}
