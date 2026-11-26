package fr.funkyll7.agenda;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Lit UNIQUEMENT les notifications de Revolut et de la Caisse d'Épargne pour noter les paiements.
 * Toutes les autres notifications sont ignorées sans rien garder.
 */
public class BankListener extends NotificationListenerService {
    static final String P = "bank";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) { process(sbn); }

    /** À l'activation (et à chaque redémarrage du service) : relit les notifications bancaires déjà affichées. */
    @Override
    public void onListenerConnected() {
        try {
            StatusBarNotification[] all = getActiveNotifications();
            if (all != null) for (StatusBarNotification sbn : all)
                if (System.currentTimeMillis() - sbn.getPostTime() < 3L * 24 * 3600_000L) process(sbn);
        } catch (Exception ignored) { }
    }

    private void process(StatusBarNotification sbn) {
        try {
            String bank = which(this, sbn.getPackageName());
            if (bank == null) return;
            if (!firstTime(this, sbn.getKey() + "|" + sbn.getPostTime())) return; // déjà traitée
            Notification n = sbn.getNotification();
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle e = n.extras;
            CharSequence t = e.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence x = e.getCharSequence(Notification.EXTRA_BIG_TEXT);
            if (x == null) x = e.getCharSequence(Notification.EXTRA_TEXT);
            handle(this, bank, t == null ? "" : t.toString(), x == null ? "" : x.toString(), sbn.getPostTime());
        } catch (Exception ignored) { }
    }

    /** Vrai la première fois qu'on voit cette notification (mémoire des 200 dernières). */
    static synchronized boolean firstTime(Context c, String id) {
        try {
            SharedPreferences p = c.getSharedPreferences(P, Context.MODE_PRIVATE);
            JSONArray seen = new JSONArray(p.getString("seen", "[]"));
            for (int k = 0; k < seen.length(); k++) if (id.equals(seen.optString(k))) return false;
            seen.put(id);
            while (seen.length() > 200) seen.remove(0);
            p.edit().putString("seen", seen.toString()).apply();
        } catch (Exception ignored) { }
        return true;
    }

    /** "revolut", "ce" ou null. */
    static String which(Context c, String pkg) {
        String p = pkg == null ? "" : pkg.toLowerCase(Locale.ROOT);
        if (p.contains("revolut")) return "revolut";
        if (p.contains("caisseepargne") || p.contains("caisse_epargne") || p.contains("caisse.epargne")) return "ce";
        try {
            PackageManager pm = c.getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            String l = BankParse.norm(String.valueOf(pm.getApplicationLabel(ai)));
            if (l.contains("revolut")) return "revolut";
            if (l.contains("caisse") && l.contains("epargne")) return "ce";
        } catch (Exception ignored) { }
        return null;
    }

    static synchronized void handle(Context c, String bank, String title, String text, long ts) throws Exception {
        SharedPreferences p = c.getSharedPreferences(P, Context.MODE_PRIVATE);
        BankParse.R r = BankParse.parse(title, text);
        String res = r.why;
        if (r.ok) {
            // la même notification peut être reçue plusieurs fois (mise à jour) : on ignore un doublon dans les 3 minutes
            String key = bank + (r.in ? "+" : "-") + Math.round(r.amt * 100) + "|" + (r.label == null ? "" : r.label);
            JSONArray recent = new JSONArray(p.getString("recent", "[]")), keep = new JSONArray();
            boolean dup = false;
            for (int k = 0; k < recent.length(); k++) {
                JSONObject o = recent.getJSONObject(k);
                if (ts - o.getLong("t") > 3 * 60_000L) continue;
                if (key.equals(o.getString("k"))) dup = true;
                keep.put(o);
            }
            if (dup) res = "doublon ignoré";
            else {
                keep.put(new JSONObject().put("k", key).put("t", ts));
                Date d = new Date(ts);
                JSONObject o = new JSONObject()
                        .put("id", bank.charAt(0) + Long.toString(ts, 36) + Math.round(r.amt * 100))
                        .put("bank", bank).put("amt", r.amt).put("in", r.in).put("ts", ts)
                        .put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(d))
                        .put("time", new SimpleDateFormat("HH:mm", Locale.ROOT).format(d));
                if (r.bal != null) o.put("bal", r.bal);
                if (r.label != null) o.put("label", r.label);
                JSONArray q = new JSONArray(p.getString("pending", "[]"));
                q.put(o);
                p.edit().putString("pending", q.toString()).apply();
                res = (r.in ? "reçu : +" : "ajouté : ") + String.format(Locale.FRANCE, "%.2f €", r.amt);
            }
            p.edit().putString("recent", keep.toString()).apply();
        }
        // journal local (15 dernières), pour vérifier la lecture
        JSONArray raw = new JSONArray(p.getString("raw", "[]"));
        raw.put(new JSONObject().put("at", new SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE).format(new Date(ts)))
                .put("bank", bank).put("title", cut(title)).put("text", cut(text)).put("res", res));
        while (raw.length() > 15) raw.remove(0);
        p.edit().putString("raw", raw.toString()).apply();

        if (r.ok && (res.startsWith("ajouté") || res.startsWith("reçu"))) {
            final Context a = c.getApplicationContext();
            new Handler(Looper.getMainLooper()).post(() -> {
                // appli ouverte : elle l'ajoute tout de suite ; sinon, ajout et synchro en arrière-plan
                if (!MainActivity.importNow()) AgendaWidget.background(a, null);
            });
        }
    }

    private static String cut(String s) { return s == null ? "" : s.length() > 300 ? s.substring(0, 300) : s; }

    static String pending(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE).getString("pending", "[]"); }

    static String raw(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE).getString("raw", "[]"); }

    static synchronized void ack(Context c, String ids) {
        try {
            SharedPreferences p = c.getSharedPreferences(P, Context.MODE_PRIVATE);
            JSONArray done = new JSONArray(ids), q = new JSONArray(p.getString("pending", "[]")), keep = new JSONArray();
            for (int k = 0; k < q.length(); k++) {
                JSONObject o = q.getJSONObject(k);
                boolean ok = false;
                for (int j = 0; j < done.length(); j++) if (o.optString("id").equals(done.optString(j))) ok = true;
                if (!ok) keep.put(o);
            }
            p.edit().putString("pending", keep.toString()).apply();
        } catch (Exception ignored) { }
    }

    static boolean enabled(Context c) {
        String s = android.provider.Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(c.getPackageName() + "/");
    }
}
