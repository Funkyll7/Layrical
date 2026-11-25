package fr.funkyll7.agenda;

import android.annotation.SuppressLint;
import android.content.Context;
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

        /** Fin de la mise à jour en arrière-plan. */
        @JavascriptInterface
        public void done() {
            if (onDone != null) new Handler(Looper.getMainLooper()).post(onDone);
        }
    }
}
