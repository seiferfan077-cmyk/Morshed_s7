package com.murshid.s7;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

import static android.view.ViewGroup.LayoutParams.MATCH_PARENT;
import static android.view.ViewGroup.LayoutParams.WRAP_CONTENT;

/** A shared full-screen call surface used by both the system call Activity and the floating overlay. */
public final class MurshidCallScreenView extends LinearLayout {
  private static final int BACKGROUND_TOP = Color.rgb(9, 8, 9);
  private static final int BACKGROUND_BOTTOM = Color.rgb(39, 24, 21);
  private static final int PANEL = Color.rgb(31, 22, 21);
  private static final int PANEL_LINE = Color.rgb(83, 53, 47);
  private static final int BURGUNDY = Color.rgb(156, 31, 57);
  private static final int BURGUNDY_LIGHT = Color.rgb(210, 61, 83);
  private static final int GREEN = Color.rgb(35, 153, 104);
  private static final int WHITE = Color.rgb(250, 247, 246);
  private static final int MUTED = Color.rgb(190, 174, 169);

  private final Handler timerHandler = new Handler(Looper.getMainLooper());
  private final long connectedAtMillis;
  private TextView durationText;
  private final Runnable durationTicker = new Runnable() {
    @Override public void run() {
      if (durationText == null) return;
      long elapsed = Math.max(0L, System.currentTimeMillis() - connectedAtMillis) / 1000L;
      durationText.setText(String.format(Locale.ROOT, "%02d:%02d", elapsed / 60L, elapsed % 60L));
      timerHandler.postDelayed(this, 1000L);
    }
  };

  public MurshidCallScreenView(Context context, String name, String number, String line, boolean verified, boolean incoming) {
    super(context);
    connectedAtMillis = incoming ? 0L : connectedAt();
    setOrientation(VERTICAL);
    setGravity(Gravity.CENTER_HORIZONTAL);
    setPadding(dp(26), dp(22), dp(26), dp(22));
    setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,
        new int[] { BACKGROUND_TOP, Color.rgb(19, 13, 14), BACKGROUND_BOTTOM }));
    setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);

    String safeNumber = clean(number) ? number : "رقم غير معروف";
    String safeName = clean(name) ? name : safeNumber;
    String safeLine = clean(line) ? line : "خط الهاتف";

    TextView brand = text("مُرشد", 23, WHITE, Typeface.BOLD);
    brand.setContentDescription("تطبيق مُرشد للمكالمات");
    addView(brand, params(WRAP_CONTENT, dp(31), 0, 0));
    TextView tagline = text(incoming ? "اتصال وارد الآن" : "مكالمة مُرشد جارية", 13, MUTED, Typeface.NORMAL);
    addView(tagline, params(WRAP_CONTENT, dp(24), 0, dp(7)));

    TextView status = text(incoming ? "الرد أو الرفض الآن" : "متصل عبر " + safeLine, 14, WHITE, Typeface.BOLD);
    status.setBackground(rounded(Color.argb(38, 255, 255, 255), PANEL_LINE, 20));
    status.setPadding(dp(16), dp(7), dp(16), dp(7));
    status.setGravity(Gravity.CENTER);
    addView(status, params(WRAP_CONTENT, WRAP_CONTENT, 0, dp(12)));

    FrameLayout avatar = new FrameLayout(context);
    GradientDrawable avatarGlow = oval(Color.argb(26, 210, 61, 83), Color.argb(110, 210, 61, 83));
    avatar.setBackground(avatarGlow);
    avatar.setElevation(dp(8));
    FrameLayout.LayoutParams personParams = new FrameLayout.LayoutParams(dp(76), dp(76), Gravity.CENTER);
    View person = new PersonIconView(context);
    person.setContentDescription("أيقونة شخص المتصل");
    avatar.addView(person, personParams);
    addView(avatar, params(dp(108), dp(108), 0, dp(10)));

    TextView callerName = text(safeName, 29, WHITE, Typeface.BOLD);
    callerName.setGravity(Gravity.CENTER);
    callerName.setMaxLines(2);
    addView(callerName, params(MATCH_PARENT, WRAP_CONTENT, 0, dp(3)));

    if (!safeNumber.equals(safeName)) {
      TextView callerNumber = text(safeNumber, 17, MUTED, Typeface.NORMAL);
      callerNumber.setTextDirection(View.TEXT_DIRECTION_LTR);
      callerNumber.setGravity(Gravity.CENTER);
      callerNumber.setMaxLines(1);
      addView(callerNumber, params(MATCH_PARENT, WRAP_CONTENT, 0, dp(4)));
    }

    LinearLayout details = new LinearLayout(context);
    details.setGravity(Gravity.CENTER);
    TextView sim = text("◉  " + safeLine, 13, MUTED, Typeface.NORMAL);
    details.addView(sim);
    if (verified) {
      TextView trusted = text("   ✓ موثق", 13, BURGUNDY_LIGHT, Typeface.BOLD);
      details.addView(trusted);
    }
    addView(details, params(MATCH_PARENT, dp(23), 0, dp(4)));

    TextView waveLabel = text(incoming ? "موجة الاتصال" : "صوت المكالمة", 12, MUTED, Typeface.NORMAL);
    addView(waveLabel, params(WRAP_CONTENT, dp(20), 0, 0));
    WaveformView waveform = new WaveformView(context, incoming);
    waveform.setContentDescription("موجة متحركة لحالة المكالمة");
    addView(waveform, params(MATCH_PARENT, dp(56), 0, dp(5)));

    if (incoming) {
      TextView prompt = text("اسحب للرد أو الرفض، أو استخدم الأزرار", 13, MUTED, Typeface.NORMAL);
      addView(prompt, params(MATCH_PARENT, dp(23), 0, dp(7)));

      LinearLayout swipeRows = new LinearLayout(context);
      swipeRows.setOrientation(VERTICAL);
      swipeRows.setGravity(Gravity.CENTER_HORIZONTAL);
      SwipeRail answerRail = new SwipeRail(context, true);
      SwipeRail rejectRail = new SwipeRail(context, false);
      swipeRows.addView(answerRail, params(MATCH_PARENT, dp(52), 0, dp(7)));
      swipeRows.addView(rejectRail, params(MATCH_PARENT, dp(52), 0, 0));
      addView(swipeRows, params(MATCH_PARENT, WRAP_CONTENT, 0, dp(10)));

      LinearLayout buttons = new LinearLayout(context);
      buttons.setGravity(Gravity.CENTER);
      buttons.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
      buttons.addView(action("☎", "رد", BURGUNDY, BURGUNDY_LIGHT, false, () -> dispatch(MurshidInCallService.ACTION_ANSWER)),
          params(dp(108), dp(96), dp(10), 0));
      buttons.addView(action("☎", "رفض", GREEN, Color.rgb(70, 202, 145), true, () -> dispatch(MurshidInCallService.ACTION_REJECT)),
          params(dp(108), dp(96), dp(10), 0));
      addView(buttons, params(WRAP_CONTENT, dp(96), 0, 0));
    } else {
      durationText = text("00:00", 26, WHITE, Typeface.BOLD);
      durationText.setContentDescription("مدة المكالمة");
      addView(durationText, params(WRAP_CONTENT, dp(38), 0, dp(12)));

      LinearLayout controls = new LinearLayout(context);
      controls.setGravity(Gravity.CENTER);
      controls.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
      controls.addView(control("🎙", "كتم", MurshidInCallService.isMuted(), () -> {
        boolean next = !MurshidInCallService.isMuted();
        dispatch(MurshidInCallService.ACTION_SET_MUTED, next);
      }), params(0, dp(92), dp(3), 0, 1));
      controls.addView(control("◖))", "مكبر الصوت", MurshidInCallService.isSpeakerOn(), () -> {
        boolean next = !MurshidInCallService.isSpeakerOn();
        dispatch(MurshidInCallService.ACTION_SET_SPEAKER, next);
      }), params(0, dp(92), dp(3), 0, 1));
      controls.addView(control("☎", "إنهاء", false, () -> dispatch(MurshidInCallService.ACTION_HANGUP)),
          params(0, dp(92), dp(3), 0, 1));
      addView(controls, params(MATCH_PARENT, dp(92), 0, 0));
    }

    TextView footer = text("اتصالك عبر مُرشد", 11, Color.rgb(143, 126, 122), Typeface.NORMAL);
    addView(footer, params(WRAP_CONTENT, dp(20), 0, 0));
  }

  private static boolean clean(String value) { return value != null && !value.trim().isEmpty(); }

  private long connectedAt() {
    long value = MurshidInCallService.getConnectedAtMillis();
    return value > 0L ? value : System.currentTimeMillis();
  }

  private void dispatch(String action) { dispatch(action, false); }
  private void dispatch(String action, boolean enabled) {
    if (!MurshidInCallService.dispatchAction(action, enabled)) {
      Toast.makeText(getContext(), "تعذر تنفيذ الإجراء؛ أعد فتح شاشة المكالمة", Toast.LENGTH_SHORT).show();
    }
  }

  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    if (durationText != null) {
      timerHandler.removeCallbacks(durationTicker);
      durationTicker.run();
    }
  }

  @Override protected void onDetachedFromWindow() {
    timerHandler.removeCallbacks(durationTicker);
    super.onDetachedFromWindow();
  }

  private View action(String glyph, String label, int color, int glyphColor, boolean rotate, Runnable onClick) {
    LinearLayout item = new LinearLayout(getContext());
    item.setOrientation(VERTICAL);
    item.setGravity(Gravity.CENTER);
    FrameLayout circle = new FrameLayout(getContext());
    circle.setBackground(oval(color, Color.argb(110, 255, 255, 255)));
    circle.setElevation(dp(7));
    TextView icon = text(glyph, 29, glyphColor, Typeface.BOLD);
    icon.setGravity(Gravity.CENTER);
    if (rotate) icon.setRotation(135f);
    circle.addView(icon, new FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT));
    circle.setOnClickListener(view -> onClick.run());
    circle.setContentDescription(label + " المكالمة");
    item.addView(circle, new LinearLayout.LayoutParams(dp(62), dp(62)));
    TextView caption = text(label, 14, WHITE, Typeface.BOLD);
    item.addView(caption, params(MATCH_PARENT, dp(25), dp(5), 0));
    item.setOnClickListener(view -> onClick.run());
    item.setContentDescription(label + " المكالمة");
    item.setFocusable(true);
    return item;
  }

  private View control(String glyph, String label, boolean active, Runnable onClick) {
    LinearLayout item = new LinearLayout(getContext());
    item.setOrientation(VERTICAL);
    item.setGravity(Gravity.CENTER);
    boolean[] selected = { active };
    FrameLayout circle = new FrameLayout(getContext());
    TextView icon = text(glyph, 22, active ? BURGUNDY_LIGHT : WHITE, Typeface.BOLD);
    icon.setGravity(Gravity.CENTER);
    if ("إنهاء".equals(label)) icon.setRotation(135f);
    circle.addView(icon, new FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT));
    item.addView(circle, new LinearLayout.LayoutParams(dp(54), dp(54)));
    TextView caption = text(controlCaption(label, active), 11, active ? BURGUNDY_LIGHT : MUTED, Typeface.BOLD);
    caption.setMaxLines(2);
    item.addView(caption, params(MATCH_PARENT, dp(28), dp(5), 0));
    Runnable repaint = () -> {
      circle.setBackground(oval(selected[0] ? Color.rgb(78, 49, 43) : PANEL,
          selected[0] ? BURGUNDY_LIGHT : PANEL_LINE));
      icon.setTextColor(selected[0] ? BURGUNDY_LIGHT : WHITE);
      caption.setText(controlCaption(label, selected[0]));
      caption.setTextColor(selected[0] ? BURGUNDY_LIGHT : MUTED);
      item.setContentDescription(controlCaption(label, selected[0]));
    };
    repaint.run();
    item.setContentDescription(controlCaption(label, active));
    item.setOnClickListener(view -> {
      if (!"إنهاء".equals(label)) {
        selected[0] = !selected[0];
        repaint.run();
      }
      onClick.run();
    });
    circle.setOnClickListener(view -> item.performClick());
    item.setFocusable(true);
    return item;
  }

  private String controlCaption(String label, boolean active) {
    if ("كتم".equals(label)) return active ? "إلغاء الكتم" : "كتم";
    if ("مكبر الصوت".equals(label)) return active ? "إيقاف السبيكر" : "مكبر الصوت";
    return label;
  }

  private TextView text(String value, int size, int color, int style) {
    TextView view = new TextView(getContext());
    view.setText(value);
    view.setTextSize(size);
    view.setTextColor(color);
    view.setTypeface(Typeface.create("sans-serif", style));
    view.setGravity(Gravity.CENTER);
    view.setIncludeFontPadding(false);
    return view;
  }

  private LinearLayout.LayoutParams params(int width, int height, int marginStart, int marginBottom) {
    LinearLayout.LayoutParams value = new LinearLayout.LayoutParams(width, height);
    value.setMargins(marginStart, 0, marginStart, marginBottom);
    return value;
  }

  private LinearLayout.LayoutParams params(int width, int height, int left, int top, int right, int bottom) {
    LinearLayout.LayoutParams value = new LinearLayout.LayoutParams(width, height);
    value.setMargins(left, top, right, bottom);
    return value;
  }

  private LinearLayout.LayoutParams params(int width, int height, int margin, int bottom, float weight) {
    LinearLayout.LayoutParams value = new LinearLayout.LayoutParams(width, height, weight);
    value.setMargins(margin, 0, margin, bottom);
    return value;
  }

  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

  private GradientDrawable rounded(int color, int border, int radiusDp) {
    GradientDrawable background = new GradientDrawable();
    background.setColor(color);
    background.setCornerRadius(dp(radiusDp));
    if (border != Color.TRANSPARENT) background.setStroke(dp(1), border);
    return background;
  }

  private GradientDrawable oval(int color, int border) {
    GradientDrawable background = rounded(color, border, 100);
    background.setShape(GradientDrawable.OVAL);
    return background;
  }

  private void answerBySwipe() { dispatch(MurshidInCallService.ACTION_ANSWER); }
  private void rejectBySwipe() { dispatch(MurshidInCallService.ACTION_REJECT); }

  private final class SwipeRail extends FrameLayout {
    private final boolean answer;
    private final TextView handle;
    private float downX;
    private float travel;

    SwipeRail(Context context, boolean answer) {
      super(context);
      this.answer = answer;
      int accent = answer ? BURGUNDY : GREEN;
      setBackground(rounded(Color.argb(34, Color.red(accent), Color.green(accent), Color.blue(accent)),
          Color.argb(130, Color.red(accent), Color.green(accent), Color.blue(accent)), 28));
      setClipChildren(true);
      setClipToPadding(true);
      TextView title = text(answer ? "اسحب يمينًا للرد" : "اسحب يسارًا للرفض", 14, WHITE, Typeface.BOLD);
      addView(title, new FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT));
      handle = text(answer ? "☎" : "×", 21, WHITE, Typeface.BOLD);
      handle.setRotation(answer ? 0f : 0f);
      handle.setBackground(oval(accent, Color.argb(100, 255, 255, 255)));
      handle.setElevation(dp(3));
      handle.setContentDescription(answer ? "اسحب يمينًا للرد" : "اسحب يسارًا للرفض");
      FrameLayout.LayoutParams handleParams = new FrameLayout.LayoutParams(dp(42), dp(42),
          answer ? Gravity.LEFT | Gravity.CENTER_VERTICAL : Gravity.RIGHT | Gravity.CENTER_VERTICAL);
      handleParams.setMargins(dp(5), 0, dp(5), 0);
      addView(handle, handleParams);
      setOnTouchListener((view, event) -> {
        switch (event.getActionMasked()) {
          case MotionEvent.ACTION_DOWN:
            downX = event.getRawX();
            travel = Math.max(dp(70), getWidth() - handle.getWidth() - dp(16));
            return true;
          case MotionEvent.ACTION_MOVE:
            float delta = event.getRawX() - downX;
            float signed = answer ? Math.max(0, Math.min(travel, delta)) : Math.min(0, Math.max(-travel, delta));
            handle.setTranslationX(signed);
            return true;
          case MotionEvent.ACTION_UP:
            float distance = event.getRawX() - downX;
            boolean complete = answer ? distance >= Math.max(dp(72), travel * 0.46f) : distance <= -Math.max(dp(72), travel * 0.46f);
            if (complete) {
              if (answer) answerBySwipe(); else rejectBySwipe();
            } else {
              handle.animate().translationX(0f).setDuration(170L).start();
              performClick();
            }
            return true;
          case MotionEvent.ACTION_CANCEL:
            handle.animate().translationX(0f).setDuration(170L).start();
            return true;
          default:
            return true;
        }
      });
      setFocusable(true);
      setContentDescription(answer ? "اسحب يمينًا للرد على المكالمة" : "اسحب يسارًا لرفض المكالمة");
    }

    @Override public boolean performClick() {
      super.performClick();
      return true;
    }
  }

  private final class PersonIconView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final ValueAnimator animator;
    private float phase;

    PersonIconView(Context context) {
      super(context);
      animator = ValueAnimator.ofFloat(0f, (float) (Math.PI * 2));
      animator.setDuration(1450L);
      animator.setRepeatCount(ValueAnimator.INFINITE);
      animator.addUpdateListener(value -> { phase = (float) value.getAnimatedValue(); invalidate(); });
    }

    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); if (!animator.isStarted()) animator.start(); }
    @Override protected void onDetachedFromWindow() { animator.cancel(); super.onDetachedFromWindow(); }

    @Override protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      float cx = getWidth() * 0.5f;
      float cy = getHeight() * 0.5f + dp(3) * (float) Math.sin(phase * 2f);
      paint.setColor(WHITE);
      paint.setStyle(Paint.Style.FILL);
      canvas.drawCircle(cx + dp(2), cy - dp(22), dp(7), paint);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(dp(5));
      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setStrokeJoin(Paint.Join.ROUND);
      Path body = new Path();
      body.moveTo(cx + dp(2), cy - dp(13));
      body.quadTo(cx - dp(1), cy - dp(4), cx, cy + dp(5));
      canvas.drawPath(body, paint);
      float swing = (float) Math.sin(phase) * dp(8);
      Path arms = new Path();
      arms.moveTo(cx + dp(1), cy - dp(8));
      arms.lineTo(cx - dp(10), cy - dp(1) + swing * 0.35f);
      arms.moveTo(cx + dp(1), cy - dp(8));
      arms.lineTo(cx + dp(12), cy - dp(2) - swing * 0.35f);
      canvas.drawPath(arms, paint);
      Path legs = new Path();
      legs.moveTo(cx, cy + dp(5));
      legs.lineTo(cx - dp(9) - swing, cy + dp(22));
      legs.moveTo(cx, cy + dp(5));
      legs.lineTo(cx + dp(10) + swing, cy + dp(20));
      canvas.drawPath(legs, paint);
      paint.setStyle(Paint.Style.FILL);
    }
  }

  private final class WaveformView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final ValueAnimator animator;
    private final boolean ringing;
    private float phase;

    WaveformView(Context context, boolean ringing) {
      super(context);
      this.ringing = ringing;
      paint.setColor(Color.WHITE);
      animator = ValueAnimator.ofFloat(0f, (float) (Math.PI * 2));
      animator.setDuration(ringing ? 920L : 1260L);
      animator.setRepeatCount(ValueAnimator.INFINITE);
      animator.addUpdateListener(value -> { phase = (float) value.getAnimatedValue(); invalidate(); });
    }

    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); if (!animator.isStarted()) animator.start(); }
    @Override protected void onDetachedFromWindow() { animator.cancel(); super.onDetachedFromWindow(); }

    @Override protected void onDraw(Canvas canvas) {
      super.onDraw(canvas);
      int count = Math.max(19, Math.min(39, getWidth() / Math.max(1, dp(8))));
      float cell = (float) getWidth() / count;
      float width = Math.min(dp(4), cell * 0.55f);
      float centerY = getHeight() * 0.5f;
      float maxHeight = getHeight() * 0.78f;
      float middle = (count - 1) * 0.5f;
      for (int i = 0; i < count; i++) {
        float waveA = (float) Math.abs(Math.sin(phase * (ringing ? 2.6 : 2.0) + i * 0.43));
        float waveB = (float) Math.abs(Math.sin(phase * 1.27 - i * 0.26 + 0.8));
        float envelope = Math.max(0.22f, 1f - Math.abs(i - middle) / (count * 0.57f));
        float signal = 0.18f + 0.82f * (waveA * 0.68f + waveB * 0.32f) * envelope;
        float height = dp(5) + maxHeight * signal;
        float x = i * cell + (cell - width) * 0.5f;
        float alpha = 150f + signal * 105f;
        paint.setAlpha(Math.min(255, (int) alpha));
        canvas.drawRoundRect(x, centerY - height * 0.5f, x + width, centerY + height * 0.5f,
            width * 0.5f, width * 0.5f, paint);
      }
    }
  }
}
