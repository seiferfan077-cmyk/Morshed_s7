package com.murshid.s7;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Person;
import android.app.PendingIntent;
import android.content.Intent;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.tts.TextToSpeech;
import android.telecom.Call;
import android.telecom.CallAudioState;
import android.telecom.InCallService;
import android.util.Log;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

public class MurshidInCallService extends InCallService {
  private static final String TAG = "MurshidInCallService";
  public static final String ACTION_ANSWER = "com.murshid.s7.ACTION_ANSWER";
  public static final String ACTION_REJECT = "com.murshid.s7.ACTION_REJECT";
  public static final String ACTION_HANGUP = "com.murshid.s7.ACTION_HANGUP";
  public static final String ACTION_SET_MUTED = "com.murshid.s7.ACTION_SET_MUTED";
  public static final String ACTION_SET_SPEAKER = "com.murshid.s7.ACTION_SET_SPEAKER";
  public static final String ACTION_CALL_STATE_CHANGED = "com.murshid.s7.CALL_STATE_CHANGED";
  public static final String EXTRA_ENABLED = "enabled";
  public static final String EXTRA_CALL_STATE = "call_state";
  private static final String CHANNEL_ID = "murshid-incoming-calls-v2";
  private static final int NOTIFICATION_ID = 7001;
  private static Call currentCall;
  private static MurshidInCallService activeService;
  private static volatile boolean mutedState;
  private static volatile boolean speakerEnabledState;
  private static volatile long ringtoneStartedAtElapsedRealtime;
  private Call.Callback currentCallCallback;
  private MurshidCallerInfo currentCallerInfo;
  private MurshidCallOverlay callOverlay;
  private boolean incomingCallForOverlay;
  private boolean callScreenActivityVisible;
  private final Handler overlayHandler = new Handler(Looper.getMainLooper());
  private final ExecutorService callerInfoExecutor = Executors.newSingleThreadExecutor(runnable -> {
    Thread thread = new Thread(runnable, "MurshidCallerInfo");
    thread.setDaemon(true);
    return thread;
  });
  private final Runnable refreshOverlayAfterActivity = () -> {
    if (!callScreenActivityVisible) refreshCallOverlayForCurrent();
  };
  private TextToSpeech speech;
  private int speechGeneration;
  private Ringtone ringtone;
  private Vibrator callVibrator;

  @Override public void onCreate() {
    super.onCreate();
    activeService = this;
    callOverlay = new MurshidCallOverlay(this);
    if (Build.VERSION.SDK_INT >= 31) {
      VibratorManager manager = getSystemService(VibratorManager.class);
      if (manager != null) callVibrator = manager.getDefaultVibrator();
    } else {
      callVibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
    }
  }

  @Override
  public void onCallAdded(Call call) {
    super.onCallAdded(call);
    if (currentCall != null) stopRinging();
    if (currentCall != null && currentCallCallback != null) {
      try { currentCall.unregisterCallback(currentCallCallback); }
      catch (RuntimeException error) { Log.w(TAG, "Unable to unregister previous call callback", error); }
    }
    currentCall = call;
    mutedState = false;
    speakerEnabledState = false;
    currentCallCallback = new Call.Callback() {
      @Override public void onStateChanged(Call changedCall, int state) {
        if (state == Call.STATE_RINGING) {
          incomingCallForOverlay = true;
          showCallNotification(callerInfoFor(changedCall), true);
        } else {
          stopRinging();
          if (state == Call.STATE_DISCONNECTED) {
            broadcastCallState(changedCall, state);
            clearCall();
          }
          else showCallNotification(callerInfoFor(changedCall), false);
        }
        if (state != Call.STATE_DISCONNECTED) broadcastCallState(changedCall, state);
        updateCallOverlay(changedCall, state);
      }
    };
    try { call.registerCallback(currentCallCallback); }
    catch (RuntimeException error) { Log.e(TAG, "Unable to register call state callback", error); }
    incomingCallForOverlay = call.getState() == Call.STATE_RINGING;
    MurshidCallerInfo info = MurshidCallerInfo.basicFrom(call);
    currentCallerInfo = info;
    boolean incoming = call.getState() == Call.STATE_RINGING;
    showCallNotification(info, incoming);
    updateCallOverlay(call, call.getState());
    if (incoming) announceThenRing(info);
    broadcastCallState(call, call.getState());
    enrichCallerInfoAsync(call);
  }

  @Override
  public void onCallRemoved(Call call) {
    if (currentCall == call) {
      broadcastCallState(call, Call.STATE_DISCONNECTED);
      clearCall();
    }
    super.onCallRemoved(call);
  }

  @Override public void onCallAudioStateChanged(CallAudioState audioState) {
    super.onCallAudioStateChanged(audioState);
    if (audioState != null) {
      mutedState = audioState.isMuted();
      speakerEnabledState = (audioState.getRoute() & CallAudioState.ROUTE_SPEAKER) != 0;
      refreshCallOverlayForCurrent();
    }
  }

  @Override public void onBringToForeground(boolean showDialpad) {
    super.onBringToForeground(showDialpad);
    if (callOverlay != null) callOverlay.hide();
    Call call = currentCall;
    if (call == null) return;
    MurshidCallerInfo info = callerInfoFor(call);
    String action = call.getState() == Call.STATE_RINGING
        ? MurshidDialerActivity.ACTION_INCOMING : MurshidDialerActivity.ACTION_ONGOING;
    try {
      startActivity(createCallScreenIntent(info, action)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
    } catch (RuntimeException ignored) {
      // The full-screen notification remains the fallback when Android disallows a background launch.
    }
  }

  @Override public void onDestroy() {
    overlayHandler.removeCallbacksAndMessages(null);
    stopRinging();
    if (callOverlay != null) callOverlay.hide();
    if (activeService == this) activeService = null;
    callerInfoExecutor.shutdownNow();
    super.onDestroy();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null) dispatchAction(intent.getAction(), intent.getBooleanExtra(EXTRA_ENABLED, false));
    return START_NOT_STICKY;
  }

  public static boolean dispatchAction(String action, boolean enabled) {
    MurshidInCallService service = activeService;
    Call call = currentCall;
    if (service == null || call == null) return false;
    try {
      if (ACTION_ANSWER.equals(action)) {
        service.stopRinging();
        call.answer(0);
      } else if (ACTION_REJECT.equals(action) || ACTION_HANGUP.equals(action)) {
        service.stopRinging();
        call.disconnect();
      } else if (ACTION_SET_MUTED.equals(action)) {
        service.setMuted(enabled);
        mutedState = enabled;
        service.refreshCallOverlayForCurrent();
      } else if (ACTION_SET_SPEAKER.equals(action)) {
        service.setAudioRoute(enabled ? CallAudioState.ROUTE_SPEAKER : CallAudioState.ROUTE_EARPIECE);
        speakerEnabledState = enabled;
        service.refreshCallOverlayForCurrent();
      } else {
        return false;
      }
    } catch (RuntimeException error) {
      Log.e(TAG, "Telecom rejected call action " + action, error);
      return false;
    }
    return true;
  }

  public static long getConnectedAtMillis() {
    Call call = currentCall;
    if (Build.VERSION.SDK_INT >= 23 && call != null && call.getDetails() != null) {
      return call.getDetails().getConnectTimeMillis();
    }
    return 0L;
  }

  public static boolean isMuted() { return mutedState; }
  public static boolean isSpeakerOn() { return speakerEnabledState; }
  public static long getRingtoneStartedAtElapsedRealtime() { return ringtoneStartedAtElapsedRealtime; }

  public static void setCallScreenActivityVisible(boolean visible) {
    MurshidInCallService service = activeService;
    if (service == null) return;
    service.overlayHandler.removeCallbacks(service.refreshOverlayAfterActivity);
    service.callScreenActivityVisible = visible;
    if (visible) {
      if (service.callOverlay != null) service.callOverlay.hide();
    } else {
      service.overlayHandler.postDelayed(service.refreshOverlayAfterActivity, 350L);
    }
  }

  public static void refreshCallOverlay() {
    MurshidInCallService service = activeService;
    if (service != null) service.refreshCallOverlayForCurrent();
  }

  public static boolean bringCallScreenToFront() {
    MurshidInCallService service = activeService;
    Call call = currentCall;
    if (service == null || call == null) return false;
    MurshidCallerInfo info = service.callerInfoFor(call);
    String action = call.getState() == Call.STATE_RINGING
        ? MurshidDialerActivity.ACTION_INCOMING : MurshidDialerActivity.ACTION_ONGOING;
    try {
      service.startActivity(service.createCallScreenIntent(info, action)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
      return true;
    } catch (RuntimeException error) {
      Log.w(TAG, "Android blocked launching the call screen; notification UI remains available", error);
      return false;
    }
  }

  private void refreshCallOverlayForCurrent() {
    Call call = currentCall;
    if (call == null) {
      if (callOverlay != null) callOverlay.hide();
      return;
    }
    updateCallOverlay(call, call.getState());
  }

  private MurshidCallerInfo callerInfoFor(Call call) {
    if (call == currentCall && currentCallerInfo != null) return currentCallerInfo;
    return MurshidCallerInfo.basicFrom(call);
  }

  private void enrichCallerInfoAsync(Call call) {
    try {
      callerInfoExecutor.execute(() -> {
        MurshidCallerInfo enriched = MurshidCallerInfo.safeFrom(this, call);
        overlayHandler.post(() -> {
          if (currentCall != call || call.getState() == Call.STATE_DISCONNECTED) return;
          currentCallerInfo = enriched;
          int state = call.getState();
          showCallNotification(enriched, state == Call.STATE_RINGING);
          updateCallOverlay(call, state);
          broadcastCallState(call, state);
        });
      });
    } catch (RejectedExecutionException error) {
      Log.w(TAG, "Caller enrichment executor is unavailable; using basic call details", error);
    }
  }

  private void updateCallOverlay(Call call, int state) {
    if (callOverlay == null) return;
    if (!incomingCallForOverlay || callScreenActivityVisible || MurshidDialerActivity.isCallScreenVisible()
        || MurshidDialerActivity.isExternalSettingsVisible()
        || state == Call.STATE_DISCONNECTED) {
      callOverlay.hide();
      return;
    }
    callOverlay.show(callerInfoFor(call), state == Call.STATE_RINGING);
  }

  private void showCallNotification(MurshidCallerInfo info, boolean incoming) {
    try {
      showCallNotificationInternal(info, incoming);
    } catch (RuntimeException error) {
      Log.e(TAG, "Unable to post call notification; keeping InCallService alive", error);
    }
  }

  private void showCallNotificationInternal(MurshidCallerInfo info, boolean incoming) {
    createChannel();
    Intent fullScreenIntent = createCallScreenIntent(info,
        incoming ? MurshidDialerActivity.ACTION_INCOMING : MurshidDialerActivity.ACTION_ONGOING);
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
      PendingIntent answer = callAnswerActivityPendingIntent(info);
      if (Build.VERSION.SDK_INT >= 31) {
        Person caller = new Person.Builder().setName(title).setImportant(true).build();
        builder.setStyle(Notification.CallStyle.forIncomingCall(caller, reject, answer));
      } else {
        builder.addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "رفض", reject).build());
        builder.addAction(new Notification.Action.Builder(android.R.drawable.sym_action_call, "رد", answer).build());
      }
    }
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) {
      Log.e(TAG, "NotificationManager unavailable; the Telecom call remains active without a notification");
      return;
    }
    if (incoming && Build.VERSION.SDK_INT >= 34 && !manager.canUseFullScreenIntent()) {
      Log.w(TAG, "Full-screen intent access is disabled; Android may show the call as a heads-up notification only");
    }
    manager.notify(NOTIFICATION_ID, builder.build());
  }

  private Intent createCallScreenIntent(MurshidCallerInfo info, String action) {
    Intent intent = new Intent(this, MurshidDialerActivity.class);
    intent.setAction(action);
    intent.putExtra(MurshidDialerActivity.EXTRA_CALLER_NAME, info.displayName);
    intent.putExtra(MurshidDialerActivity.EXTRA_LINE_LABEL, info.lineLabel);
    intent.putExtra(MurshidDialerActivity.EXTRA_CONTACT_TYPE, info.contactType);
    intent.putExtra(MurshidDialerActivity.EXTRA_SAVED_CONTACT, info.savedContact);
    intent.putExtra(MurshidDialerActivity.EXTRA_FAVORITE_CONTACT, info.favorite);
    intent.putExtra(MurshidDialerActivity.EXTRA_CONTACT_LOOKUP_AVAILABLE, info.contactLookupAvailable);
    intent.putExtra(MurshidDialerActivity.EXTRA_RECENT_CALL_SUMMARY, info.recentCallSummary);
    intent.putExtra(MurshidDialerActivity.EXTRA_RECENT_SMS_SUMMARY, info.recentSmsSummary);
    intent.putExtra(MurshidDialerActivity.EXTRA_VERIFIED, info.verified);
    long connectedAt = 0L;
    if (Build.VERSION.SDK_INT >= 23 && currentCall != null && currentCall.getDetails() != null) {
      connectedAt = currentCall.getDetails().getConnectTimeMillis();
    }
    intent.putExtra(MurshidDialerActivity.EXTRA_CONNECTED_AT,
        connectedAt > 0L ? connectedAt : System.currentTimeMillis());
    intent.setData(Uri.parse("tel:" + Uri.encode(info.number == null ? "" : info.number)));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    return intent;
  }

  private PendingIntent callAnswerActivityPendingIntent(MurshidCallerInfo info) {
    Intent intent = createCallScreenIntent(info, MurshidDialerActivity.ACTION_ANSWER_FROM_NOTIFICATION);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getActivity(this, 7003, intent, flags);
  }

  private void broadcastCallState(Call call, int state) {
    Intent update = new Intent(ACTION_CALL_STATE_CHANGED);
    update.setPackage(getPackageName());
    update.putExtra(EXTRA_CALL_STATE, state);
    MurshidCallerInfo info = callerInfoFor(call);
    update.putExtra(MurshidDialerActivity.EXTRA_CALLER_NAME, info.displayName);
    update.putExtra(MurshidDialerActivity.EXTRA_LINE_LABEL, info.lineLabel);
    update.putExtra(MurshidDialerActivity.EXTRA_CONTACT_TYPE, info.contactType);
    update.putExtra(MurshidDialerActivity.EXTRA_SAVED_CONTACT, info.savedContact);
    update.putExtra(MurshidDialerActivity.EXTRA_FAVORITE_CONTACT, info.favorite);
    update.putExtra(MurshidDialerActivity.EXTRA_CONTACT_LOOKUP_AVAILABLE, info.contactLookupAvailable);
    update.putExtra(MurshidDialerActivity.EXTRA_RECENT_CALL_SUMMARY, info.recentCallSummary);
    update.putExtra(MurshidDialerActivity.EXTRA_RECENT_SMS_SUMMARY, info.recentSmsSummary);
    update.putExtra(MurshidDialerActivity.EXTRA_VERIFIED, info.verified);
    sendBroadcast(update);
  }

  private PendingIntent callActionPendingIntent(String action, int requestCode) {
    Intent intent = new Intent(this, MurshidCallActionReceiver.class);
    intent.setAction(action);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(this, requestCode, intent, flags);
  }

  private void announceThenRing(MurshidCallerInfo info) {
    String caller = info.displayName == null ? "" : info.displayName.trim();
    String number = info.number == null || info.number.trim().isEmpty() ? "رقم غير معروف" : info.number;
    String spoken = caller.isEmpty()
        ? "لديك الآن اتصال وارد من رقم " + number
        : "لديك الآن اتصال وارد من " + caller + "، رقم جهة الاتصال " + number;
    stopSpeech();
    int generation = speechGeneration;
    try {
      speech = new TextToSpeech(this, status -> overlayHandler.post(
          () -> handleSpeechInitialized(generation, status, spoken)));
    } catch (RuntimeException error) {
      Log.w(TAG, "Text-to-speech unavailable; starting the ringtone", error);
      playRingtone();
    }
  }

  private void handleSpeechInitialized(int generation, int status, String spoken) {
    TextToSpeech engine = speech;
    if (generation != speechGeneration || engine == null || currentCall == null
        || currentCall.getState() != Call.STATE_RINGING) return;
    if (status != TextToSpeech.SUCCESS) {
      stopSpeech();
      playRingtone();
      return;
    }
    try {
      int arabicStatus = engine.setLanguage(new Locale("ar"));
      if (arabicStatus == TextToSpeech.LANG_MISSING_DATA || arabicStatus == TextToSpeech.LANG_NOT_SUPPORTED) {
        engine.setLanguage(Locale.getDefault());
      }
      engine.setSpeechRate(0.95f);
      if (Build.VERSION.SDK_INT >= 21) {
        engine.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
          @Override public void onStart(String utteranceId) { }
          @Override public void onDone(String utteranceId) {
            overlayHandler.post(() -> { if (isCurrentSpeech(generation)) playRingtone(); });
          }
          @Override public void onError(String utteranceId) {
            overlayHandler.post(() -> { if (isCurrentSpeech(generation)) playRingtone(); });
          }
        });
        if (engine.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "murshid-caller") == TextToSpeech.ERROR) {
          playRingtone();
        }
      } else {
        engine.speak(spoken, TextToSpeech.QUEUE_FLUSH, null);
        playRingtone();
      }
    } catch (RuntimeException error) {
      Log.w(TAG, "Text-to-speech failed during incoming call", error);
      stopSpeech();
      playRingtone();
    }
  }

  private boolean isCurrentSpeech(int generation) {
    return generation == speechGeneration && speech != null && currentCall != null
        && currentCall.getState() == Call.STATE_RINGING;
  }

  private void stopSpeech() {
    speechGeneration++;
    TextToSpeech activeSpeech = speech;
    speech = null;
    if (activeSpeech != null) {
      try { activeSpeech.stop(); } catch (RuntimeException error) { Log.w(TAG, "Unable to stop TTS", error); }
      try { activeSpeech.shutdown(); } catch (RuntimeException error) { Log.w(TAG, "Unable to shut down TTS", error); }
    }
  }

  private void playRingtone() {
    if (currentCall == null || currentCall.getState() != Call.STATE_RINGING || ringtone != null) return;
    try {
      Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
      ringtone = RingtoneManager.getRingtone(this, uri);
      if (ringtone != null) {
        ringtone.play();
        ringtoneStartedAtElapsedRealtime = SystemClock.elapsedRealtime();
        startSynchronizedVibration();
      }
    } catch (RuntimeException error) {
      ringtone = null;
      Log.w(TAG, "Unable to start custom ringtone; Telecom call UI remains active", error);
    }
  }

  private void startSynchronizedVibration() {
    try {
      if (callVibrator == null || !callVibrator.hasVibrator()) return;
      AudioManager audio = (AudioManager) getSystemService(AUDIO_SERVICE);
      if (audio != null && audio.getRingerMode() == AudioManager.RINGER_MODE_SILENT) return;
      // Three short taps at 0, 250 and 500 ms, followed by the same 3.39 s quiet
      // interval used by the visual waveform's four-second ring cycle.
      long[] timings = { 0L, 110L, 140L, 110L, 140L, 110L, 3390L };
      if (Build.VERSION.SDK_INT >= 26) {
        callVibrator.vibrate(VibrationEffect.createWaveform(timings, 0));
      } else {
        callVibrator.vibrate(timings, 0);
      }
    } catch (RuntimeException error) {
      Log.w(TAG, "Synchronized vibration unavailable; call UI and ringtone continue", error);
    }
  }

  private void stopRinging() {
    ringtoneStartedAtElapsedRealtime = 0L;
    if (callVibrator != null) {
      try { callVibrator.cancel(); } catch (RuntimeException ignored) { }
    }
    stopSpeech();
    if (ringtone != null) {
      try { ringtone.stop(); } catch (RuntimeException error) { Log.w(TAG, "Unable to stop ringtone", error); }
      ringtone = null;
    }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) {
      Log.e(TAG, "NotificationManager unavailable; cannot create incoming-call channel");
      return;
    }
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "مكالمات مُرشد الواردة", NotificationManager.IMPORTANCE_HIGH);
    channel.setSound(null, null);
    channel.enableVibration(true);
    manager.createNotificationChannel(channel);
  }

  private void clearCall() {
    stopRinging();
    incomingCallForOverlay = false;
    overlayHandler.removeCallbacks(refreshOverlayAfterActivity);
    if (callOverlay != null) callOverlay.hide();
    if (currentCall != null && currentCallCallback != null) currentCall.unregisterCallback(currentCallCallback);
    currentCallCallback = null;
    currentCall = null;
    currentCallerInfo = null;
    mutedState = false;
    speakerEnabledState = false;
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (manager != null) manager.cancel(NOTIFICATION_ID);
  }
}
