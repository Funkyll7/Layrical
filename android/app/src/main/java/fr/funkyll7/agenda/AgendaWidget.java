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
            v.setTextViewText(R.id.at, "Mise à jour…");
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

        SharedPreferences p = c.getSharedPreferences(Web.PREFS, Context.MODE_PRIVATE);
        String raw = p.getString("data", null);
        if (raw == null) {
            v.setTextViewText(R.id.title, "📅 Agenda");
            v.setTextViewText(R.id.today, "Ouvre l’appli une fois (et colle ton jeton de synchro) pour remplir le widget.");
            v.setTextViewText(R.id.tomorrow, "");
            v.setTextViewText(R.id.budget, "");
            v.setTextViewText(R.id.at, "");
            return v;
        }
        try {
            JSONObject o = new JSONObject(raw);
            v.setTextViewText(R.id.title, "📅 Aujourd’hui · " + o.optString("date"));
            String t = lines(o.optJSONArray("today"), "\n", 5);
            v.setTextViewText(R.id.today, t.isEmpty() ? "Rien de prévu aujourd’hui ✨" : t);
            String d = lines(o.optJSONArray("tomorrow"), " · ", 3);
            v.setTextViewText(R.id.tomorrow, d.isEmpty() ? "Demain : rien de prévu" : "Demain : " + d);

            StringBuilder b = new StringBuilder();
            String bal = str(o, "bal"), sal = str(o, "sal"), eve = str(o, "eve"), low = str(o, "low");
            b.append("💰 Solde : ").append(bal != null ? bal : "à définir dans l’appli");
            if (sal != null) b.append("\n💼 Salaire : ").append(sal);
            String pc = str(o, "poche");
            if (pc != null) b.append("\n🎉 Argent de poche : reste ").append(pc);
            if (low != null) b.append("\n📉 Point bas : ").append(low);
            else if (eve != null) b.append("\n🐷 La veille du salaire : ").append(eve);
            if (o.optBoolean("warn")) b.append("\n⚠️ Sous ta limite de découvert : ouvre l’appli");
            v.setTextViewText(R.id.budget, b.toString());
            v.setTextColor(R.id.budget, o.optBoolean("warn") ? Color.parseColor("#FF9C8F") : Color.WHITE);

            long ts = p.getLong("t", 0);
            boolean old = System.currentTimeMillis() - ts > 3L * 3600 * 1000;
            v.setTextViewText(R.id.at, "Mis à jour à " + o.optString("at") + (old ? " (ancien : touche ↻)" : ""));
        } catch (Exception e) {
            v.setTextViewText(R.id.today, "Données illisibles : ouvre l’appli.");
        }
        return v;
    }
}
