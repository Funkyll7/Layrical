package fr.funkyll7.agenda;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
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
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * Waze + YouTube Music en écran partagé : YouTube Music en haut (¼ de l'écran), Waze en bas (¾).
 * Sans YouTube Music Premium, la musique ne joue que si YouTube Music est visible : l'écran partagé
 * la garde à l'écran pendant le trajet.
 *
 * Android ne laisse pas une appli ouvrir l'écran partagé toute seule : il faut un service
 * d'accessibilité (à activer une fois dans Réglages → Accessibilité → Agenda : écran partagé).
 * Il ne lit rien et ne sert qu'à ça : ouvrir l'écran partagé et déplacer la barre du milieu.
 */
public class Split extends AccessibilityService {
    static Split me;
    /** Part de l'écran laissée à YouTube Music, en haut. */
    static final float TOP = 0.25f;

    @Override protected void onServiceConnected() { me = this; }
    @Override public boolean onUnbind(Intent i) { me = null; return super.onUnbind(i); }
    @Override public void onDestroy() { me = null; super.onDestroy(); }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) { }
    @Override public void onInterrupt() { }

    static boolean ready() { return me != null; }

    static void openSettings(Context c) {
        try { c.startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
    }

    /** 1) YouTube Music plein écran + lecture  2) écran partagé  3) Waze en bas  4) barre du milieu à ¼. */
    static void go(Context ctx, String wazeUrl, boolean bubble) {
        final Context c = ctx.getApplicationContext();
        final Handler h = new Handler(Looper.getMainLooper());
        if (bubble && Bubble.canShow(c)) Bubble.show(c);
        if (Music.widgetPlaysList(c)) Music.playList(c); else Music.openAndPlay(c);
        h.postDelayed(() -> {
            Split s = me;
            boolean split = s != null && s.performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN);
            h.postDelayed(() -> {
                Context from = me != null ? me : c;
                try {
                    from.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(wazeUrl))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT));
                } catch (Exception e) {
                    Toast.makeText(c, "Waze n’a pas pu s’ouvrir.", Toast.LENGTH_LONG).show();
                    return;
                }
                if (!split) Toast.makeText(c, "Écran partagé refusé par le téléphone : Waze s’ouvre en plein écran.", Toast.LENGTH_LONG).show();
                h.postDelayed(Split::resize, 1800);
                h.postDelayed(Split::resize, 3600); // seconde tentative si l'animation n'était pas finie
            }, 1600);
        }, 1800);
    }

    /** Fait glisser la barre du milieu pour laisser ¼ de l'écran à l'appli du haut. */
    static void resize() {
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
        if (apps.size() < 2) return; // pas (encore) en écran partagé
        Rect top = apps.get(0), bot = apps.get(0);
        for (Rect r : apps) { if (r.top < top.top) top = r; if (r.top > bot.top) bot = r; }
        if (top == bot || bot.top < top.bottom) return;

        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) s.getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        float x = dm.widthPixels / 2f;
        float from = (top.bottom + bot.top) / 2f;
        float to = dm.heightPixels * TOP;
        if (Math.abs(from - to) < dm.heightPixels * 0.03f) return; // déjà en place

        Path p = new Path();
        p.moveTo(x, from);
        p.lineTo(x, from - 1);   // petit appui sur la barre avant de la tirer
        p.lineTo(x, to);
        try {
            s.dispatchGesture(new GestureDescription.Builder()
                    .addStroke(new GestureDescription.StrokeDescription(p, 0, 900)).build(), null, null);
        } catch (Exception ignored) { }
    }
}
