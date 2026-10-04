package com.murshid.s7;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.TelecomManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MurshidDialerActivity extends Activity {
  public static final String ACTION_INCOMING = "com.murshid.s7.INCOMING_CALL";
  public static final String ACTION_ONGOING = "com.murshid.s7.ONGOING_CALL";
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
    root.addView(label(titleText, 26, Color.rgb(16, 33, 43)));
    Uri data = getIntent() == null ? null : getIntent().getData();
    root.addView(label(data == null ? detailText : data.toString(), 20, Color.rgb(45, 75, 83)));
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
    root.addView(actions);
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
    if (ACTION_REJECT.equals(action) || MurshidInCallService.ACTION_HANGUP.equals(action)) finish();
  }
}
