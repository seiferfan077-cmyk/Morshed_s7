package com.murshid.s7;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MurshidCallOverlay {
  private static final String PREFERENCES = "murshid_call_overlay";
  private static final String ENABLED_KEY = "incoming_call_overlay_enabled";
  private static final String THEME_PREFERENCES = "murshid_theme";
  private final Context context;
  private final WindowManager windowManager;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private View overlayView;

  public MurshidCallOverlay(Context context) {
    this.context = context;
    this.windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
  }

  public static boolean isEnabled(Context context) {
    return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getBoolean(ENABLED_KEY, false);
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
    if (windowManager == null || !isEnabled(context) || !hasPermission(context) || isKeyguardLocked()) {
      removeOverlay();
      return;
    }
    removeOverlay();
    View next = incoming ? createIncomingView(info) : createOngoingView(info);
    int windowType = Build.VERSION.SDK_INT >= 26
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE;
    int flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
    int height = incoming ? WindowManager.LayoutParams.MATCH_PARENT : dp(82);
    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, height, windowType, flags, PixelFormat.TRANSLUCENT);
    params.gravity = incoming ? Gravity.CENTER : Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    params.y = incoming ? 0 : dp(28);
    params.setTitle("مُرشد · واجهة المكالمة العائمة");
    try {
      windowManager.addView(next, params);
      overlayView = next;
    } catch (RuntimeException ignored) {
      // Android can revoke the special access while the call is active; the system call notification remains available.
      overlayView = null;
    }
  }

  private boolean isKeyguardLocked() {
    KeyguardManager manager = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
    return manager != null && manager.isKeyguardLocked();
  }

  private View createIncomingView(MurshidCallerInfo info) {
    Palette palette = palette();
    FrameLayout backdrop = new FrameLayout(context);
    backdrop.setBackgroundColor(Color.argb(222, 4, 12, 16));
    backdrop.setClickable(true);

    LinearLayout card = vertical();
    card.setGravity(Gravity.CENTER_HORIZONTAL);
    card.setPadding(dp(22), dp(24), dp(22), dp(22));
    card.setBackground(round(palette.paper, palette.line, 26));
    FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
    cardParams.setMargins(dp(22), dp(44), dp(22), dp(36));
    backdrop.addView(card, cardParams);

    TextView heading = text("اتصال وارد إلى مُرشد", 16, palette.teal, Typeface.BOLD);
    heading.setGravity(Gravity.CENTER);
    card.addView(heading, margin(0, 0, 0, 10));

    String callerName = info.displayName == null || info.displayName.trim().isEmpty()
        ? (info.number == null || info.number.trim().isEmpty() ? "رقم غير معروف" : info.number)
        : info.displayName;
    TextView caller = text(callerName, 27, palette.ink, Typeface.BOLD);
    caller.setGravity(Gravity.CENTER);
    caller.setMaxLines(2);
    card.addView(caller, margin(0, 4, 0, 0));

    if (info.number != null && !info.number.trim().isEmpty() && !info.number.equals(callerName)) {
      TextView number = text(info.number, 17, palette.muted, Typeface.NORMAL);
      number.setGravity(Gravity.CENTER);
      card.addView(number, margin(0, 5, 0, 0));
    }
    if (info.verified) {
      TextView verified = text("✓ موثق لدى مُرشد", 13, palette.teal, Typeface.BOLD);
      verified.setGravity(Gravity.CENTER);
      card.addView(verified, margin(0, 8, 0, 0));
    }
    String line = info.lineLabel == null || info.lineLabel.trim().isEmpty() ? "خط الهاتف" : info.lineLabel;
    TextView sim = text("عبر  ◉  " + line, 14, palette.muted, Typeface.BOLD);
    sim.setGravity(Gravity.CENTER);
    card.addView(sim, margin(0, 12, 0, 0));

    TextView swipeHint = text("اسحب يمينًا للرد · يسارًا للرفض", 13, palette.muted, Typeface.NORMAL);
    swipeHint.setGravity(Gravity.CENTER);
    swipeHint.setPadding(0, dp(12), 0, dp(8));
    swipeHint.setOnTouchListener(new View.OnTouchListener() {
      private float startX;
      @Override public boolean onTouch(View view, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) { startX = event.getRawX(); return true; }
        if (event.getAction() == MotionEvent.ACTION_UP) {
          float delta = event.getRawX() - startX;
          if (delta > dp(65)) answerCall();
          else if (delta < -dp(65)) rejectCall();
          else view.performClick();
          return true;
        }
        return true;
      }
    });
    card.addView(swipeHint, new LinearLayout.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT));

    LinearLayout actions = new LinearLayout(context);
    actions.setOrientation(LinearLayout.HORIZONTAL);
    actions.setGravity(Gravity.CENTER);
    Button reject = actionButton("رفض المكالمة", Color.rgb(190, 65, 68), Color.WHITE);
    reject.setContentDescription("رفض المكالمة الواردة");
    reject.setOnClickListener(view -> rejectCall());
    Button answer = actionButton("الرد على المكالمة", palette.teal, palette.paper);
    answer.setContentDescription("الرد على المكالمة الواردة");
    answer.setOnClickListener(view -> answerCall());
    actions.addView(reject, new LinearLayout.LayoutParams(0, dp(54), 1));
    LinearLayout.LayoutParams answerParams = new LinearLayout.LayoutParams(0, dp(54), 1);
    answerParams.setMargins(dp(10), 0, 0, 0);
    actions.addView(answer, answerParams);
    card.addView(actions, margin(0, 8, 0, 0));

    TextView close = text("×", 30, Color.WHITE, Typeface.NORMAL);
    close.setGravity(Gravity.CENTER);
    close.setContentDescription("إخفاء واجهة المكالمة دون رفضها");
    close.setBackground(round(Color.argb(90, 255, 255, 255), Color.TRANSPARENT, 24));
    close.setOnClickListener(view -> hide());
    FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(dp(48), dp(48), Gravity.END | Gravity.TOP);
    closeParams.setMargins(0, dp(28), dp(14), 0);
    backdrop.addView(close, closeParams);
    return backdrop;
  }

  private View createOngoingView(MurshidCallerInfo info) {
    Palette palette = palette();
    LinearLayout root = new LinearLayout(context);
    root.setGravity(Gravity.CENTER_VERTICAL);
    root.setPadding(dp(14), dp(8), dp(10), dp(8));
    root.setBackground(round(palette.paper, palette.line, 22));
    root.setElevation(dp(12));

    String callerName = info.displayName == null || info.displayName.trim().isEmpty()
        ? (info.number == null || info.number.trim().isEmpty() ? "المكالمة" : info.number)
        : info.displayName;
    LinearLayout copy = vertical();
    copy.addView(text("مكالمة مُرشد جارية", 12, palette.teal, Typeface.BOLD));
    TextView caller = text(callerName, 15, palette.ink, Typeface.BOLD);
    caller.setMaxLines(1);
    copy.addView(caller, margin(0, 2, 0, 0));
    copy.setOnClickListener(view -> openCallScreen(info));
    root.addView(copy, new LinearLayout.LayoutParams(0, WindowManager.LayoutParams.WRAP_CONTENT, 1));

    Button open = actionButton("فتح", palette.softTeal, palette.ink);
    open.setContentDescription("فتح شاشة المكالمة");
    open.setOnClickListener(view -> openCallScreen(info));
    root.addView(open, new LinearLayout.LayoutParams(dp(62), dp(48)));

    Button hangup = actionButton("إنهاء", Color.rgb(190, 65, 68), Color.WHITE);
    hangup.setContentDescription("إنهاء المكالمة");
    LinearLayout.LayoutParams hangupParams = new LinearLayout.LayoutParams(dp(82), dp(48));
    hangupParams.setMargins(dp(8), 0, 0, 0);
    hangup.setOnClickListener(view -> {
      hide();
      MurshidInCallService.dispatchAction(MurshidInCallService.ACTION_HANGUP, false);
    });
    root.addView(hangup, hangupParams);

    TextView close = text("×", 24, palette.muted, Typeface.NORMAL);
    close.setGravity(Gravity.CENTER);
    close.setContentDescription("إخفاء واجهة المكالمة العائمة");
    close.setOnClickListener(view -> hide());
    LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(dp(36), dp(48));
    closeParams.setMargins(dp(3), 0, 0, 0);
    root.addView(close, closeParams);
    return root;
  }

  private void answerCall() {
    hide();
    MurshidInCallService.dispatchAction(MurshidInCallService.ACTION_ANSWER, false);
  }

  private void rejectCall() {
    hide();
    MurshidInCallService.dispatchAction(MurshidInCallService.ACTION_REJECT, false);
  }

  private void openCallScreen(MurshidCallerInfo info) {
    hide();
    Intent intent = new Intent(context, MurshidDialerActivity.class);
    intent.setAction(MurshidDialerActivity.ACTION_ONGOING);
    intent.putExtra(MurshidDialerActivity.EXTRA_CALLER_NAME, info.displayName);
    intent.putExtra(MurshidDialerActivity.EXTRA_LINE_LABEL, info.lineLabel);
    intent.putExtra(MurshidDialerActivity.EXTRA_VERIFIED, info.verified);
    intent.setData(Uri.parse("tel:" + Uri.encode(info.number == null ? "" : info.number)));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    try { context.startActivity(intent); } catch (RuntimeException ignored) { }
  }

  private void removeOverlay() {
    if (overlayView == null || windowManager == null) return;
    try { windowManager.removeView(overlayView); } catch (RuntimeException ignored) { }
    overlayView = null;
  }

  private Palette palette() {
    boolean dark = "dark".equals(context.getSharedPreferences(THEME_PREFERENCES, Context.MODE_PRIVATE)
        .getString("theme_mode", "light"));
    if (dark) return new Palette(Color.rgb(24, 39, 44), Color.rgb(235, 244, 242), Color.rgb(164, 184, 183),
        Color.rgb(89, 198, 179), Color.rgb(50, 72, 76), Color.rgb(38, 70, 69));
    return new Palette(Color.WHITE, Color.rgb(16, 33, 43), Color.rgb(92, 113, 119),
        Color.rgb(10, 132, 120), Color.rgb(214, 228, 224), Color.rgb(231, 244, 240));
  }

  private LinearLayout vertical() {
    LinearLayout view = new LinearLayout(context);
    view.setOrientation(LinearLayout.VERTICAL);
    return view;
  }

  private TextView text(String value, int size, int color, int style) {
    TextView view = new TextView(context);
    view.setText(value);
    view.setTextSize(size);
    view.setTextColor(color);
    view.setTypeface(Typeface.DEFAULT, style);
    return view;
  }

  private Button actionButton(String title, int background, int foreground) {
    Button button = new Button(context);
    button.setText(title);
    button.setTextSize(14);
    button.setTextColor(foreground);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setAllCaps(false);
    button.setPadding(dp(8), 0, dp(8), 0);
    button.setBackground(round(background, background, 16));
    return button;
  }

  private GradientDrawable round(int color, int strokeColor, int radius) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setColor(color);
    drawable.setCornerRadius(dp(radius));
    if (strokeColor != Color.TRANSPARENT) drawable.setStroke(dp(1), strokeColor);
    return drawable;
  }

  private LinearLayout.LayoutParams margin(int left, int top, int right, int bottom) {
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT);
    params.setMargins(dp(left), dp(top), dp(right), dp(bottom));
    return params;
  }

  private int dp(int value) {
    return Math.round(value * context.getResources().getDisplayMetrics().density);
  }

  private static final class Palette {
    final int paper;
    final int ink;
    final int muted;
    final int teal;
    final int line;
    final int softTeal;
    Palette(int paper, int ink, int muted, int teal, int line, int softTeal) {
      this.paper = paper;
      this.ink = ink;
      this.muted = muted;
      this.teal = teal;
      this.line = line;
      this.softTeal = softTeal;
    }
  }
}
