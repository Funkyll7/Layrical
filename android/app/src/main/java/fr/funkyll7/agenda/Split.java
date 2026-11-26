package fr.funkyll7.agenda;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Waze + YouTube Music en écran partagé : YouTube Music en haut (¼ de l'écran), Waze en bas (¾).
 * Sans YouTube Music Premium, la musique ne joue que si YouTube Music est visible : l'écran partagé
 * la garde à l'écran pendant le trajet.
 *
 * Android ne laisse pas une appli ouvrir l'écran partagé toute seule : il faut un service
 * d'accessibilité (à activer une fois dans Réglages → Accessibilité → Agenda : écran partagé).
 *
 * Sur Honor (MagicOS), l'action système « écran partagé » est refusée : on fait donc comme à la main.
 *   1. Waze s'ouvre sur l'adresse (il sera dans les applis récentes)
 *   2. YouTube Music s'ouvre et lance la musique
 *   3. applis récentes → bouton « écran partagé » de la carte YouTube Music → YouTube Music passe en haut
 *   4. carte Waze → Waze en bas
 *   5. la barre du milieu est glissée à ¼ de la hauteur, puis la lecture est relancée si besoin
 * Chaque étape est notée dans un diagnostic (copiable depuis 🎵) pour ajuster si un téléphone fait autrement.
 */
public class Split extends AccessibilityService {
    static Split me;
    /** Part de l'écran laissée à YouTube Music, en haut. */
    static final float TOP = 0.25f;
    private static final Pattern SPLIT = Pattern.compile("(?i)(écran partagé|ecran partage|partager l.écran|split|multi.?fen|multi.?window)");
    private static final StringBuilder LOG = new StringBuilder();

    @Override protected void onServiceConnected() { me = this; }
    @Override public boolean onUnbind(Intent i) { me = null; return super.onUnbind(i); }
    @Override public void onDestroy() { me = null; super.onDestroy(); }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) { }
    @Override public void onInterrupt() { }

    static boolean ready() { return me != null; }

    static void openSettings(Context c) {
        try { c.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
    }

    // ---------- diagnostic ----------

    private static void log(String s) { LOG.append(s).append('\n'); }

    static String debug(Context c) { return c.getSharedPreferences(Web.PREFS, MODE_PRIVATE).getString("split_dbg", ""); }

    private static void saveLog(Context c) {
        String s = LOG.length() > 60000 ? LOG.substring(0, 60000) : LOG.toString();
        c.getSharedPreferences(Web.PREFS, MODE_PRIVATE).edit().putString("split_dbg", s).apply();
    }

    static void copyDebug(Context c) {
        ClipboardManager cm = c.getSystemService(ClipboardManager.class);
        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Diagnostic écran partagé", debug(c)));
        Toast.makeText(c, "Diagnostic copié : colle-le dans la conversation.", Toast.LENGTH_LONG).show();
    }

    /** Liste ce qui est à l'écran (textes, descriptions, identifiants, positions) pour ajuster les étapes. */
    private static void dump(String title) {
        Split s = me;
        log("— " + title + " —");
        if (s == null) { log("service absent"); return; }
        try {
            for (AccessibilityWindowInfo w : s.getWindows()) {
                Rect r = new Rect();
                w.getBoundsInScreen(r);
                log("[fenêtre type=" + w.getType() + " " + r.toShortString() + " titre=" + w.getTitle() + "]");
                AccessibilityNodeInfo root = w.getRoot();
                if (root != null) dumpNode(root, 1, new int[]{0});
            }
        } catch (Exception e) { log("erreur " + e); }
    }

    private static void dumpNode(AccessibilityNodeInfo n, int depth, int[] count) {
        if (n == null || count[0]++ > 350 || depth > 30) return;
        CharSequence t = n.getText(), d = n.getContentDescription();
        String id = n.getViewIdResourceName();
        Rect r = new Rect();
        n.getBoundsInScreen(r);
        if (t != null || d != null || id != null || n.isClickable()) {
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < depth && i < 12; i++) b.append(' ');
            String cls = String.valueOf(n.getClassName());
            b.append(cls.substring(cls.lastIndexOf('.') + 1));
            if (t != null) b.append(" t=\"").append(t).append('"');
            if (d != null) b.append(" d=\"").append(d).append('"');
            if (id != null) b.append(" id=").append(id.substring(id.indexOf('/') + 1));
            if (n.isClickable()) b.append(" [clic]");
            b.append(' ').append(r.toShortString());
            log(b.toString());
        }
        for (int i = 0; i < n.getChildCount(); i++) dumpNode(n.getChild(i), depth + 1, count);
    }

    // ---------- recherche et clic ----------

    private static String label(AccessibilityNodeInfo n) {
        CharSequence t = n.getText(), d = n.getContentDescription();
        return (t == null ? "" : t) + " " + (d == null ? "" : d);
    }

    private static void collect(AccessibilityNodeInfo n, List<AccessibilityNodeInfo> out, int depth) {
        if (n == null || depth > 30) return;
        out.add(n);
        for (int i = 0; i < n.getChildCount(); i++) collect(n.getChild(i), out, depth + 1);
    }

    private static List<AccessibilityNodeInfo> all() {
        List<AccessibilityNodeInfo> l = new ArrayList<>();
        Split s = me;
        if (s == null) return l;
        try {
            for (AccessibilityWindowInfo w : s.getWindows()) collect(w.getRoot(), l, 0);
        } catch (Exception ignored) { }
        return l;
    }

    private static AccessibilityNodeInfo find(List<AccessibilityNodeInfo> l, String word) {
        String low = word.toLowerCase();
        for (AccessibilityNodeInfo n : l) if (label(n).toLowerCase().contains(low)) return n;
        return null;
    }

    /** Bouton « écran partagé » le plus proche de la carte YouTube Music. */
    private static AccessibilityNodeInfo splitButton(List<AccessibilityNodeInfo> l) {
        AccessibilityNodeInfo ytm = find(l, "YouTube Music");
        Rect yr = new Rect();
        if (ytm != null) ytm.getBoundsInScreen(yr);
        AccessibilityNodeInfo best = null;
        long bd = Long.MAX_VALUE;
        for (AccessibilityNodeInfo n : l) {
            String lb = label(n);
            String id = n.getViewIdResourceName();
            if (!SPLIT.matcher(lb).find() && !(id != null && SPLIT.matcher(id).find())) continue;
            if (lb.contains("YouTube Music")) continue;
            Rect r = new Rect();
            n.getBoundsInScreen(r);
            long dx = r.centerX() - yr.centerX(), dy = r.centerY() - yr.centerY();
            long dd = ytm == null ? 0 : dx * dx + dy * dy;
            if (dd < bd) { bd = dd; best = n; }
        }
        return best;
    }

    /** Clic sur l'élément (ou son premier parent cliquable), sinon appui à l'endroit où il est affiché. */
    private static boolean click(AccessibilityNodeInfo n) {
        if (n == null) return false;
        Rect r = new Rect();
        n.getBoundsInScreen(r);
        for (AccessibilityNodeInfo p = n; p != null; p = p.getParent()) {
            if (p.isClickable() && p.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
        }
        return tap(r.centerX(), r.centerY());
    }

    private static boolean tap(float x, float y) {
        Split s = me;
        if (s == null) return false;
        Path p = new Path();
        p.moveTo(x, y);
        return s.dispatchGesture(new GestureDescription.Builder()
                .addStroke(new GestureDescription.StrokeDescription(p, 0, 60)).build(), null, null);
    }

    // ---------- déroulé ----------

    static void go(Context ctx, String wazeUrl, boolean bubble) {
        final Context c = ctx.getApplicationContext();
        final Handler h = new Handler(Looper.getMainLooper());
        LOG.setLength(0);
        log("Agenda écran partagé · " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL + " · Android " + android.os.Build.VERSION.RELEASE);
        if (bubble && Bubble.canShow(c)) Bubble.show(c);

        // 1. Waze sur l'adresse
        if (!openWaze(c, wazeUrl, false)) return;
        // 2. YouTube Music + lecture
        h.postDelayed(() -> {
            if (Music.widgetPlaysList(c)) Music.playList(c); else Music.openAndPlay(c);
            log("1-2. Waze puis YouTube Music ouverts");
        }, 2500);
        // 3. écran partagé
        h.postDelayed(() -> {
            Split s = me;
            if (s == null) { log("service coupé"); fail(c, wazeUrl); return; }
            if (s.performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)) {
                log("3. action système écran partagé : acceptée");
                h.postDelayed(() -> { openWaze(c, wazeUrl, true); finish(c, h, 1800); }, 1500);
                return;
            }
            log("3. action système écran partagé : refusée → applis récentes");
            s.performGlobalAction(GLOBAL_ACTION_RECENTS);
            h.postDelayed(() -> {
                dump("applis récentes");
                AccessibilityNodeInfo b = splitButton(all());
                if (b == null || !click(b)) { log("bouton écran partagé introuvable"); fail(c, wazeUrl); return; }
                log("3. bouton écran partagé touché : " + label(b).trim());
                // 4. Waze en bas
                h.postDelayed(() -> {
                    dump("après écran partagé");
                    List<AccessibilityNodeInfo> l = all();
                    AccessibilityNodeInfo w = null;
                    for (AccessibilityNodeInfo n : l) {
                        String lb = label(n);
                        if (lb.contains("Waze") && !lb.contains("YouTube")) { w = n; break; }
                    }
                    if (w != null && click(w)) log("4. carte Waze touchée");
                    else { log("4. carte Waze introuvable → Waze ouvert à côté"); openWaze(c, wazeUrl, true); }
                    finish(c, h, 1800);
                }, 1600);
            }, 1200);
        }, 6000);
    }

    private static boolean openWaze(Context c, String url, boolean adjacent) {
        Context from = me != null ? me : c;
        int f = Intent.FLAG_ACTIVITY_NEW_TASK | (adjacent ? Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT : 0);
        try {
            from.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(f));
            return true;
        } catch (Exception e) {
            Toast.makeText(c, "Waze n’a pas pu s’ouvrir.", Toast.LENGTH_LONG).show();
            return false;
        }
    }

    /** Échec : Waze en plein écran comme avant, diagnostic gardé. */
    private static void fail(Context c, String url) {
        saveLog(c);
        Split s = me;
        if (s != null) s.performGlobalAction(GLOBAL_ACTION_BACK);
        openWaze(c, url, false);
        Toast.makeText(c, "Écran partagé impossible : Waze en plein écran. Diagnostic à copier dans 🎵.", Toast.LENGTH_LONG).show();
    }

    /** 5. barre du milieu à ¼, puis relance de la lecture si YouTube Music s'est mis en pause. */
    private static void finish(Context c, Handler h, long wait) {
        h.postDelayed(() -> resize(c), wait);
        h.postDelayed(() -> resize(c), wait + 2200);
        h.postDelayed(() -> { Music.playIfPaused(c); dump("fin"); saveLog(c); }, wait + 4000);
    }

    /** Fait glisser la barre du milieu (appui long puis glissement) pour laisser ¼ de l'écran à l'appli du haut. */
    static void resize(Context c) {
        Split s = me;
        if (s == null) return;
        List<Rect> apps = new ArrayList<>();
        try {
            for (AccessibilityWindowInfo w : s.getWindows()) {
                if (w.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
                Rect r = new Rect();
                w.getBoundsInScreen(r);
                if (r.width() > 0 && r.height() > 0) apps.add(r);
            }
        } catch (Exception ignored) { }
        if (apps.size() < 2) { log("5. une seule fenêtre : pas d'écran partagé"); return; }
        Rect top = apps.get(0), bot = apps.get(0);
        for (Rect r : apps) { if (r.top < top.top) top = r; if (r.top > bot.top) bot = r; }
        if (top == bot || bot.top < top.bottom) { log("5. fenêtres côte à côte, pas haut/bas"); return; }

        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) s.getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        final float x = dm.widthPixels / 2f;
        final float from = (top.bottom + bot.top) / 2f;
        final float to = dm.heightPixels * TOP;
        log("5. barre à " + (int) from + " px → " + (int) to + " px (haut " + top.toShortString() + ", bas " + bot.toShortString() + ")");
        if (Math.abs(from - to) < dm.heightPixels * 0.03f) return;

        Path hold = new Path();
        hold.moveTo(x, from);
        final GestureDescription.StrokeDescription press = new GestureDescription.StrokeDescription(hold, 0, 350, true);
        try {
            s.dispatchGesture(new GestureDescription.Builder().addStroke(press).build(), new GestureResultCallback() {
                @Override public void onCompleted(GestureDescription g) {
                    Split s2 = me;
                    if (s2 == null) return;
                    Path move = new Path();
                    move.moveTo(x, from);
                    move.lineTo(x, to);
                    s2.dispatchGesture(new GestureDescription.Builder()
                            .addStroke(press.continueStroke(move, 0, 700, false)).build(), null, null);
                }
            }, null);
        } catch (Exception e) { log("5. glissement impossible : " + e); }
    }
}
