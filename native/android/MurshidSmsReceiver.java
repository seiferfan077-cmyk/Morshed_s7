package com.murshid.s7;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

public final class MurshidSmsReceiver extends BroadcastReceiver {
  private static final String TAG = "MurshidSmsReceiver";
  private static final String CHANNEL_ID = "murshid_sms_messages";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || !Telephony.Sms.Intents.SMS_DELIVER_ACTION.equals(intent.getAction())) return;
    try {
      SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
      if (parts == null || parts.length == 0 || parts[0] == null) return;
      StringBuilder body = new StringBuilder();
      for (SmsMessage part : parts) {
        if (part != null && part.getMessageBody() != null) body.append(part.getMessageBody());
      }
      SmsMessage first = parts[0];
      ContentValues values = new ContentValues();
      values.put(Telephony.Sms.ADDRESS, first.getOriginatingAddress());
      values.put(Telephony.Sms.BODY, body.toString());
      values.put(Telephony.Sms.DATE, first.getTimestampMillis());
      values.put(Telephony.Sms.READ, 0);
      values.put(Telephony.Sms.SEEN, 0);
      values.put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX);
      if (Build.VERSION.SDK_INT >= 22) {
        long subscriptionId = intent.getLongExtra("subscription", -1L);
        if (subscriptionId >= 0) values.put(Telephony.Sms.SUBSCRIPTION_ID, subscriptionId);
      }
      Uri inserted = context.getContentResolver().insert(Telephony.Sms.Inbox.CONTENT_URI, values);
      if (inserted != null) {
        setResultCode(Telephony.Sms.Intents.RESULT_SMS_HANDLED);
        try {
          postMessageNotification(context, first.getOriginatingAddress(), body.toString());
        } catch (RuntimeException notificationError) {
          Log.w(TAG, "SMS stored, but its notification could not be posted", notificationError);
        }
      } else {
        setResultCode(Telephony.Sms.Intents.RESULT_SMS_GENERIC_ERROR);
      }
    } catch (Exception error) {
      Log.e(TAG, "Unable to store incoming SMS", error);
      setResultCode(Telephony.Sms.Intents.RESULT_SMS_GENERIC_ERROR);
    }
  }

  private void postMessageNotification(Context context, String address, String body) {
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager == null) return;
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "رسائل مُرشد", NotificationManager.IMPORTANCE_HIGH);
      channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
      manager.createNotificationChannel(channel);
    }
    Intent openApp = new Intent(context, MainActivity.class);
    openApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent contentIntent = PendingIntent.getActivity(
        context,
        address == null ? 0 : address.hashCode(),
        openApp,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26
        ? new Notification.Builder(context, CHANNEL_ID)
        : new Notification.Builder(context);
    builder.setSmallIcon(android.R.drawable.sym_action_chat)
        .setContentTitle(address == null || address.isEmpty() ? "رسالة جديدة" : address)
        .setContentText(body)
        .setStyle(new Notification.BigTextStyle().bigText(body))
        .setCategory(Notification.CATEGORY_MESSAGE)
        .setVisibility(Notification.VISIBILITY_PRIVATE)
        .setAutoCancel(true)
        .setContentIntent(contentIntent);
    manager.notify(address == null ? (int) System.currentTimeMillis() : address.hashCode(), builder.build());
  }
}
