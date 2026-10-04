package com.murshid.s7;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.InCallService;

public class MurshidInCallService extends InCallService {
  public static final String ACTION_ANSWER = "com.murshid.s7.ACTION_ANSWER";
  public static final String ACTION_REJECT = "com.murshid.s7.ACTION_REJECT";
  private static final String CHANNEL_ID = "murshid-incoming-calls";
  private static final int NOTIFICATION_ID = 7001;
  private static Call currentCall;

  @Override
  public void onCallAdded(Call call) {
    super.onCallAdded(call);
    currentCall = call;
    if (call.getState() == Call.STATE_RINGING) showIncomingCall(call);
    call.registerCallback(new Call.Callback() { @Override public void onStateChanged(Call ignored, int state) { if (state == Call.STATE_DISCONNECTED) clearCall(); } });
  }

  @Override
  public void onCallRemoved(Call call) {
    if (currentCall == call) clearCall();
    super.onCallRemoved(call);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && currentCall != null) {
      if (ACTION_ANSWER.equals(intent.getAction())) currentCall.answer(0);
      if (ACTION_REJECT.equals(intent.getAction())) currentCall.disconnect();
    }
    return START_NOT_STICKY;
  }

  private void showIncomingCall(Call call) {
    createChannel();
    Intent fullScreenIntent = new Intent(this, MurshidDialerActivity.class);
    Uri handle = call.getDetails() == null ? null : call.getDetails().getHandle();
    if (handle != null) fullScreenIntent.setData(handle);
    fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
    int immutable = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    PendingIntent fullScreen = PendingIntent.getActivity(this, NOTIFICATION_ID, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT | immutable);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
    builder.setSmallIcon(com.murshid.s7.R.mipmap.ic_launcher).setContentTitle("اتصال وارد إلى مُرشد").setContentText(handle == null ? "رقم وارد" : handle.toString()).setCategory(Notification.CATEGORY_CALL).setOngoing(true).setAutoCancel(false).setFullScreenIntent(fullScreen, true).setContentIntent(fullScreen);
    ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, builder.build());
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
    Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
    AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "مكالمات مُرشد الواردة", NotificationManager.IMPORTANCE_HIGH);
    channel.setSound(ringtone, attributes);
    channel.enableVibration(true);
    manager.createNotificationChannel(channel);
  }

  private void clearCall() {
    currentCall = null;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) manager.cancel(NOTIFICATION_ID);
  }
}
