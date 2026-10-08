package com.murshid.s7;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.List;

public class MurshidDialerActivity extends Activity {
  public static final String ACTION_INCOMING = "com.murshid.s7.INCOMING_CALL";
  public static final String ACTION_ONGOING = "com.murshid.s7.ONGOING_CALL";
  public static final String EXTRA_CALLER_NAME = "caller_name";
  public static final String EXTRA_LINE_LABEL = "line_label";
  public static final String EXTRA_VERIFIED = "verified";
  private static final int TEAL = Color.rgb(10, 132, 120);
  private static final int INK = Color.rgb(16, 33, 43);
  private static final int MUTED = Color.rgb(92, 113, 119);
  private static final int PAPER = Color.rgb(255, 255, 255);
  private static final int SURFACE = Color.rgb(247, 250, 249);
  private static final int LINE = Color.rgb(214, 228, 224);
  private EditText numberInput;
  private PhoneAccountHandle selectedAccount;
  private float gestureStartX;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Window window = getWindow();
    window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    if (android.os.Build.VERSION.SDK_INT >= 27) window.setTurnScreenOn(true);
    render(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    render(intent);
  }

  private void render(Intent intent) {
    String action = intent == null ? null : intent.getAction();
    if (ACTION_INCOMING.equals(action)) {
      renderCallScreen("اتصال وارد إلى مُرشد", "اسحب للرد أو الرفض", true);
    } else if (ACTION_ONGOING.equals(action)) {
      renderCallScreen("مكالمة مُرشد جارية", "المكالمة متصلة", false);
    } else {
      Uri data = intent == null ? null : intent.getData();
      renderDialPad(data == null ? "" : data.getSchemeSpecificPart());
    }
  }

  private void renderDialPad(String initialNumber) {
    ScrollView scroll = new ScrollView(this);
    scroll.setBackgroundColor(SURFACE);
    LinearLayout root = vertical(24, 28, 24, 36);

    LinearLayout header = horizontal();
    LinearLayout headerCopy = vertical(0, 0, 0, 0);
    headerCopy.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1));
    headerCopy.addView(label("MURSHID PHONE", 12, TEAL, Typeface.BOLD));
    headerCopy.addView(label("لوحة الاتصال", 30, INK, Typeface.BOLD));
    headerCopy.addView(label("اتصل بسهولة واختر الشريحة المناسبة قبل بدء المكالمة.", 14, MUTED, Typeface.NORMAL));
    header.addView(headerCopy);
    TextView icon = label("☎", 28, TEAL, Typeface.BOLD);
    icon.setGravity(Gravity.CENTER);
    icon.setBackground(round(TEAL, 20));
    LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(58), dp(58));
    iconParams.gravity = Gravity.TOP;
    header.addView(icon, iconParams);
    root.addView(header);

    LinearLayout numberCard = card();
    TextView numberLabel = label("رقم الهاتف", 12, MUTED, Typeface.BOLD);
    numberCard.addView(numberLabel);
    numberInput = new EditText(this);
    numberInput.setText(initialNumber);
    numberInput.setHint("اكتب الرقم هنا");
    numberInput.setHintTextColor(Color.rgb(160, 177, 175));
    numberInput.setTextColor(INK);
    numberInput.setTextSize(26);
    numberInput.setGravity(Gravity.CENTER);
    numberInput.setSingleLine(true);
    numberInput.setInputType(android.text.InputType.TYPE_CLASS_PHONE);
    numberInput.setBackground(round(Color.rgb(244, 249, 247), 18));
    numberCard.addView(numberInput, new LinearLayout.LayoutParams(-1, dp(68)));
    root.addView(numberCard, marginParams(0, 22, 0, 0));

    TextView simHeading = label("اختر الشريحة", 16, INK, Typeface.BOLD);
    root.addView(simHeading, marginParams(0, 20, 0, 8));
    LinearLayout simRow = horizontal();
    simRow.setGravity(Gravity.CENTER_VERTICAL);
    addSimAccounts(simRow);
    root.addView(simRow);

    TextView keypadHeading = label("لوحة الأرقام", 16, INK, Typeface.BOLD);
    root.addView(keypadHeading, marginParams(0, 20, 0, 8));
    GridLayout keypad = new GridLayout(this);
    keypad.setColumnCount(3);
    keypad.setUseDefaultMargins(false);
    String[] digits = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"};
    for (String digit : digits) {
      Button key = keyButton(digit);
      key.setOnClickListener(v -> numberInput.append(digit));
      GridLayout.LayoutParams params = new GridLayout.LayoutParams();
      params.width = 0;
      params.height = dp(58);
      params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
      params.setMargins(dp(4), dp(4), dp(4), dp(4));
      keypad.addView(key, params);
    }
    root.addView(keypad);

    LinearLayout utilityRow = horizontal();
    Button clear = utilityButton("مسح الكل");
    clear.setOnClickListener(v -> numberInput.setText(""));
    Button backspace = utilityButton("⌫ حذف");
    backspace.setOnClickListener(v -> { int length = numberInput.length(); if (length > 0) numberInput.delete(length - 1, length); });
    utilityRow.addView(clear, new LinearLayout.LayoutParams(0, dp(44), 1));
    utilityRow.addView(backspace, new LinearLayout.LayoutParams(0, dp(44), 1));
    root.addView(utilityRow, marginParams(0, 6, 0, 0));

    Button call = new Button(this);
    call.setText("اتصال الآن  〉");
    call.setTextColor(PAPER);
    call.setTextSize(16);
    call.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    call.setAllCaps(false);
    call.setBackground(round(TEAL, 18));
    call.setOnClickListener(v -> placeCall());
    root.addView(call, marginParams(0, 20, 0, 0));

    TextView hint = label("يمكنك تغيير الشريحة قبل الضغط على اتصال.", 12, MUTED, Typeface.NORMAL);
    hint.setGravity(Gravity.CENTER);
    root.addView(hint, marginParams(0, 12, 0, 0));
    scroll.addView(root);
    setContentView(scroll);
  }

  private void addSimAccounts(LinearLayout row) {
    TelecomManager telecom = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
    List<PhoneAccountHandle> accounts = null;
    try { accounts = telecom.getCallCapablePhoneAccounts(); } catch (SecurityException ignored) { }
    if (accounts == null || accounts.isEmpty()) {
      Button unavailable = utilityButton("الشريحة الافتراضية");
      unavailable.setText("الشريحة الافتراضية");
      row.addView(unavailable, new LinearLayout.LayoutParams(-1, dp(48)));
      return;
    }
    for (int i = 0; i < accounts.size(); i++) {
      PhoneAccountHandle account = accounts.get(i);
      String label = "SIM " + (i + 1);
      try {
        CharSequence accountLabel = telecom.getPhoneAccount(account).getLabel();
        if (accountLabel != null && accountLabel.length() > 0) label = accountLabel.toString();
      } catch (Exception ignored) { }
      Button sim = utilityButton(label);
      if (selectedAccount == null) selectedAccount = account;
      boolean selected = selectedAccount == account;
      sim.setText((selected ? "✓ " : "") + label);
      sim.setTag(account);
      sim.setOnClickListener(v -> {
        selectedAccount = (PhoneAccountHandle) v.getTag();
        renderDialPad(numberInput == null ? "" : numberInput.getText().toString());
      });
      LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(48), 1);
      params.setMargins(dp(4), 0, dp(4), 0);
      row.addView(sim, params);
    }
  }

  private void renderCallScreen(String titleText, String detailText, boolean incoming) {
    LinearLayout root = vertical(24, 28, 24, 28);
    root.setGravity(Gravity.CENTER);
    GradientDrawable screenBackground = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { Color.rgb(7, 30, 39), Color.rgb(10, 102, 99), Color.rgb(16, 33, 43) });
    root.setBackground(screenBackground);
    root.addView(brandHeader(), marginParams(0, 0, 0, 18));
    TextView eyebrow = label(incoming ? "INCOMING CALL" : "ACTIVE CALL", 12, TEAL, Typeface.BOLD);
    eyebrow.setGravity(Gravity.CENTER);
    eyebrow.setBackground(round(Color.argb(42, 255, 255, 255), 16));
    eyebrow.setPadding(dp(14), dp(7), dp(14), dp(7));
    root.addView(eyebrow);
    LinearLayout card = card();
    card.setGravity(Gravity.CENTER);
    card.setPadding(dp(24), dp(26), dp(24), dp(26));
    ImageView icon = new ImageView(this);
    icon.setImageResource(com.murshid.s7.R.mipmap.ic_launcher);
    card.addView(icon, new LinearLayout.LayoutParams(dp(84), dp(84)));
    TextView title = label(titleText, 25, INK, Typeface.BOLD);
    title.setGravity(Gravity.CENTER);
    card.addView(title, marginParams(0, 14, 0, 0));
    String callerName = getIntent().getStringExtra(EXTRA_CALLER_NAME);
    String line = getIntent().getStringExtra(EXTRA_LINE_LABEL);
    boolean verified = getIntent().getBooleanExtra(EXTRA_VERIFIED, false);
    if (callerName == null || callerName.isEmpty()) callerName = detailText;
    TextView caller = label(callerName, 20, MUTED, Typeface.NORMAL);
    caller.setGravity(Gravity.CENTER);
    card.addView(caller, marginParams(0, 6, 0, 0));
    if (verified) {
      TextView badge = label("✓ موثق لدى مُرشد", 13, TEAL, Typeface.BOLD);
      badge.setGravity(Gravity.CENTER);
      card.addView(badge, marginParams(0, 8, 0, 0));
    }
    TextView lineText = label("عبر " + (line == null ? "خط الهاتف" : line), 13, MUTED, Typeface.NORMAL);
    lineText.setGravity(Gravity.CENTER);
    card.addView(lineText, marginParams(0, 8, 0, 0));

    if (incoming) {
      TextView swipeHint = label("اسحب الزر يمينًا للرد أو يسارًا للرفض", 13, MUTED, Typeface.NORMAL);
      swipeHint.setGravity(Gravity.CENTER);
      card.addView(swipeHint, marginParams(0, 18, 0, 10));
      LinearLayout swipeRail = horizontal();
      swipeRail.setGravity(Gravity.CENTER_VERTICAL);
      swipeRail.setBackground(round(Color.rgb(241, 246, 244), 28));
      TextView reject = label("رفض", 14, Color.rgb(190, 65, 68), Typeface.BOLD);
      reject.setGravity(Gravity.CENTER);
      TextView swipe = label("↔  اسحب", 15, PAPER, Typeface.BOLD);
      swipe.setGravity(Gravity.CENTER);
      swipe.setBackground(round(TEAL, 26));
      TextView answer = label("رد  ✓", 14, TEAL, Typeface.BOLD);
      answer.setGravity(Gravity.CENTER);
      swipeRail.addView(reject, new LinearLayout.LayoutParams(0, dp(54), 1));
      swipeRail.addView(swipe, new LinearLayout.LayoutParams(dp(110), dp(54)));
      swipeRail.addView(answer, new LinearLayout.LayoutParams(0, dp(54), 1));
      swipeRail.setOnTouchListener((v, event) -> {
        if (event.getAction() == MotionEvent.ACTION_DOWN) { gestureStartX = event.getRawX(); return true; }
        if (event.getAction() == MotionEvent.ACTION_UP) {
          float delta = event.getRawX() - gestureStartX;
          if (delta > dp(70)) sendCallAction(MurshidInCallService.ACTION_ANSWER);
          else if (delta < -dp(70)) sendCallAction(MurshidInCallService.ACTION_REJECT);
          else Toast.makeText(this, "اسحب الزر يمينًا أو يسارًا", Toast.LENGTH_SHORT).show();
          return true;
        }
        return true;
      });
      card.addView(swipeRail, new LinearLayout.LayoutParams(-1, dp(54)));
      Button answerButton = actionButton("الرد على المكالمة", TEAL);
      answerButton.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_ANSWER));
      card.addView(answerButton, marginParams(0, 14, 0, 0));
      Button rejectButton = actionButton("رفض وإيقاف الرنين", Color.rgb(190, 65, 68));
      rejectButton.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_REJECT));
      card.addView(rejectButton, marginParams(0, 8, 0, 0));
    } else {
      Button hangup = actionButton("إنهاء المكالمة", Color.rgb(190, 65, 68));
      hangup.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_HANGUP));
      card.addView(hangup, marginParams(0, 24, 0, 0));
    }
    root.addView(card, new LinearLayout.LayoutParams(-1, -2));
    setContentView(root);
  }

  private LinearLayout brandHeader() {
    LinearLayout header = vertical(0, 0, 0, 0);
    header.setGravity(Gravity.CENTER);
    ImageView logo = new ImageView(this);
    logo.setImageResource(com.murshid.s7.R.mipmap.ic_launcher);
    logo.setBackground(round(Color.WHITE, 18));
    header.addView(logo, new LinearLayout.LayoutParams(dp(54), dp(54)));
    TextView brand = label("مُرشد", 25, Color.WHITE, Typeface.BOLD);
    brand.setGravity(Gravity.CENTER);
    header.addView(brand, marginParams(0, 7, 0, 0));
    TextView caption = label("اتصال آمن وواضح", 12, Color.rgb(202, 239, 233), Typeface.NORMAL);
    caption.setGravity(Gravity.CENTER);
    header.addView(caption, marginParams(0, 2, 0, 0));
    return header;
  }

  private void placeCall() {
    String number = numberInput == null ? "" : numberInput.getText().toString().trim();
    if (number.isEmpty()) { Toast.makeText(this, "اكتب رقمًا أولًا", Toast.LENGTH_SHORT).show(); return; }
    try {
      TelecomManager telecom = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
      Bundle extras = new Bundle();
      if (selectedAccount != null) extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, selectedAccount);
      telecom.placeCall(Uri.parse("tel:" + Uri.encode(number)), extras);
    } catch (SecurityException error) {
      Toast.makeText(this, "فعّل مُرشد كتطبيق الهاتف الافتراضي وامنحه صلاحية الاتصال", Toast.LENGTH_LONG).show();
    }
  }

  private void sendCallAction(String action) {
    Intent intent = new Intent(this, MurshidInCallService.class);
    intent.setAction(action);
    startService(intent);
    finish();
  }

  private Button keyButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextSize(20);
    button.setTextColor(INK);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setAllCaps(false);
    button.setBackground(round(PAPER, 18));
    return button;
  }

  private Button utilityButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextColor(TEAL);
    button.setTextSize(13);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setAllCaps(false);
    button.setBackground(round(Color.rgb(231, 244, 240), 16));
    return button;
  }

  private Button actionButton(String text, int color) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextColor(PAPER);
    button.setTextSize(15);
    button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
    button.setAllCaps(false);
    button.setBackground(round(color, 18));
    return button;
  }

  private LinearLayout card() {
    LinearLayout view = vertical(18, 18, 18, 18);
    view.setBackground(round(PAPER, 24));
    return view;
  }

  private LinearLayout vertical(int left, int top, int right, int bottom) {
    LinearLayout view = new LinearLayout(this);
    view.setOrientation(LinearLayout.VERTICAL);
    view.setPadding(dp(left), dp(top), dp(right), dp(bottom));
    return view;
  }

  private LinearLayout horizontal() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); return view; }

  private TextView label(String text, int size, int color, int style) { TextView view = new TextView(this); view.setText(text); view.setTextSize(size); view.setTextColor(color); view.setTypeface(Typeface.DEFAULT, style); return view; }

  private GradientDrawable round(int color, int radius) { GradientDrawable drawable = new GradientDrawable(); drawable.setColor(color); drawable.setCornerRadius(dp(radius)); return drawable; }

  private LinearLayout.LayoutParams marginParams(int left, int top, int right, int bottom) { LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2); params.setMargins(dp(left), dp(top), dp(right), dp(bottom)); return params; }

  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
