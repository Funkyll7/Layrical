package fr.funkyll7.agenda;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/** Widget « Aujourd'hui » : événements du jour, demain, et budget. */
public class AgendaWidget extends AppWidgetProvider {
    static final String REFRESH = "fr.funkyll7.agenda.REFRESH";
    private static boolean running = false;

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        refreshAll(c);
        // toutes les 30 min environ : on recalcule avec les dernières données
        background(c, goAsync());
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (REFRESH.equals(i.getAction())) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
            v.setTextViewText(R.id.refresh, "…");
            AppWidgetManager.getInstance(c).partiallyUpdateAppWidget(ids(c), v);
            background(c, goAsync());
            return;
        }
        super.onReceive(c, i);
    }

    static int[] ids(Context c) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, AgendaWidget.class));
    }

    /** Charge le site sans l'afficher : il se synchronise avec GitHub puis renvoie son résumé. */
    static void background(Context ctx, PendingResult pr) {
        final Context a = ctx.getApplicationContext();
        final Handler h = new Handler(Looper.getMainLooper());
        if (running) { if (pr != null) pr.finish(); return; }
        running = true;
        h.post(() -> {
            final WebView[] w = new WebView[1];
            final boolean[] fin = {false};
            final Runnable end = () -> {
                if (fin[0]) return;
                fin[0] = true;
                running = false;
                try { if (w[0] != null) { w[0].stopLoading(); w[0].destroy(); } } catch (Exception ignored) { }
                refreshAll(a);
                if (pr != null) pr.finish();
            };
            try {
                w[0] = new WebView(a);
                Web.setup(w[0], a, end);
                w[0].loadUrl(Web.URL + "?bg=1");
            } catch (Throwable t) {
                end.run();
                return;
            }
            h.postDelayed(end, 25000);
        });
    }

    static void refreshAll(Context c) {
        int[] ids = ids(c);
        if (ids.length == 0) return;
        AppWidgetManager.getInstance(c).updateAppWidget(ids, views(c));
    }

    private static String lines(JSONArray a, String sep, int max) {
        if (a == null || a.length() == 0) return "";
        StringBuilder b = new StringBuilder();
        int n = Math.min(a.length(), max);
        for (int k = 0; k < n; k++) { if (k > 0) b.append(sep); b.append(a.optString(k)); }
        if (a.length() > max) b.append(sep).append("… et ").append(a.length() - max).append(" autre(s)");
        return b.toString();
    }

    private static String str(JSONObject o, String k) {
        return o.isNull(k) ? null : o.optString(k, null);
    }

    static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(c, 0, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        Intent rf = new Intent(c, AgendaWidget.class).setAction(REFRESH);
        v.setOnClickPendingIntent(R.id.refresh, PendingIntent.getBroadcast(c, 1, rf,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        v.setTextViewText(R.id.refresh, "↻");
        SharedPreferences p = c.getSharedPreferences(Web.PREFS, Context.MODE_PRIVATE);
        String raw = p.getString("data", null);
        if (raw == null) {
            v.setTextViewText(R.id.title, "Agenda");
            v.setTextViewText(R.id.bal, "");
            v.setTextViewText(R.id.today, "Ouvre l’appli une fois pour remplir le widget.");
            v.setTextViewText(R.id.tomorrow, "");
            v.setTextViewText(R.id.budget, "");
            return v;
        }
        try {
            JSONObject all = new JSONObject(raw), o = all.optJSONObject("w");
            boolean old = System.currentTimeMillis() - p.getLong("t", 0) > 3L * 3600 * 1000;
            if (o == null) { // ancienne version du site : on affiche l'essentiel
                v.setTextViewText(R.id.title, all.optString("date"));
                v.setTextViewText(R.id.bal, all.isNull("bal") ? "" : all.optString("bal"));
                v.setTextViewText(R.id.today, lines(all.optJSONArray("today"), "\n", 3));
                v.setTextViewText(R.id.tomorrow, "");
                v.setTextViewText(R.id.budget, "");
                return v;
            }
            v.setTextViewText(R.id.title, o.optString("d").toUpperCase(java.util.Locale.FRANCE) + (old ? "  ·  À ACTUALISER" : ""));
            v.setTextViewText(R.id.bal, o.optString("bal"));
            v.setTextColor(R.id.bal, o.optBoolean("neg") ? Color.parseColor("#FF8A80") : Color.WHITE);
            String t = lines(o.optJSONArray("t"), "\n", 3);
            int more = o.optInt("tx");
            v.setTextViewText(R.id.today, t.isEmpty() ? "Rien de prévu aujourd’hui" : t + (more > 0 ? "\n+ " + more + " autre" + (more > 1 ? "s" : "") : ""));
            String tm = o.optString("tm");
            v.setTextViewText(R.id.tomorrow, "Demain · " + (tm.isEmpty() ? "rien" : tm));
            v.setTextViewText(R.id.budget, o.optString("st"));
            v.setTextColor(R.id.budget, o.optBoolean("warn") ? Color.parseColor("#FF8A80") : Color.parseColor("#B9CCCE"));
        } catch (Exception e) {
            v.setTextViewText(R.id.today, "Ouvre l’appli pour actualiser.");
        }
        return v;
    }
}
