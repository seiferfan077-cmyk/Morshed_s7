package com.murshid.s7;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Person;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.telecom.Call;
import android.telecom.CallAudioState;
import android.telecom.InCallService;
import java.util.Locale;

public class MurshidInCallService extends InCallService {
  public static final String ACTION_ANSWER = "com.murshid.s7.ACTION_ANSWER";
  public static final String ACTION_REJECT = "com.murshid.s7.ACTION_REJECT";
  public static final String ACTION_HANGUP = "com.murshid.s7.ACTION_HANGUP";
  public static final String ACTION_SET_MUTED = "com.murshid.s7.ACTION_SET_MUTED";
  public static final String ACTION_SET_SPEAKER = "com.murshid.s7.ACTION_SET_SPEAKER";
  public static final String EXTRA_ENABLED = "enabled";
  private static final String CHANNEL_ID = "murshid-incoming-calls-v2";
  private static final int NOTIFICATION_ID = 7001;
  private static Call currentCall;
  private TextToSpeech speech;
  private Ringtone ringtone;

  @Override
  public void onCallAdded(Call call) {
    super.onCallAdded(call);
    currentCall = call;
    MurshidCallerInfo info = MurshidCallerInfo.from(this, call);
    boolean incoming = call.getState() == Call.STATE_RINGING;
    showCallNotification(info, incoming);
    if (incoming) announceThenRing(info);
    call.registerCallback(new Call.Callback() {
      @Override public void onStateChanged(Call changedCall, int state) {
        if (state == Call.STATE_RINGING) {
          showCallNotification(MurshidCallerInfo.from(MurshidInCallService.this, changedCall), true);
        } else {
          stopRinging();
          if (state == Call.STATE_DISCONNECTED) clearCall();
          else showCallNotification(MurshidCallerInfo.from(MurshidInCallService.this, changedCall), false);
        }
      }
    });
  }

  @Override
  public void onCallRemoved(Call call) {
    if (currentCall == call) clearCall();
    super.onCallRemoved(call);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && currentCall != null) {
      String action = intent.getAction();
      if (ACTION_ANSWER.equals(action)) {
        stopRinging();
        currentCall.answer(0);
      } else if (ACTION_REJECT.equals(action) || ACTION_HANGUP.equals(action)) {
        stopRinging();
        currentCall.disconnect();
      } else if (ACTION_SET_MUTED.equals(action)) {
        setMuted(intent.getBooleanExtra(EXTRA_ENABLED, false));
      } else if (ACTION_SET_SPEAKER.equals(action)) {
        setAudioRoute(intent.getBooleanExtra(EXTRA_ENABLED, false)
            ? CallAudioState.ROUTE_SPEAKER : CallAudioState.ROUTE_EARPIECE);
      }
    }
    return START_NOT_STICKY;
  }

  private void showCallNotification(MurshidCallerInfo info, boolean incoming) {
    createChannel();
    Intent fullScreenIntent = new Intent(this, MurshidDialerActivity.class);
    fullScreenIntent.setAction(incoming ? MurshidDialerActivity.ACTION_INCOMING : MurshidDialerActivity.ACTION_ONGOING);
    fullScreenIntent.putExtra(MurshidDialerActivity.EXTRA_CALLER_NAME, info.displayName);
    fullScreenIntent.putExtra(MurshidDialerActivity.EXTRA_LINE_LABEL, info.lineLabel);
    fullScreenIntent.putExtra(MurshidDialerActivity.EXTRA_VERIFIED, info.verified);
    long connectedAt = 0L;
    if (Build.VERSION.SDK_INT >= 23 && currentCall != null && currentCall.getDetails() != null) {
      connectedAt = currentCall.getDetails().getConnectTimeMillis();
    }
    fullScreenIntent.putExtra(MurshidDialerActivity.EXTRA_CONNECTED_AT,
        connectedAt > 0L ? connectedAt : System.currentTimeMillis());
    fullScreenIntent.setData(Uri.parse("tel:" + Uri.encode(info.number)));
    fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    int immutable = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    PendingIntent content = PendingIntent.getActivity(this, NOTIFICATION_ID, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT | immutable);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
    String title = info.displayName == null || info.displayName.trim().isEmpty() ? info.number : info.displayName;
    if (info.verified) title = "✓  " + title;
    builder.setSmallIcon(com.murshid.s7.R.mipmap.ic_launcher)
        .setContentTitle(incoming ? "اتصال وارد إلى مُرشد · " + title : "مكالمة مُرشد جارية · " + title)
        .setContentText("الرقم: " + info.number + " · عبر " + info.lineLabel)
        .setCategory(Notification.CATEGORY_CALL)
        .setPriority(Notification.PRIORITY_MAX)
        .setOngoing(true)
        .setAutoCancel(false)
        .setFullScreenIntent(content, incoming)
        .setContentIntent(content);
    if (incoming) {
      PendingIntent reject = callActionPendingIntent(ACTION_REJECT, 7002);
      PendingIntent answer = callActionPendingIntent(ACTION_ANSWER, 7003);
      if (Build.VERSION.SDK_INT >= 31) {
        Person caller = new Person.Builder().setName(title).setImportant(true).build();
        builder.setStyle(Notification.CallStyle.forIncomingCall(caller, reject, answer));
      } else {
        builder.addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "رفض", reject).build());
        builder.addAction(new Notification.Action.Builder(android.R.drawable.sym_action_call, "رد", answer).build());
      }
    }
    ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, builder.build());
  }

  private PendingIntent callActionPendingIntent(String action, int requestCode) {
    Intent intent = new Intent(this, MurshidInCallService.class);
    intent.setAction(action);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getService(this, requestCode, intent, flags);
  }

  private void announceThenRing(MurshidCallerInfo info) {
    String caller = info.displayName == null || info.displayName.trim().isEmpty() ? "رقم غير معروف" : info.displayName;
    String number = info.number == null || info.number.trim().isEmpty() ? "رقم غير معروف" : info.number;
    String spoken = "لديك الآن اتصال وارد من " + caller + "، رقم جهة الاتصال " + number;
    speech = new TextToSpeech(this, status -> {
      if (status != TextToSpeech.SUCCESS) { playRingtone(); return; }
      int arabicStatus = speech.setLanguage(new Locale("ar"));
      if (arabicStatus == TextToSpeech.LANG_MISSING_DATA || arabicStatus == TextToSpeech.LANG_NOT_SUPPORTED) speech.setLanguage(Locale.getDefault());
      speech.setSpeechRate(0.95f);
      if (Build.VERSION.SDK_INT >= 21) speech.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
        @Override public void onStart(String utteranceId) { }
        @Override public void onDone(String utteranceId) { playRingtone(); }
        @Override public void onError(String utteranceId) { playRingtone(); }
      });
      if (Build.VERSION.SDK_INT >= 21) speech.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "murshid-caller");
      else { speech.speak(spoken, TextToSpeech.QUEUE_FLUSH, null); playRingtone(); }
    });
  }

  private void playRingtone() {
    if (currentCall == null || currentCall.getState() != Call.STATE_RINGING || ringtone != null) return;
    Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
    ringtone = RingtoneManager.getRingtone(this, uri);
    if (ringtone != null) ringtone.play();
  }

  private void stopRinging() {
    if (speech != null) { speech.stop(); speech.shutdown(); speech = null; }
    if (ringtone != null) { ringtone.stop(); ringtone = null; }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "مكالمات مُرشد الواردة", NotificationManager.IMPORTANCE_HIGH);
    channel.setSound(null, null);
    channel.enableVibration(true);
    manager.createNotificationChannel(channel);
  }

  private void clearCall() {
    stopRinging();
    currentCall = null;
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (manager != null) manager.cancel(NOTIFICATION_ID);
  }
}
