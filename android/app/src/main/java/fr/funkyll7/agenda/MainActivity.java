package fr.funkyll7.agenda;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** L'appli : ton agenda (le site) en plein écran. */
public class MainActivity extends Activity {
    private WebView w;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        w = new WebView(this);
        setContentView(w);
        Web.setup(w, this, null);
        w.setWebChromeClient(new WebChromeClient()); // fenêtres alert / confirm du site
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.toString().startsWith(Web.URL)) return false;
                // liens externes (GitHub…) : dans le navigateur
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        Notif.channel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        Notif.run(this);
        if (b != null) w.restoreState(b);
        else w.loadUrl(Web.URL);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        w.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // le site se resynchronise tout seul quand il redevient visible et renvoie le résumé au widget
        w.onResume();
    }

    @Override
    protected void onPause() {
        w.onPause();
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (w.canGoBack()) w.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (w != null) w.destroy();
        super.onDestroy();
    }
}
