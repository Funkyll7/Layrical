package fr.funkyll7.agenda;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Mise à jour automatique : compare la dernière version publiée sur GitHub (Releases) à celle installée. */
final class Updater {
    private static final String API = "https://api.github.com/repos/Funkyll7/Layrical/releases/latest";
    private static final String P = "update";
    static final String ACTION = "fr.funkyll7.agenda.UPDATE";
    private static boolean busy = false;

    private Updater() {}

    @SuppressWarnings("deprecation")
    static long current(Context c) {
        try {
            android.content.pm.PackageInfo i = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? i.getLongVersionCode() : i.versionCode;
        }
        catch (Exception e) { return 0; }
    }

    /** {version, url} de la dernière publication, ou null. Réseau : à appeler hors du fil principal. */
    private static Object[] latest() throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(API).openConnection();
        h.setRequestProperty("Accept", "application/vnd.github+json");
        h.setRequestProperty("User-Agent", "Agenda-Android");
        h.setConnectTimeout(15000);
        h.setReadTimeout(15000);
        if (h.getResponseCode() != 200) return null;
        InputStream in = h.getInputStream();
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        in.close();
        JSONObject o = new JSONObject(b.toString("UTF-8"));
        String tag = o.optString("tag_name", "");
        if (!tag.startsWith("app-")) return null;
        long v = Long.parseLong(tag.substring(4));
        JSONArray as = o.optJSONArray("assets");
        if (as == null) return null;
        for (int k = 0; k < as.length(); k++) {
            JSONObject a = as.getJSONObject(k);
            if ("agenda.apk".equals(a.optString("name"))) return new Object[]{v, a.getString("browser_download_url")};
        }
        return null;
    }

    /** À l'ouverture de l'appli : propose la mise à jour (au plus une vérification par heure, sauf force). */
    static void check(Activity a, boolean force) {
        SharedPreferences p = a.getSharedPreferences(P, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (!force && now - p.getLong("checked", 0) < 3600_000L) return;
        p.edit().putLong("checked", now).apply();
        new Thread(() -> {
            try {
                Object[] l = latest();
                if (l == null || (long) l[0] <= current(a)) return;
                long v = (long) l[0];
                String url = (String) l[1];
                if (!force && p.getLong("later", 0) == v && now - p.getLong("laterAt", 0) < 12 * 3600_000L) return;
                new Handler(Looper.getMainLooper()).post(() -> {
                    if (a.isFinishing()) return;
                    new AlertDialog.Builder(a)
                            .setTitle("Nouvelle version de l’appli")
                            .setMessage("La version 1.0." + v + " est disponible (tu as la 1.0." + current(a) + "). Tes données ne bougent pas.")
                            .setPositiveButton("Mettre à jour", (d, w) -> install(a, url))
                            .setNegativeButton("Plus tard", (d, w) -> p.edit().putLong("later", v).putLong("laterAt", System.currentTimeMillis()).apply())
                            .show();
                });
            } catch (Exception ignored) { }
        }).start();
    }

    /** En arrière-plan : une notification « mise à jour disponible » (au plus toutes les 6 h). */
    static void checkQuiet(Context c) {
        SharedPreferences p = c.getSharedPreferences(P, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (now - p.getLong("quiet", 0) < 6 * 3600_000L) return;
        p.edit().putLong("quiet", now).apply();
        new Thread(() -> {
            try {
                Object[] l = latest();
                if (l == null || (long) l[0] <= current(c) || p.getLong("notified", 0) == (long) l[0]) return;
                p.edit().putLong("notified", (long) l[0]).apply();
                if (!Notif.enabled(c)) return;
                Notif.channel(c);
                Intent open = new Intent(c, MainActivity.class).setAction(ACTION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                PendingIntent pi = PendingIntent.getActivity(c, 5, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                Notification n = new Notification.Builder(c, Notif.CH)
                        .setSmallIcon(R.drawable.ic_notif).setColor(0xFF0E6B6B)
                        .setContentTitle("📲 Mise à jour de l’appli Agenda")
                        .setContentText("La version 1.0." + l[0] + " est prête : touche pour l’installer.")
                        .setContentIntent(pi).setAutoCancel(true).build();
                c.getSystemService(NotificationManager.class).notify(777, n);
            } catch (Exception ignored) { }
        }).start();
    }

    static void install(Activity a, String url) {
        if (!a.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(a, "Autorise l’installation pour Agenda, puis reviens : la mise à jour te sera reproposée.", Toast.LENGTH_LONG).show();
            a.getSharedPreferences(P, Context.MODE_PRIVATE).edit().putLong("checked", 0).apply();
            a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName())));
            return;
        }
        if (busy) return;
        busy = true;
        Toast.makeText(a, "Téléchargement de la mise à jour…", Toast.LENGTH_SHORT).show();
        final Context c = a.getApplicationContext();
        new Thread(() -> {
            try {
                PackageInstaller pi = c.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                sp.setAppPackageName(c.getPackageName());
                if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                int id = pi.createSession(sp);
                PackageInstaller.Session s = pi.openSession(id);
                HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
                h.setRequestProperty("User-Agent", "Agenda-Android");
                h.setInstanceFollowRedirects(true);
                h.setConnectTimeout(20000);
                h.setReadTimeout(60000);
                try (InputStream in = h.getInputStream(); OutputStream out = s.openWrite("agenda.apk", 0, -1)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    s.fsync(out);
                }
                Intent st = new Intent(c, UpdateReceiver.class);
                int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                s.commit(PendingIntent.getBroadcast(c, 6, st, fl).getIntentSender());
                s.close();
            } catch (Exception e) {
                new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(c, "Mise à jour impossible : " + e.getMessage(), Toast.LENGTH_LONG).show());
            } finally {
                busy = false;
            }
        }).start();
    }
}
