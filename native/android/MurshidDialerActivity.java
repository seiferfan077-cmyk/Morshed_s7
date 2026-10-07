package com.murshid.s7;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.TelecomManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.Gravity;
import android.graphics.drawable.GradientDrawable;
import android.widget.ImageView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MurshidDialerActivity extends Activity {
  public static final String ACTION_INCOMING = "com.murshid.s7.INCOMING_CALL";
  public static final String ACTION_ONGOING = "com.murshid.s7.ONGOING_CALL";
  public static final String EXTRA_CALLER_NAME = "caller_name";
  public static final String EXTRA_LINE_LABEL = "line_label";
  public static final String EXTRA_VERIFIED = "verified";
  private EditText numberInput;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
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
      renderCallScreen("اتصال وارد إلى مُرشد", "رقم وارد", true);
    } else if (ACTION_ONGOING.equals(action)) {
      renderCallScreen("مكالمة مُرشد جارية", "المكالمة متصلة", false);
    } else {
      Uri data = intent == null ? null : intent.getData();
      renderDialPad(data == null ? "" : data.getSchemeSpecificPart());
    }
  }

  private void renderDialPad(String initialNumber) {
    LinearLayout root = baseLayout();
    TextView title = label("مُرشد · لوحة الاتصال", 26, Color.rgb(16, 33, 43));
    root.addView(title);
    numberInput = new EditText(this);
    numberInput.setText(initialNumber);
    numberInput.setHint("اكتب رقم الهاتف");
    numberInput.setTextSize(22);
    numberInput.setGravity(Gravity.CENTER);
    numberInput.setInputType(android.text.InputType.TYPE_CLASS_PHONE);
    root.addView(numberInput, new LinearLayout.LayoutParams(-1, 72));

    GridLayout keypad = new GridLayout(this);
    keypad.setColumnCount(3);
    String[] digits = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"};
    for (String digit : digits) {
      Button key = new Button(this);
      key.setText(digit);
      key.setTextSize(20);
      key.setOnClickListener(v -> numberInput.append(digit));
      GridLayout.LayoutParams params = new GridLayout.LayoutParams();
      params.width = 0;
      params.height = 64;
      params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
      keypad.addView(key, params);
    }
    root.addView(keypad);
    Button call = new Button(this);
    call.setText("اتصال");
    call.setOnClickListener(v -> placeCall());
    root.addView(call, new LinearLayout.LayoutParams(-1, 64));
    setContentView(root);
  }

  private void renderCallScreen(String titleText, String detailText, boolean incoming) {
    LinearLayout root = baseLayout();
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setGravity(Gravity.CENTER);
    card.setPadding(36, 30, 36, 30);
    GradientDrawable background = new GradientDrawable();
    background.setColor(Color.WHITE);
    background.setCornerRadius(34);
    card.setBackground(background);

    ImageView icon = new ImageView(this);
    icon.setImageResource(com.murshid.s7.R.mipmap.ic_launcher);
    card.addView(icon, new LinearLayout.LayoutParams(96, 96));
    card.addView(label(titleText, 24, Color.rgb(16, 33, 43)));

    String callerName = getIntent().getStringExtra(EXTRA_CALLER_NAME);
    String line = getIntent().getStringExtra(EXTRA_LINE_LABEL);
    boolean verified = getIntent().getBooleanExtra(EXTRA_VERIFIED, false);
    if (callerName == null || callerName.isEmpty()) callerName = detailText;
    TextView caller = label(callerName, 22, Color.rgb(45, 75, 83));
    card.addView(caller);
    if (verified) {
      TextView badge = label("✓ موثق لدى مُرشد", 14, Color.rgb(10, 132, 120));
      card.addView(badge);
    }
    card.addView(label("يرن عبر " + (line == null ? "خط الهاتف" : line), 14, Color.rgb(92, 113, 119)));
    Uri data = getIntent() == null ? null : getIntent().getData();
    if (data != null) card.addView(label(data.getSchemeSpecificPart(), 16, Color.rgb(92, 113, 119)));

    LinearLayout actions = new LinearLayout(this);
    actions.setGravity(Gravity.CENTER);
    if (incoming) {
      Button answer = new Button(this);
      answer.setText("رد");
      answer.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_ANSWER));
      actions.addView(answer);
      Button reject = new Button(this);
      reject.setText("رفض");
      reject.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_REJECT));
      actions.addView(reject);
    } else {
      Button hangup = new Button(this);
      hangup.setText("إنهاء المكالمة");
      hangup.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_HANGUP));
      actions.addView(hangup);
    }
    card.addView(actions);
    root.addView(card, new LinearLayout.LayoutParams(-1, -2));
    setContentView(root);
  }

  private LinearLayout baseLayout() {
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(48, 48, 48, 48);
    root.setBackgroundColor(Color.rgb(247, 250, 249));
    return root;
  }

  private TextView label(String text, int size, int color) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextSize(size);
    view.setTextColor(color);
    view.setGravity(Gravity.CENTER);
    view.setPadding(0, 18, 0, 18);
    return view;
  }

  private void placeCall() {
    String number = numberInput == null ? "" : numberInput.getText().toString().trim();
    if (number.isEmpty()) {
      Toast.makeText(this, "اكتب رقمًا أولًا", Toast.LENGTH_SHORT).show();
      return;
    }
    try {
      TelecomManager telecom = (TelecomManager) getSystemService(Context.TELECOM_SERVICE);
      telecom.placeCall(Uri.parse("tel:" + Uri.encode(number)), new Bundle());
    } catch (SecurityException error) {
      Toast.makeText(this, "يجب تفعيل مُرشد كتطبيق الهاتف الافتراضي ومنحه صلاحية الاتصال", Toast.LENGTH_LONG).show();
    }
  }

  private void sendCallAction(String action) {
    Intent intent = new Intent(this, MurshidInCallService.class);
    intent.setAction(action);
    startService(intent);
    if (MurshidInCallService.ACTION_REJECT.equals(action) || MurshidInCallService.ACTION_HANGUP.equals(action)) finish();
  }
}
