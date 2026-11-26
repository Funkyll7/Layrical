package fr.funkyll7.agenda;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.widget.Toast;

import java.util.List;

/** Lance YouTube Music, même fermée : reprise de la dernière écoute, ou playlist favorite. */
final class Music {
    static final String YTM = "com.google.android.apps.youtube.music";
    static final String P = "music";

    private Music() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(P, Context.MODE_PRIVATE); }

    static void set(Context c, String url, String wmode) {
        prefs(c).edit().putString("url", url == null ? "" : url.trim()).putString("wmode", "list".equals(wmode) ? "list" : "resume").apply();
        AgendaWidget.refreshAll(c);
    }

    static String url(Context c) { return prefs(c).getString("url", ""); }

    static boolean widgetPlaysList(Context c) { return "list".equals(prefs(c).getString("wmode", "resume")) && !url(c).isEmpty(); }

    static boolean installed(Context c) {
        try { c.getPackageManager().getPackageInfo(YTM, 0); return true; } catch (Exception e) { return false; }
    }

    /** Intent qui ouvre la playlist dans YouTube Music (la lecture démarre). */
    static Intent listIntent(Context c) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url(c))).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (installed(c)) i.setPackage(YTM);
        return i;
    }

    private static MediaController session(Context c) {
        try {
            MediaSessionManager m = c.getSystemService(MediaSessionManager.class);
            List<MediaController> l = m.getActiveSessions(new ComponentName(c, BankListener.class));
            for (MediaController mc : l) if (YTM.equals(mc.getPackageName())) return mc;
        } catch (Exception ignored) { } // lecture des notifications non autorisée : on passe par les touches média
        return null;
    }

    private static boolean playing(Context c) {
        MediaController mc = session(c);
        PlaybackState st = mc == null ? null : mc.getPlaybackState();
        return st != null && st.getState() == PlaybackState.STATE_PLAYING;
    }

    private static void key(Context c, boolean toYtm) {
        for (int a : new int[]{KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP}) {
            KeyEvent k = new KeyEvent(a, KeyEvent.KEYCODE_MEDIA_PLAY);
            if (toYtm) c.sendBroadcast(new Intent(Intent.ACTION_MEDIA_BUTTON).setPackage(YTM).putExtra(Intent.EXTRA_KEY_EVENT, k));
            else c.getSystemService(AudioManager.class).dispatchMediaKeyEvent(k);
        }
    }

    /**
     * Sans YouTube Music Premium, la lecture ne fonctionne que quand YouTube Music est à l'écran.
     * Donc : on ouvre YouTube Music (au premier plan), puis on appuie sur « Lecture » pour reprendre la dernière écoute.
     */
    static void openAndPlay(Context ctx) {
        final Context c = ctx.getApplicationContext();
        if (!installed(c)) { Toast.makeText(c, "YouTube Music n’est pas installée.", Toast.LENGTH_LONG).show(); return; }
        Intent i = c.getPackageManager().getLaunchIntentForPackage(YTM);
        if (i == null) return;
        c.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        final Handler h = new Handler(Looper.getMainLooper());
        h.postDelayed(() -> {
            if (playing(c)) return;
            MediaController mc = session(c);
            if (mc != null) mc.getTransportControls().play();
            else { try { key(c, true); } catch (Exception ignored) { } }
            h.postDelayed(() -> { if (!playing(c)) { try { key(c, false); } catch (Exception ignored) { } } }, 1500);
        }, 2500);
    }

    /** Relance YouTube Music s'il s'est mis en pause (passage par les applis récentes). */
    static void playIfPaused(Context ctx) {
        Context c = ctx.getApplicationContext();
        if (playing(c)) return;
        MediaController mc = session(c);
        try { if (mc != null) mc.getTransportControls().play(); else key(c, true); } catch (Exception ignored) { }
    }

    /** Relance la dernière musique écoutée, quelle que soit l'appli (touche « Lecture » du système). */
    static void playAny(Context ctx) {
        Context c = ctx.getApplicationContext();
        try {
            MediaSessionManager m = c.getSystemService(MediaSessionManager.class);
            List<MediaController> l = m.getActiveSessions(new ComponentName(c, BankListener.class));
            if (!l.isEmpty()) { l.get(0).getTransportControls().play(); return; }
        } catch (Exception ignored) { }
        key(c, false);
    }

    static void playList(Context c) {
        if (url(c).isEmpty()) { Toast.makeText(c, "Ajoute d’abord le lien de ta playlist dans l’appli (🎵).", Toast.LENGTH_LONG).show(); return; }
        try { c.startActivity(listIntent(c)); } catch (Exception e) { Toast.makeText(c, "Lien de playlist illisible.", Toast.LENGTH_LONG).show(); }
    }
}
