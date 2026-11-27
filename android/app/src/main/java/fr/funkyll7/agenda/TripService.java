package fr.funkyll7.agenda;

import android.annotation.SuppressLint;
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
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.util.Locale;

/**
 * Un trajet en cours : GPS toutes les ~4 s, kilomètres additionnés point par point
 * (seulement les positions précises à 35 m près), notification « 🚗 Trajet en cours ».
 * Fin du trajet : descendu de voiture et immobile depuis 1 min 30, ou immobile depuis 6 min
 * (feu rouge, bouchon : on attend), ou bouton « Terminer ». Moins de 0,8 km : ignoré.
 * L'état est gardé en mémoire du téléphone pour reprendre si Android coupe le service.
 */
public class TripService extends Service {
    private static final String CH = "trajets";
    private static final int ID = 43;
    private static final long STILL_EXIT = 90_000, STILL_MAX = 6 * 60_000, MAX = 8 * 3600_000L;
    private static final float ACC = 35f, MIN_KM = 0.8f;

    private FusedLocationProviderClient fused;
    private final Handler h = new Handler(Looper.getMainLooper());
    private LocationCallback cb;

    static boolean running(Context c) { return Trips.prefs(c).getLong("cur_t0", 0) > 0; }

    static void start(Context c, boolean manual) {
        Intent i = new Intent(c, TripService.class).setAction(manual ? "manual" : "auto");
        try { c.startForegroundService(i); } catch (Exception e) {
            Trips.prefs(c).edit().putString("lastEvent", "démarrage refusé par Android : " + e.getClass().getSimpleName()).apply();
        }
    }

    static void exit(Context c) {
        if (!running(c)) return;
        Trips.prefs(c).edit().putLong("cur_exit", System.currentTimeMillis()).apply();
        try { c.startForegroundService(new Intent(c, TripService.class).setAction("exit")); } catch (Exception ignored) { }
    }

    static void stopNow(Context c) {
        if (!running(c)) return;
        try { c.startForegroundService(new Intent(c, TripService.class).setAction("stop")); } catch (Exception ignored) { }
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        foreground();
        String a = i == null ? "resume" : String.valueOf(i.getAction());
        SharedPreferences p = Trips.prefs(this);
        if ("stop".equals(a)) { finish(); return START_NOT_STICKY; }
        if (!running(this) && ("resume".equals(a) || "exit".equals(a))) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY; }
        if (!running(this)) {
            long now = System.currentTimeMillis();
            p.edit().putLong("cur_t0", now).putLong("cur_move", now).putFloat("cur_m", 0f)
                    .putBoolean("cur_has", false).remove("cur_exit").putBoolean("cur_manual", "manual".equals(a)).apply();
        } else if ("auto".equals(a) || "manual".equals(a)) {
            p.edit().remove("cur_exit").apply(); // remonté en voiture : même trajet
        }
        listen();
        tick();
        return START_STICKY;
    }

    private void foreground() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CH, "Trajets en voiture", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Affichée pendant l’enregistrement d’un trajet");
        nm.createNotificationChannel(ch);
        float m = Trips.prefs(this).getFloat("cur_m", 0f);
        Intent open = new Intent(this, MainActivity.class).setAction("trips");
        Intent stop = new Intent(this, TripService.class).setAction("stop");
        Notification n = new Notification.Builder(this, CH)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("🚗 Trajet en cours")
                .setContentText(String.format(Locale.FRANCE, "%.1f km enregistrés", m / 1000f))
                .setOngoing(true).setOnlyAlertOnce(true)
                .setContentIntent(PendingIntent.getActivity(this, 71, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                .addAction(new Notification.Action.Builder(null, "Terminer le trajet",
                        PendingIntent.getService(this, 72, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)).build())
                .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        else startForeground(ID, n);
    }

    @SuppressLint("MissingPermission")
    private void listen() {
        if (cb != null) return;
        if (!Trips.fine(this)) { finish(); return; }
        fused = LocationServices.getFusedLocationProviderClient(this);
        cb = new LocationCallback() {
            @Override public void onLocationResult(LocationResult r) { for (Location l : r.getLocations()) point(l); }
        };
        LocationRequest req = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 4000)
                .setMinUpdateIntervalMillis(2000).setMinUpdateDistanceMeters(10).build();
        try { fused.requestLocationUpdates(req, cb, Looper.getMainLooper()); }
        catch (SecurityException e) { finish(); }
    }

    /** Nouvelle position : on ajoute la distance depuis la précédente. */
    private void point(Location l) {
        if (!l.hasAccuracy() || l.getAccuracy() > ACC) return;
        SharedPreferences p = Trips.prefs(this);
        SharedPreferences.Editor e = p.edit();
        long now = System.currentTimeMillis();
        if (!p.getBoolean("cur_has", false)) {
            e.putBoolean("cur_has", true).putFloat("cur_alat", (float) l.getLatitude()).putFloat("cur_alon", (float) l.getLongitude())
                    .putFloat("cur_blat", (float) l.getLatitude()).putFloat("cur_blon", (float) l.getLongitude()).putLong("cur_move", now).apply();
            return;
        }
        float[] d = new float[1];
        Location.distanceBetween(p.getFloat("cur_blat", 0), p.getFloat("cur_blon", 0), l.getLatitude(), l.getLongitude(), d);
        // on ne compte un déplacement que s'il dépasse le flou du GPS (évite d'additionner du bruit à l'arrêt)
        if (d[0] < Math.max(15f, l.getAccuracy())) return;
        e.putFloat("cur_m", p.getFloat("cur_m", 0f) + d[0])
                .putFloat("cur_blat", (float) l.getLatitude()).putFloat("cur_blon", (float) l.getLongitude())
                .putLong("cur_move", now).apply();
        foreground(); // met à jour les km de la notification
    }

    /** Toutes les 30 s : le trajet est-il fini ? */
    private void tick() {
        h.removeCallbacksAndMessages(null);
        h.postDelayed(new Runnable() {
            @Override public void run() {
                SharedPreferences p = Trips.prefs(TripService.this);
                long now = System.currentTimeMillis(), still = now - p.getLong("cur_move", now);
                boolean exited = p.getLong("cur_exit", 0) > 0;
                if ((exited && still > STILL_EXIT) || still > STILL_MAX || now - p.getLong("cur_t0", now) > MAX) { finish(); return; }
                h.postDelayed(this, 30_000);
            }
        }, 30_000);
    }

    /** Fin : on range le trajet (avec les noms des communes) et on arrête le GPS. */
    private void finish() {
        h.removeCallbacksAndMessages(null);
        if (fused != null && cb != null) fused.removeLocationUpdates(cb);
        cb = null;
        SharedPreferences p = Trips.prefs(this);
        final float m = p.getFloat("cur_m", 0f);
        final boolean has = p.getBoolean("cur_has", false);
        final long t0 = p.getLong("cur_t0", 0), t1 = p.getLong("cur_move", System.currentTimeMillis());
        final double alat = p.getFloat("cur_alat", 0), alon = p.getFloat("cur_alon", 0), blat = p.getFloat("cur_blat", 0), blon = p.getFloat("cur_blon", 0);
        p.edit().remove("cur_t0").remove("cur_m").remove("cur_has").remove("cur_exit").remove("cur_move").apply();
        stopForeground(STOP_FOREGROUND_REMOVE);
        if (!has || m < MIN_KM * 1000) { stopSelf(); return; }
        final Context c = getApplicationContext();
        new Thread(() -> {
            try {
                String from = Trips.place(c, alat, alon), to = Trips.place(c, blat, blon);
                double km = Math.round(m / 100f) / 10.0;
                JSONObject t = new JSONObject().put("id", "trip" + t0).put("t0", t0).put("t1", t1).put("km", km)
                        .put("from", from).put("to", to)
                        .put("a", alat + "," + alon).put("b", blat + "," + blon);
                Trips.add(c, t);
                done(c, from + " → " + to + " · " + String.format(Locale.FRANCE, "%.1f km", km));
                new Handler(Looper.getMainLooper()).post(MainActivity::importNow);
            } catch (Exception ignored) { }
        }).start();
        stopSelf();
    }

    /** Petite notification « Trajet enregistré ». */
    private static void done(Context c, String text) {
        if (!Notif.enabled(c)) return;
        Intent open = new Intent(c, MainActivity.class).setAction("trips");
        Notification n = new Notification.Builder(c, CH)
                .setSmallIcon(R.drawable.ic_notif)
                .setContentTitle("🚗 Trajet enregistré")
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, 73, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                .build();
        c.getSystemService(NotificationManager.class).notify(44, n);
    }

    @Override public void onDestroy() {
        h.removeCallbacksAndMessages(null);
        if (fused != null && cb != null) fused.removeLocationUpdates(cb);
        super.onDestroy();
    }
}
