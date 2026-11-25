package fr.funkyll7.agenda;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Heure d'une notification, redémarrage du téléphone ou mise à jour de l'appli. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Notif.run(c);
        // on en profite pour recalculer avec les dernières données (synchro GitHub en arrière-plan)
        AgendaWidget.background(c, goAsync());
    }
}
