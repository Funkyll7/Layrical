package fr.funkyll7.agenda;

import android.app.Activity;
import android.os.Bundle;

/** Écran invisible lancé par le bouton ♫ du widget : ouvre YouTube Music (playlist ou reprise) puis se ferme. */
public class MusicReceiver extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Music.widgetPlaysList(this)) Music.playList(this); else Music.openAndPlay(this);
        finish();
    }
}
