package fr.funkyll7.agenda;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Google Play prévient : « monté en voiture » → on démarre le GPS ; « descendu » → on termine le trajet. */
public class TripReceiver extends BroadcastReceiver {
    static final String ACTION = "fr.funkyll7.agenda.TRANSITION";

    @Override
    public void onReceive(Context c, Intent i) {
        if (!ActivityTransitionResult.hasResult(i)) return;
        ActivityTransitionResult r = ActivityTransitionResult.extractResult(i);
        if (r == null || !Trips.on(c)) return;
        for (ActivityTransitionEvent e : r.getTransitionEvents()) {
            if (e.getActivityType() != DetectedActivity.IN_VEHICLE) continue;
            boolean enter = e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER;
            Trips.prefs(c).edit().putString("lastEvent", (enter ? "en voiture" : "descendu de voiture") + " à "
                    + new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date())).apply();
            if (enter) TripService.start(c, false);
            else TripService.exit(c);
        }
    }
}
