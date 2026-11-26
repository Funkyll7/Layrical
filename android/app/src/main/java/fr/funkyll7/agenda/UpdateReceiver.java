package fr.funkyll7.agenda;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/** Résultat de l'installation d'une mise à jour. */
public class UpdateReceiver extends BroadcastReceiver {
    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context c, Intent i) {
        int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // Android demande une confirmation (première mise à jour, ou Android 11 et avant)
            Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm == null) return;
            confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (MainActivity.isOpen()) c.startActivity(confirm);
            else Updater.notify(c, "Une nouvelle version est prête : touche pour l’installer.",
                    PendingIntent.getActivity(c, 7, confirm, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        } else if (st != PackageInstaller.STATUS_SUCCESS) {
            // installation annulée ou ratée : on reproposera dès le prochain retour dans l'appli
            c.getSharedPreferences("update", Context.MODE_PRIVATE).edit().putLong("checked", 0).putLong("tried", 0).apply();
            if (!MainActivity.isOpen() || st == PackageInstaller.STATUS_FAILURE_ABORTED) return;
            String m = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            Toast.makeText(c, "Mise à jour non installée" + (m != null ? " : " + m : ""), Toast.LENGTH_LONG).show();
        }
    }
}
