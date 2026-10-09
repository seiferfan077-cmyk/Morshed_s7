package com.murshid.s7;

import android.content.Context;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;

public final class MurshidCallOverlay {
  private static final String PREFERENCES = "murshid_call_overlay";
  private static final String ENABLED_KEY = "incoming_call_overlay_enabled";
  private final Context context;
  private final WindowManager windowManager;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private View overlayView;

  public MurshidCallOverlay(Context context) {
    this.context = context;
    this.windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
  }

  /** Enabled by default; users may turn the floating layer off from Murshid's call settings. */
  public static boolean isEnabled(Context context) {
    return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getBoolean(ENABLED_KEY, true);
  }

  public static void setEnabled(Context context, boolean enabled) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putBoolean(ENABLED_KEY, enabled).apply();
    MurshidInCallService.refreshCallOverlay();
  }

  public static boolean hasPermission(Context context) {
    return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context);
  }

  public void show(MurshidCallerInfo info, boolean incoming) {
    if (info == null) return;
    mainHandler.post(() -> showOnMainThread(info, incoming));
  }

  public void hide() {
    mainHandler.post(this::removeOverlay);
  }

  private void showOnMainThread(MurshidCallerInfo info, boolean incoming) {
    if (windowManager == null || !isEnabled(context) || !hasPermission(context)) {
      removeOverlay();
      return;
    }
    removeOverlay();
    View next = new MurshidCallScreenView(context, info.displayName, info.number, info.lineLabel, info.verified, incoming);
    int windowType = Build.VERSION.SDK_INT >= 26
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE;
    int flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        | WindowManager.LayoutParams.FLAG_FULLSCREEN
        | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.MATCH_PARENT,
        windowType,
        flags,
        PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.LEFT;
    params.setTitle("مُرشد · شاشة المكالمة بملء الشاشة");
    try {
      windowManager.addView(next, params);
      overlayView = next;
    } catch (RuntimeException ignored) {
      // The full-screen call Activity and Android's call notification remain the fallback.
      overlayView = null;
    }
  }

  private void removeOverlay() {
    if (overlayView == null || windowManager == null) return;
    try { windowManager.removeView(overlayView); } catch (RuntimeException ignored) { }
    overlayView = null;
  }
}
