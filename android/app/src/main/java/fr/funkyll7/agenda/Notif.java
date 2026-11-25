package fr.funkyll7.agenda;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDateTime;
import java.time.ZoneId;

/** Notifications programmées dans le téléphone (liste calculée par le site, 8 jours d'avance). */
final class Notif {
    static final String CH = "rappels";
    private static final String P = "notif";
    private static final long LATE = 20 * 60 * 1000L; // une notification en retard de plus de 20 min n'est plus envoyée

    private Notif() {}

    static void channel(Context c) {
        NotificationChannel ch = new NotificationChannel(CH, "Rappels", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Résumé du matin, veille au soir et rappels 1 h avant");
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    static boolean enabled(Context c) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        return c.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }

    private static long time(String at) {
        return LocalDateTime.parse(at).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    /** Nouvelle liste envoyée par le site. */
    static void save(Context c, String json) {
        prefs(c).edit().putString("plan", json).apply();
        run(c);
    }

    /** Envoie ce qui est dû maintenant, puis programme la prochaine. */
    static synchronized void run(Context c) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray plan = new JSONArray(p.getString("plan", "[]"));
            JSONArray sent = new JSONArray(p.getString("sent", "[]"));
            long now = System.currentTimeMillis(), next = Long.MAX_VALUE;
            boolean changed = false;
            for (int k = 0; k < plan.length(); k++) {
                JSONObject o = plan.getJSONObject(k);
                String tag = o.optString("tag");
                if (has(sent, tag)) continue;
                long t = time(o.getString("at"));
                if (t <= now + 30_000) {
                    if (now - t <= LATE) show(c, o.optString("title"), o.optString("body"), tag);
                    sent.put(tag);
                    changed = true;
                } else if (t < next) next = t;
            }
            if (changed) {
                while (sent.length() > 150) sent.remove(0);
                p.edit().putString("sent", sent.toString()).apply();
            }
            alarm(c, next == Long.MAX_VALUE ? -1 : next);
        } catch (Exception ignored) { }
    }

    private static boolean has(JSONArray a, String s) {
        for (int k = 0; k < a.length(); k++) if (s.equals(a.optString(k))) return true;
        return false;
    }

    private static void alarm(Context c, long at) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = PendingIntent.getBroadcast(c, 2, new Intent(c, AlarmReceiver.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        if (at < 0) { am.cancel(pi); return; }
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    static void show(Context c, String title, String body, String tag) {
        if (!enabled(c)) return;
        channel(c);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CH)
                .setSmallIcon(R.drawable.ic_notif)
                .setColor(0xFF0E6B6B)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        c.getSystemService(NotificationManager.class).notify(tag.hashCode(), n);
    }
}
