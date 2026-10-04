package com.murshid.s7;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MurshidDialerActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(48, 48, 48, 48);
    root.setBackgroundColor(Color.rgb(247, 250, 249));
    TextView title = new TextView(this);
    title.setText("مُرشد · شاشة الاتصال");
    title.setTextSize(26);
    title.setTextColor(Color.rgb(16, 33, 43));
    title.setGravity(Gravity.CENTER);
    TextView number = new TextView(this);
    Uri data = getIntent() == null ? null : getIntent().getData();
    number.setText(data == null ? "اتصال وارد" : data.toString());
    number.setTextSize(20);
    number.setTextColor(Color.rgb(45, 75, 83));
    number.setGravity(Gravity.CENTER);
    number.setPadding(0, 24, 0, 24);
    LinearLayout actions = new LinearLayout(this);
    actions.setGravity(Gravity.CENTER);
    Button answer = new Button(this);
    answer.setText("رد");
    answer.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_ANSWER));
    Button reject = new Button(this);
    reject.setText("رفض");
    reject.setOnClickListener(v -> sendCallAction(MurshidInCallService.ACTION_REJECT));
    actions.addView(answer);
    actions.addView(reject);
    root.addView(title);
    root.addView(number);
    root.addView(actions);
    setContentView(root);
  }

  private void sendCallAction(String action) {
    Intent intent = new Intent(this, MurshidInCallService.class);
    intent.setAction(action);
    startService(intent);
    finish();
  }
}
