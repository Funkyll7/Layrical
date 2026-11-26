package fr.funkyll7.agenda;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Réglages communs des WebView et passerelle « AgendaNative » appelée par le site. */
final class Web {
    static final String URL = "https://funkyll7.github.io/Layrical/";
    static final String PREFS = "widget";

    private Web() {}

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    static void setup(WebView w, Context c, Runnable onDone) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        w.addJavascriptInterface(new Bridge(c.getApplicationContext(), onDone), "AgendaNative");
    }

    static final class Bridge {
        private final Context c;
        private final Runnable onDone;

        Bridge(Context c, Runnable onDone) { this.c = c; this.onDone = onDone; }

        /** Le site envoie son résumé du jour (JSON) ; on le garde pour le widget. */
        @JavascriptInterface
        public void update(String json) {
            if (json == null || json.length() > 20000) return;
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString("data", json)
                    .putLong("t", System.currentTimeMillis())
                    .apply();
            new Handler(Looper.getMainLooper()).post(() -> AgendaWidget.refreshAll(c));
        }

        /** Liste des notifications à programmer (JSON : at, title, body, tag). */
        @JavascriptInterface
        public void schedule(String json) {
            if (json == null || json.length() > 200000) return;
            new Handler(Looper.getMainLooper()).post(() -> Notif.save(c, json));
        }

        @JavascriptInterface
        public boolean canNotify() { return Notif.enabled(c); }

        @JavascriptInterface
        public void test() {
            new Handler(Looper.getMainLooper()).post(() -> Notif.show(c, "🔔 Test", "Les rappels arrivent bien sur ce téléphone.", "test"));
        }

        @JavascriptInterface
        public void openSettings() {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        }

        /** Paiements lus dans les notifications, en attente d'être ajoutés à l'agenda (JSON). */
        @JavascriptInterface
        public String pending() { return BankListener.pending(c); }

        @JavascriptInterface
        public void ack(String ids) { BankListener.ack(c, ids); }

        @JavascriptInterface
        public String raw() { return BankListener.raw(c); }

        @JavascriptInterface
        public boolean canListen() { return BankListener.enabled(c); }

        @JavascriptInterface
        public void openListenerSettings() {
            c.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }

        @JavascriptInterface
        public String version() { return "1.0." + Updater.current(c); }

        /** 🎵 « resume » : reprendre la dernière écoute ; « list » : lancer la playlist favorite. */
        @JavascriptInterface
        public void musicPlay(String mode) {
            new Handler(Looper.getMainLooper()).post(() -> { if ("list".equals(mode)) Music.playList(c); else Music.openAndPlay(c); });
        }

        @JavascriptInterface
        public void musicSet(String url, String wmode) { Music.set(c, url, wmode); }

        @JavascriptInterface
        public boolean musicInstalled() { return Music.installed(c); }

        /** Bulle de contrôle : vrai si affichée ; sinon ouvre le réglage « afficher par-dessus les autres applis ». */
        @JavascriptInterface
        public boolean bubbleShow() {
            if (!Bubble.canShow(c)) {
                c.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                return false;
            }
            new Handler(Looper.getMainLooper()).post(() -> Bubble.show(c));
            return true;
        }

        @JavascriptInterface
        public void bubbleHide() { Bubble.hide(c); }

        @JavascriptInterface
        public boolean bubbleOn() { return Bubble.on; }

        @JavascriptInterface
        public boolean canOverlay() { return Bubble.canShow(c); }

        /** Waze + musique : relance la musique, affiche la bulle (si autorisée), puis ouvre Waze sur l'adresse. */
        @JavascriptInterface
        public void wazeMusic(String url, boolean bubble) {
            Handler h = new Handler(Looper.getMainLooper());
            h.post(() -> {
                Music.playAny(c);
                if (bubble && Bubble.canShow(c)) Bubble.show(c);
                h.postDelayed(() -> {
                    try { c.startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
                }, 700);
            });
        }

        /** Écran partagé Waze + musique : vrai si le service d'accessibilité est activé. */
        @JavascriptInterface
        public boolean splitReady() { return Split.ready(); }

        @JavascriptInterface
        public void splitSettings() { Split.openSettings(c); }

        /** Diagnostic du dernier essai d'écran partagé (vide s'il n'y en a pas). */
        @JavascriptInterface
        public boolean splitHasDebug() { return !Split.debug(c).isEmpty(); }

        @JavascriptInterface
        public void splitCopyDebug() { new Handler(Looper.getMainLooper()).post(() -> Split.copyDebug(c)); }

        /** YouTube Music en haut (¼), Waze en bas (¾). */
        @JavascriptInterface
        public void wazeSplit(String url, boolean bubble) {
            new Handler(Looper.getMainLooper()).post(() -> Split.go(c, url, bubble));
        }

        /** Fin de la mise à jour en arrière-plan. */
        @JavascriptInterface
        public void done() {
            if (onDone != null) new Handler(Looper.getMainLooper()).post(onDone);
        }
    }
}
