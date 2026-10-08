package com.murshid.s7;

import android.Manifest;
import android.app.IntentService;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.telephony.SmsManager;
import android.text.TextUtils;

import java.util.ArrayList;

public final class MurshidRespondViaMessageService extends IntentService {
  public MurshidRespondViaMessageService() {
    super("MurshidRespondViaMessageService");
  }

  @Override
  protected void onHandleIntent(Intent intent) {
    if (intent == null || checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) return;
    Uri data = intent.getData();
    String address = data == null ? null : data.getSchemeSpecificPart();
    CharSequence textValue = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
    String text = textValue == null ? null : textValue.toString();
    if (TextUtils.isEmpty(address) || TextUtils.isEmpty(text)) return;

    SmsManager smsManager = Build.VERSION.SDK_INT >= 31
        ? getSystemService(SmsManager.class)
        : SmsManager.getDefault();
    if (smsManager == null) return;
    ArrayList<String> parts = smsManager.divideMessage(text);
    if (parts.size() > 1) {
      smsManager.sendMultipartTextMessage(address, null, parts, null, null);
    } else {
      smsManager.sendTextMessage(address, null, text, null, null);
    }
  }
}
