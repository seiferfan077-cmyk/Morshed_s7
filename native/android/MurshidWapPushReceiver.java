package com.murshid.s7;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

/**
 * Android's SMS role requires a WAP_PUSH_DELIVER receiver alongside SMS_DELIVER.
 * MMS decoding and storage are not implemented in this SMS-only milestone, so notify instead of failing silently.
 */
public final class MurshidWapPushReceiver extends BroadcastReceiver {
  private static final String CHANNEL_ID = "murshid_sms_messages";

  @Override
  public void onReceive(Context context, Intent intent) {
    Log.w("MurshidWapPush", "Received WAP push; MMS content is not supported yet.");
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) return;
    if (Build.VERSION.SDK_INT >= 26) {
      manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "رسائل مُرشد", NotificationManager.IMPORTANCE_DEFAULT));
    }
    PendingIntent openApp = PendingIntent.getActivity(
        context,
        72,
        new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26
        ? new Notification.Builder(context, CHANNEL_ID)
        : new Notification.Builder(context);
    builder.setSmallIcon(android.R.drawable.sym_action_chat)
        .setContentTitle("رسالة وسائط غير مدعومة")
        .setContentText("وصلت رسالة MMS؛ مُرشد يعرض رسائل SMS النصية فقط حاليًا.")
        .setCategory(Notification.CATEGORY_MESSAGE)
        .setVisibility(Notification.VISIBILITY_PRIVATE)
        .setAutoCancel(true)
        .setContentIntent(openApp);
    manager.notify(72, builder.build());
  }
}
