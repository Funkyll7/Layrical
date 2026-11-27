package fr.funkyll7.agenda;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Trajets en voiture, détectés tout seuls.
 * Google Play (reconnaissance d'activité) prévient quand on monte en voiture / en descend :
 * le GPS ne tourne que pendant le trajet (TripService), donc peu de batterie.
 * Chaque trajet terminé (≥ 0,8 km) est mis en attente ici, puis récupéré par le site
 * (onglet 🚗 Trajets) qui l'enregistre et le synchronise.
 */
final class Trips {
    static final String P = "trips";
    private Trips() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }

    // ---------- autorisations ----------

    static boolean fine(Context c) { return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED; }

    static boolean background(Context c) {
        return Build.VERSION.SDK_INT < 29 || c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean activity(Context c) {
        return Build.VERSION.SDK_INT < 29 || c.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean battery(Context c) {
        PowerManager pm = c.getSystemService(PowerManager.class);
        return pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
    }

    static final int REQ = 7, REQ_BG = 8;

    /**
     * Demande ce qui manque, une étape à la fois :
     * 1. position + activité physique  2. position « Toujours autoriser »  3. pas d'économie de batterie.
     */
    static void ask(Activity a) {
        if (!fine(a) || !activity(a)) {
            List<String> l = new ArrayList<>();
            l.add(Manifest.permission.ACCESS_FINE_LOCATION);
            l.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            if (Build.VERSION.SDK_INT >= 29) l.add(Manifest.permission.ACTIVITY_RECOGNITION);
            a.requestPermissions(l.toArray(new String[0]), REQ);
        } else if (!background(a)) {
            a.requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, REQ_BG);
        } else if (!battery(a)) {
            try {
                a.startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + a.getPackageName())));
            } catch (Exception e) {
                try { a.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception ignored) { }
            }
        }
        register(a);
    }

    /** Après une réponse : on enchaîne sur l'étape suivante. */
    static void onResult(Activity a, int req) {
        if (req != REQ && req != REQ_BG) return;
        if (fine(a) && activity(a) && (req == REQ || background(a))) ask(a);
        register(a);
    }

    // ---------- suivi automatique ----------

    static boolean on(Context c) { return prefs(c).getBoolean("on", false); }

    static void enable(Context c, boolean on) {
        prefs(c).edit().putBoolean("on", on).apply();
        if (on) register(c); else unregister(c);
    }

    private static PendingIntent pi(Context c) {
        Intent i = new Intent(c, TripReceiver.class).setAction(TripReceiver.ACTION);
        // MUTABLE : Google Play y ajoute le résultat (monté / descendu de voiture)
        return PendingIntent.getBroadcast(c, 70, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
    }

    /** Abonnement « monte en voiture / descend de voiture » (à refaire après un redémarrage). */
    static void register(Context c) {
        if (!on(c) || !fine(c) || !activity(c)) return;
        List<ActivityTransition> l = new ArrayList<>();
        l.add(new ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER).build());
        l.add(new ActivityTransition.Builder().setActivityType(DetectedActivity.IN_VEHICLE)
                .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT).build());
        try {
            ActivityRecognition.getClient(c.getApplicationContext())
                    .requestActivityTransitionUpdates(new ActivityTransitionRequest(l), pi(c.getApplicationContext()))
                    .addOnSuccessListener(v -> prefs(c).edit().putString("reg", "ok").apply())
                    .addOnFailureListener(e -> prefs(c).edit().putString("reg", "erreur : " + e.getMessage()).apply());
        } catch (SecurityException e) {
            prefs(c).edit().putString("reg", "autorisation manquante").apply();
        }
    }

    static void unregister(Context c) {
        try { ActivityRecognition.getClient(c.getApplicationContext()).removeActivityTransitionUpdates(pi(c.getApplicationContext())); }
        catch (SecurityException ignored) { }
    }

    /** État pour le site. */
    static String state(Context c) {
        try {
            SharedPreferences p = prefs(c);
            return new JSONObject()
                    .put("on", on(c)).put("loc", fine(c)).put("bg", background(c)).put("act", activity(c)).put("bat", battery(c))
                    .put("reg", p.getString("reg", ""))
                    .put("rec", TripService.running(c))
                    .put("km", Math.round(p.getFloat("cur_m", 0f) / 100f) / 10.0)
                    .put("since", p.getLong("cur_t0", 0))
                    .put("last", p.getString("lastEvent", ""))
                    .toString();
        } catch (Exception e) { return "{}"; }
    }

    // ---------- trajets terminés, en attente pour le site ----------

    static synchronized void add(Context c, JSONObject t) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("pending", "[]"));
            a.put(t);
            prefs(c).edit().putString("pending", a.toString()).apply();
        } catch (Exception ignored) { }
    }

    static synchronized String pending(Context c) { return prefs(c).getString("pending", "[]"); }

    /** Le site a bien enregistré ces trajets : on les retire de l'attente. */
    static synchronized void ack(Context c, String idsJson) {
        try {
            JSONArray ids = new JSONArray(idsJson);
            Set<String> s = new HashSet<>();
            for (int i = 0; i < ids.length(); i++) s.add(ids.getString(i));
            JSONArray a = new JSONArray(prefs(c).getString("pending", "[]")), keep = new JSONArray();
            for (int i = 0; i < a.length(); i++) if (!s.contains(a.getJSONObject(i).optString("id"))) keep.put(a.get(i));
            prefs(c).edit().putString("pending", keep.toString()).apply();
        } catch (Exception ignored) { }
    }

    /** Nom de la commune (Guillac, Josselin…) à partir des coordonnées GPS. */
    @SuppressWarnings("deprecation")
    static String place(Context c, double lat, double lon) {
        try {
            if (Geocoder.isPresent()) {
                List<Address> l = new Geocoder(c, Locale.FRANCE).getFromLocation(lat, lon, 1);
                if (l != null && !l.isEmpty()) {
                    Address a = l.get(0);
                    if (a.getLocality() != null) return a.getLocality();
                    if (a.getSubLocality() != null) return a.getSubLocality();
                    if (a.getSubAdminArea() != null) return a.getSubAdminArea();
                }
            }
        } catch (Exception ignored) { }
        return String.format(Locale.FRANCE, "%.4f, %.4f", lat, lon);
    }
}
