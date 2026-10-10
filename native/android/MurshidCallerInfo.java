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
  public final String contactType;
  public final boolean savedContact;
  public final boolean favorite;
  public final boolean contactLookupAvailable;
  public final boolean verified;

  private MurshidCallerInfo(String number, String displayName, String lineLabel, String contactType,
      boolean savedContact, boolean favorite, boolean contactLookupAvailable, boolean verified) {
    this.number = number;
    this.displayName = displayName;
    this.lineLabel = lineLabel;
    this.contactType = contactType;
    this.savedContact = savedContact;
    this.favorite = favorite;
    this.contactLookupAvailable = contactLookupAvailable;
    this.verified = verified;
  }

  public static MurshidCallerInfo from(Context context, Call call) {
    Uri handle = call.getDetails() == null ? null : call.getDetails().getHandle();
    String number = handle == null ? "رقم غير معروف" : handle.getSchemeSpecificPart();
    ContactMatch contact = lookupContact(context, number);
    String lineLabel = resolveLineLabel(context, call);
    boolean verified = isVerified(context, number);
    return new MurshidCallerInfo(number, contact.name, lineLabel, contact.type,
        contact.saved, contact.favorite, contact.lookupAvailable, verified);
  }

  private static ContactMatch lookupContact(Context context, String number) {
    if (number == null || number.trim().isEmpty() || "رقم غير معروف".equals(number)
        || ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
      return ContactMatch.unknown(false);
    }
    Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number));
    String[] projection = {
      ContactsContract.PhoneLookup.DISPLAY_NAME,
      ContactsContract.CommonDataKinds.Phone.TYPE,
      ContactsContract.CommonDataKinds.Phone.LABEL,
      ContactsContract.Contacts.STARRED
    };
    try (Cursor cursor = context.getContentResolver().query(uri, projection, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        String name = cursor.getString(0);
        int typeValue = cursor.isNull(1) ? ContactsContract.CommonDataKinds.Phone.TYPE_OTHER : cursor.getInt(1);
        String customLabel = cursor.isNull(2) ? null : cursor.getString(2);
        CharSequence label = ContactsContract.CommonDataKinds.Phone.getTypeLabel(
            context.getResources(), typeValue, customLabel);
        boolean favorite = !cursor.isNull(3) && cursor.getInt(3) != 0;
        return new ContactMatch(name == null ? "" : name,
            label == null ? "هاتف" : label.toString(), true, favorite, true);
      }
    } catch (SecurityException ignored) {
      return ContactMatch.unknown(false);
    }
    return ContactMatch.unknown(true);
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

  private static final class ContactMatch {
    final String name;
    final String type;
    final boolean saved;
    final boolean favorite;
    final boolean lookupAvailable;
    ContactMatch(String name, String type, boolean saved, boolean favorite, boolean lookupAvailable) {
      this.name = name;
      this.type = type;
      this.saved = saved;
      this.favorite = favorite;
      this.lookupAvailable = lookupAvailable;
    }
    static ContactMatch unknown(boolean lookupAvailable) { return new ContactMatch("", "", false, false, lookupAvailable); }
  }
}
