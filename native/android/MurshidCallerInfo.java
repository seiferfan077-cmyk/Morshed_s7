package com.murshid.s7;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.telecom.Call;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import androidx.core.content.ContextCompat;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public final class MurshidCallerInfo {
  public final String number;
  public final String displayName;
  public final String lineLabel;
  public final boolean verified;

  private MurshidCallerInfo(String number, String displayName, String lineLabel, boolean verified) {
    this.number = number;
    this.displayName = displayName;
    this.lineLabel = lineLabel;
    this.verified = verified;
  }

  public static MurshidCallerInfo from(Context context, Call call) {
    Uri handle = call.getDetails() == null ? null : call.getDetails().getHandle();
    String number = handle == null ? "رقم غير معروف" : handle.getSchemeSpecificPart();
    String displayName = resolveContactName(context, number);
    String lineLabel = resolveLineLabel(context, call);
    boolean verified = isVerified(context, number);
    return new MurshidCallerInfo(number, displayName, lineLabel, verified);
  }

  private static String resolveContactName(Context context, String number) {
    if (number == null || number.isEmpty() || ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return "";
    Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number));
    try (Cursor cursor = context.getContentResolver().query(uri, new String[] { ContactsContract.PhoneLookup.DISPLAY_NAME }, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
    } catch (SecurityException ignored) { }
    return "";
  }

  private static String resolveLineLabel(Context context, Call call) {
    PhoneAccountHandle handle = call.getDetails() == null ? null : call.getDetails().getAccountHandle();
    if (handle != null) {
      try {
        TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
        PhoneAccount account = telecom == null ? null : telecom.getPhoneAccount(handle);
        if (account != null && account.getLabel() != null && account.getLabel().length() > 0) return account.getLabel().toString();
      } catch (SecurityException ignored) { }
    }
    return "خط الهاتف";
  }

  private static boolean isVerified(Context context, String number) {
    Set<String> verified = context.getSharedPreferences("murshid_dialer", Context.MODE_PRIVATE).getStringSet("verified_numbers", Collections.emptySet());
    return verified.contains(normalize(number));
  }

  public static String normalize(String number) {
    return number == null ? "" : number.replaceAll("[^0-9+]", "");
  }

  public static void setVerified(Context context, String number, boolean verified) {
    Set<String> current = new HashSet<>(context.getSharedPreferences("murshid_dialer", Context.MODE_PRIVATE).getStringSet("verified_numbers", Collections.emptySet()));
    String normalized = normalize(number);
    if (verified) current.add(normalized); else current.remove(normalized);
    context.getSharedPreferences("murshid_dialer", Context.MODE_PRIVATE).edit().putStringSet("verified_numbers", current).apply();
  }
}
