package fr.funkyll7.agenda;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;

/**
 * Bulle flottante (au-dessus de toutes les applis, Waze compris) qui contrôle la musique en cours,
 * quelle que soit l'appli : ⏮ ⏯ ⏭ et le titre. Toucher 🎵 ouvre/ferme les boutons ; on la déplace en la glissant.
 */
public class Bubble extends Service {
    static final String STOP = "fr.funkyll7.agenda.BUBBLE_STOP";
    static boolean on = false;

    private WindowManager wm;
    private LinearLayout root, panel;
    private TextView main, play, title;
    private WindowManager.LayoutParams lp;
    private MediaSessionManager msm;
    private MediaController mc;
    private final Handler h = new Handler(Looper.getMainLooper());
    private MediaSessionManager.OnActiveSessionsChangedListener sessL;
    private final MediaController.Callback cb = new MediaController.Callback() {
        @Override public void onPlaybackStateChanged(PlaybackState s) { refresh(); }
        @Override public void onMetadataChanged(MediaMetadata m) { refresh(); }
        @Override public void onSessionDestroyed() { bind(); }
    };

    static boolean canShow(Context c) { return Settings.canDrawOverlays(c); }

    static void show(Context c) {
        Intent i = new Intent(c, Bubble.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    static void hide(Context c) { c.stopService(new Intent(c, Bubble.class)); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        if (i != null && STOP.equals(i.getAction())) { stopSelf(); return START_NOT_STICKY; }
        foreground();
        if (root == null) build();
        return START_STICKY;
    }

    private void foreground() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("bulle", "Bulle musique", NotificationManager.IMPORTANCE_MIN));
        PendingIntent stop = PendingIntent.getService(this, 3, new Intent(this, Bubble.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, "bulle").setSmallIcon(R.drawable.ic_notif).setContentTitle("Bulle musique affichée")
                .setContentText("Touche pour la masquer").setContentIntent(stop).setOngoing(true).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(42, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(42, n);
    }

    private int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private TextView btn(String t, float size) {
        TextView b = new TextView(this);
        b.setText(t);
        b.setTextSize(size);
        b.setTextColor(0xFFFFFFFF);
        b.setGravity(Gravity.CENTER);
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(44), dp(44)));
        return b;
    }

    @SuppressLint("ClickableViewAccessibility")
    private void build() {
        if (!canShow(this)) { stopSelf(); return; }
        wm = getSystemService(WindowManager.class);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.HORIZONTAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(dp(4), dp(4), dp(6), dp(4));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xF015232A);
        bg.setCornerRadius(dp(28));
        bg.setStroke(dp(1), 0x33FFFFFF);
        root.setBackground(bg);
        root.setElevation(dp(6));

        main = btn("🎵", 20);
        root.addView(main);
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.HORIZONTAL);
        panel.setGravity(Gravity.CENTER_VERTICAL);
        title = new TextView(this);
        title.setTextColor(0xFFB9CCCE);
        title.setTextSize(12);
        title.setMaxWidth(dp(120));
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setPadding(dp(2), 0, dp(4), 0);
        TextView prev = btn("⏮", 18), next = btn("⏭", 18), close = btn("✕", 14);
        play = btn("⏯", 20);
        close.setTextColor(0xFF7FA0A3);
        panel.addView(title);
        panel.addView(prev);
        panel.addView(play);
        panel.addView(next);
        panel.addView(close);
        root.addView(panel);
        SharedPreferences sp = getSharedPreferences("bulle", MODE_PRIVATE);
        panel.setVisibility(sp.getBoolean("open", true) ? View.VISIBLE : View.GONE);

        prev.setOnClickListener(v -> act(KeyEvent.KEYCODE_MEDIA_PREVIOUS));
        next.setOnClickListener(v -> act(KeyEvent.KEYCODE_MEDIA_NEXT));
        play.setOnClickListener(v -> act(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE));
        close.setOnClickListener(v -> stopSelf());

        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = sp.getInt("x", dp(8));
        lp.y = sp.getInt("y", dp(220));

        // 🎵 : toucher = ouvrir/fermer ; glisser = déplacer la bulle
        main.setOnTouchListener(new View.OnTouchListener() {
            float sx, sy; int ox, oy; boolean moved;
            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = e.getRawX(); sy = e.getRawY(); ox = lp.x; oy = lp.y; moved = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                        if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                        if (moved) { lp.x = ox + (int) dx; lp.y = Math.max(0, oy + (int) dy); wm.updateViewLayout(root, lp); }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) {
                            boolean open = panel.getVisibility() != View.VISIBLE;
                            panel.setVisibility(open ? View.VISIBLE : View.GONE);
                            sp.edit().putBoolean("open", open).apply();
                        } else sp.edit().putInt("x", lp.x).putInt("y", lp.y).apply();
                        return true;
                }
                return false;
            }
        });
        wm.addView(root, lp);
        on = true;

        msm = getSystemService(MediaSessionManager.class);
        try {
            sessL = list -> bind();
            msm.addOnActiveSessionsChangedListener(sessL, new ComponentName(this, BankListener.class));
        } catch (Exception ignored) { sessL = null; } // sans lecture des notifications : boutons quand même actifs (touches média)
        bind();
    }

    /** Se branche sur la musique en cours (celle qui joue, sinon la plus récente). */
    private void bind() {
        if (mc != null) { try { mc.unregisterCallback(cb); } catch (Exception ignored) { } mc = null; }
        try {
            List<MediaController> l = msm.getActiveSessions(new ComponentName(this, BankListener.class));
            for (MediaController c : l) {
                PlaybackState s = c.getPlaybackState();
                if (s != null && s.getState() == PlaybackState.STATE_PLAYING) { mc = c; break; }
                if (mc == null) mc = c;
            }
            if (mc != null) mc.registerCallback(cb, h);
        } catch (Exception ignored) { }
        refresh();
    }

    private void refresh() {
        if (title == null) return;
        String t = "";
        boolean playing = false;
        if (mc != null) {
            MediaMetadata m = mc.getMetadata();
            if (m != null) {
                CharSequence a = m.getText(MediaMetadata.METADATA_KEY_TITLE);
                t = a == null ? "" : a.toString();
            }
            PlaybackState s = mc.getPlaybackState();
            playing = s != null && s.getState() == PlaybackState.STATE_PLAYING;
        }
        title.setText(t);
        title.setVisibility(t.isEmpty() ? View.GONE : View.VISIBLE);
        play.setText(playing ? "⏸" : "▶");
    }

    private void act(int key) {
        if (mc != null) {
            MediaController.TransportControls tc = mc.getTransportControls();
            PlaybackState s = mc.getPlaybackState();
            boolean playing = s != null && s.getState() == PlaybackState.STATE_PLAYING;
            if (key == KeyEvent.KEYCODE_MEDIA_PREVIOUS) tc.skipToPrevious();
            else if (key == KeyEvent.KEYCODE_MEDIA_NEXT) tc.skipToNext();
            else if (playing) tc.pause(); else tc.play();
        } else {
            AudioManager am = getSystemService(AudioManager.class);
            am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, key));
            am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, key));
        }
        h.postDelayed(this::bind, 600);
    }

    @Override
    public void onDestroy() {
        on = false;
        try { if (mc != null) mc.unregisterCallback(cb); } catch (Exception ignored) { }
        try { if (sessL != null) msm.removeOnActiveSessionsChangedListener(sessL); } catch (Exception ignored) { }
        try { if (root != null) wm.removeView(root); } catch (Exception ignored) { }
        root = null;
        super.onDestroy();
    }
}
