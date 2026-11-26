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
            for (AccessibilityWindowInfo w : windows()) {
                Rect r = new Rect();
                w.getBoundsInScreen(r);
                log("[fenêtre écran=" + (android.os.Build.VERSION.SDK_INT >= 30 ? w.getDisplayId() : 0) + " type=" + w.getType() + " " + r.toShortString() + " titre=" + w.getTitle() + "]");
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

    // ---------- déroulé (gestes Honor, comme à la main) ----------

    static final String WAZE = "com.waze";

    /** Package de l'appli affichée dans une fenêtre, ou "". */
    private static String pkg(AccessibilityWindowInfo w) {
        try { AccessibilityNodeInfo r = w.getRoot(); return r == null || r.getPackageName() == null ? "" : r.getPackageName().toString(); }
        catch (Exception e) { return ""; }
    }

    /** Toutes les fenêtres, sur tous les écrans (Honor peut mettre les fenêtres flottantes à part). */
    private static List<AccessibilityWindowInfo> windows() {
        List<AccessibilityWindowInfo> l = new ArrayList<>();
        Split s = me;
        if (s == null) return l;
        try {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.util.SparseArray<List<AccessibilityWindowInfo>> a = s.getWindowsOnAllDisplays();
                for (int i = 0; i < a.size(); i++) l.addAll(a.valueAt(i));
            } else l.addAll(s.getWindows());
        } catch (Exception e) { try { l.addAll(s.getWindows()); } catch (Exception ignored) { } }
        return l;
    }

    /** Fenêtre d'un package donné (bornes dans r), ou false. */
    private static boolean windowOf(String p, Rect r) {
        for (AccessibilityWindowInfo w : windows()) {
            if (p.equals(pkg(w))) { w.getBoundsInScreen(r); return true; }
        }
        return false;
    }

    /** Attend qu'une appli soit à l'écran (vérifie toutes les ½ s), puis lance la suite. */
    private static void waitFor(Handler h, String p, long left, Runnable ok, Runnable ko) {
        if (windowOf(p, new Rect())) { ok.run(); return; }
        if (left <= 0) { ko.run(); return; }
        h.postDelayed(() -> waitFor(h, p, left - 500, ok, ko), 500);
    }

    /**
     * 1. Waze sur l'adresse (on attend qu'il ait chargé l'itinéraire)
     * 2. applis récentes → petit carré « fenêtre flottante » de la carte Waze
     * 3. YouTube Music s'ouvre derrière et lance la musique (Waze flotte devant)
     * 4. la fenêtre Waze est glissée tout en bas → écran partagé : YouTube Music en haut, Waze en bas
     * 5. barre du milieu à ¼, puis relance de la lecture si besoin
     */
    static void go(Context ctx, String wazeUrl, boolean bubble) {
        final Context c = ctx.getApplicationContext();
        final Handler h = new Handler(Looper.getMainLooper());
        LOG.setLength(0);
        log("Agenda écran partagé v7 · " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL + " · Android " + android.os.Build.VERSION.RELEASE);
        if (bubble && Bubble.canShow(c)) Bubble.show(c);

        // 1. Waze
        if (!openWaze(c, wazeUrl, false)) return;
        waitFor(h, WAZE, 12000, () -> {
            log("1. Waze à l'écran, attente de l'itinéraire");
            // 2. applis récentes → fenêtre flottante sur Waze
            h.postDelayed(() -> {
                Split s = me;
                if (s == null) { log("service coupé"); fail(c, wazeUrl); return; }
                s.performGlobalAction(GLOBAL_ACTION_RECENTS);
                h.postDelayed(() -> {
                    dump("applis récentes");
                    AccessibilityNodeInfo f = floatButton(all(), "Waze");
                    if (f == null || !click(f)) { log("2. carré fenêtre flottante de Waze introuvable"); fail(c, wazeUrl); return; }
                    log("2. Waze en fenêtre flottante");
                    // 3. YouTube Music derrière
                    h.postDelayed(() -> {
                        if (Music.widgetPlaysList(c)) Music.playList(c); else Music.openAndPlay(c);
                        log("3. YouTube Music ouvert");
                        // 4. Waze glissé tout en bas
                        h.postDelayed(() -> dragWazeDown(c, h, wazeUrl), 3500);
                    }, 1500);
                }, 1300);
            }, 4500);
        }, () -> { log("1. Waze n'est pas apparu"); fail(c, wazeUrl); });
    }

    /** Petit carré « ouvrir dans une fenêtre flottante » de la carte d'une appli, dans les applis récentes. */
    private static AccessibilityNodeInfo floatButton(List<AccessibilityNodeInfo> l, String app) {
        for (AccessibilityNodeInfo n : l) {
            if (!label(n).toLowerCase().contains("flottante") && !label(n).toLowerCase().contains("floating")) continue;
            AccessibilityNodeInfo card = n.getParent();
            if (card == null) continue;
            for (int i = 0; i < card.getChildCount(); i++) {
                AccessibilityNodeInfo k = card.getChild(i);
                if (k != null && k != n && label(k).contains(app)) return n;
            }
        }
        return null;
    }

    static final String YTM = Music.YTM;
    /** Poignée (barre bleue) de la fenêtre flottante Waze, mesurée sur l'Honor : milieu, à 23 % de la hauteur. */
    private static final float[] HANDLE = {0.230f, 0.230f, 0.230f};

    /**
     * En ouvrant YouTube Music, Honor réduit Waze en bulle (à droite de l'écran) :
     * on touche la bulle pour le remettre en fenêtre flottante, puis on le glisse en bas.
     */
    private static void dragWazeDown(Context c, Handler h, String wazeUrl) {
        dump("Waze flottant + YouTube Music");
        Rect b = wazeBubble();
        if (b != null) {
            log("4. Waze réduit en bulle " + b.toShortString() + " → on la touche");
            tap(Math.min(b.centerX(), screenW() - 20), b.centerY());
            h.postDelayed(() -> { dump("Waze sorti de la bulle"); tryDrag(c, h, wazeUrl, 0); }, 1500);
        } else tryDrag(c, h, wazeUrl, 0);
    }

    private static int screenW() { DisplayMetrics dm = metrics(); return dm == null ? 1080 : dm.widthPixels; }

    private static DisplayMetrics metrics() {
        Split s = me;
        if (s == null) return null;
        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) s.getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        return dm;
    }

    /** Petite fenêtre système (≈ 150 px), hors barre du haut et hors bulle 🎵 d'Agenda : la bulle Waze. */
    private static Rect wazeBubble() {
        Split s = me;
        if (s == null) return null;
        for (AccessibilityWindowInfo w : windows()) {
            if (w.getType() != AccessibilityWindowInfo.TYPE_SYSTEM) continue;
            if (s.getPackageName().equals(pkg(w))) continue;
            Rect r = new Rect();
            w.getBoundsInScreen(r);
            if (r.top > 150 && r.width() <= 350 && r.height() <= 350 && r.width() > 40) return r;
        }
        return null;
    }

    /** Écran partagé obtenu : YouTube Music ne prend plus tout l'écran. */
    private static boolean splitDone(DisplayMetrics dm) {
        Rect y = new Rect();
        return windowOf(YTM, y) && y.height() < dm.heightPixels * 0.85f;
    }

    private static void tryDrag(Context c, Handler h, String wazeUrl, int n) {
        Split s = me;
        DisplayMetrics dm = metrics();
        if (s == null || dm == null) { fail(c, wazeUrl); return; }
        if (splitDone(dm)) { log("4. écran partagé obtenu (essai " + n + ")"); finish(c, h, 300); return; }
        if (n >= HANDLE.length) { log("4. pas d'écran partagé après " + n + " essais"); dump("échec du glissement"); saveLog(c); finish(c, h, 300); return; }
        Rect r = new Rect();
        boolean seen = windowOf(WAZE, r) && r.height() < dm.heightPixels * 0.9f;
        // Honor : il faut RESTER APPUYÉ sur la poignée (la fenêtre rétrécit) avant de glisser,
        // sinon la fenêtre est juste déplacée. Puis descente lente et appui maintenu en bas
        // jusqu'à « Relâcher pour ajouter une application ».
        float x = seen ? r.centerX() : dm.widthPixels / 2f;
        float y = seen ? r.top + dm.density * 14 : dm.heightPixels * HANDLE[n];
        y = Math.min(y, dm.heightPixels - dm.density * 30);   // fenêtre garée en bas : on reprend sa poignée
        // Dans la vidéo, la fenêtre doit disparaître ENTIÈREMENT sous l'écran (barre du haut comprise)
        // avant que « Relâcher pour ajouter une application » apparaisse : le doigt virtuel va donc
        // au-delà du bord (Android n'interdit que les coordonnées négatives).
        float to = dm.heightPixels + 300 + 150 * n;
        // 3 manières : lente avec appui long, jet rapide, puis reprise de la fenêtre déjà garée en bas
        long hold = n == 1 ? 150 : 1000, move = n == 1 ? 300 : 1500, end = 1500;
        log("4. essai " + (n + 1) + (n == 1 ? " (jet rapide)" : n == 2 ? " (reprise en bas)" : " (lent)") + (seen ? ", Waze " + r.toShortString() : ", position mesurée")
                + " : appui " + hold + " ms sur " + (int) x + "," + (int) y + " → " + (int) to + " (écran " + dm.widthPixels + "×" + dm.heightPixels + ")");
        drag(s, x, y, to, hold, move, end);
        h.postDelayed(() -> tryDrag(c, h, wazeUrl, n + 1), hold + move + end + 1800);
    }

    /**
     * Appui maintenu, glissement vertical, puis on reste appuyé à l'arrivée avant de lâcher
     * (Honor affiche « Relâcher pour ajouter une application » quand la fenêtre touche le bas).
     */
    private static void drag(Split s, float x, float from, float to, long hold, long move) { drag(s, x, from, to, hold, move, 700); }

    private static void drag(Split s, float x, float from, float to, long hold, long move, long endHold) {
        Path p = new Path();
        p.moveTo(x, from);
        final GestureDescription.StrokeDescription press = new GestureDescription.StrokeDescription(p, 0, hold, true);
        try {
            s.dispatchGesture(new GestureDescription.Builder().addStroke(press).build(), new GestureResultCallback() {
                @Override public void onCompleted(GestureDescription g) {
                    Split s2 = me;
                    if (s2 == null) return;
                    Path m = new Path();
                    m.moveTo(x, from);
                    m.lineTo(x, to);
                    final GestureDescription.StrokeDescription slide = press.continueStroke(m, 0, move, true);
                    s2.dispatchGesture(new GestureDescription.Builder().addStroke(slide).build(), new GestureResultCallback() {
                        @Override public void onCompleted(GestureDescription g2) {
                            Split s3 = me;
                            if (s3 == null) return;
                            Path e = new Path();
                            e.moveTo(x, to);
                            for (int k = 0; k < 3; k++) { e.lineTo(x + 6, to - 35); e.lineTo(x, to); }
                            boolean ok = s3.dispatchGesture(new GestureDescription.Builder()
                                    .addStroke(slide.continueStroke(e, 0, endHold, false)).build(), new GestureResultCallback() {
                                @Override public void onCompleted(GestureDescription g3) { log("   geste terminé"); }
                                @Override public void onCancelled(GestureDescription g3) { log("   fin du geste annulée"); }
                            }, null);
                            if (!ok) log("   fin du geste refusée");
                        }
                        @Override public void onCancelled(GestureDescription g2) { log("   glissement annulé"); }
                    }, null);
                }
            }, null);
        } catch (Exception e) { log("glissement impossible : " + e); }
    }

    private static boolean openWaze(Context c, String url, boolean adjacent) {
        Context from = me != null ? me : c;
        int f = Intent.FLAG_ACTIVITY_NEW_TASK | (adjacent ? Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT : 0);
        // lien natif de Waze (ouvre directement l'itinéraire), sinon le lien web
        String q = url.contains("?") ? url.substring(url.indexOf('?')) : "";
        try {
            from.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("waze://" + q)).setPackage(WAZE).addFlags(f));
            return true;
        } catch (Exception ignored) { }
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
        h.postDelayed(() -> { noThanks(); Music.playIfPaused(c); dump("fin"); saveLog(c); }, wait + 4000);
    }

    /** Ferme la proposition « Music Premium » de YouTube Music (bouton « Non, merci »). */
    private static void noThanks() {
        for (AccessibilityNodeInfo n : all()) {
            String l = label(n).trim();
            if (l.equalsIgnoreCase("Non, merci") || l.equalsIgnoreCase("No thanks")) { click(n); log("pub Premium fermée"); return; }
        }
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

        drag(s, x, from, to, 400, 700);
    }
}
