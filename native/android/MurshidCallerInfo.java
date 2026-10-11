package com.murshid.s7;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.provider.Telephony;
import android.telecom.Call;
import android.telecom.PhoneAccount;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import androidx.core.content.ContextCompat;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;

public final class MurshidCallerInfo {
  public final String number;
  public final String displayName;
  public final String lineLabel;
  public final String contactType;
  public final boolean savedContact;
  public final boolean favorite;
  public final boolean contactLookupAvailable;
  public final boolean verified;
  public final String recentCallSummary;
  public final String recentSmsSummary;

  private MurshidCallerInfo(String number, String displayName, String lineLabel, String contactType,
      boolean savedContact, boolean favorite, boolean contactLookupAvailable, boolean verified,
      String recentCallSummary, String recentSmsSummary) {
    this.number = number;
    this.displayName = displayName;
    this.lineLabel = lineLabel;
    this.contactType = contactType;
    this.savedContact = savedContact;
    this.favorite = favorite;
    this.contactLookupAvailable = contactLookupAvailable;
    this.verified = verified;
    this.recentCallSummary = recentCallSummary;
    this.recentSmsSummary = recentSmsSummary;
  }

  public static MurshidCallerInfo from(Context context, Call call) {
    Uri handle = call.getDetails() == null ? null : call.getDetails().getHandle();
    String number = handle == null ? "رقم غير معروف" : handle.getSchemeSpecificPart();
    ContactMatch contact = lookupContact(context, number);
    String lineLabel = resolveLineLabel(context, call);
    boolean verified = isVerified(context, number);
    String recentCallSummary = recentCalls(context, number);
    String recentSmsSummary = recentSms(context, number);
    return new MurshidCallerInfo(number, contact.name, lineLabel, contact.type,
        contact.saved, contact.favorite, contact.lookupAvailable, verified,
        recentCallSummary, recentSmsSummary);
  }

  private static String recentCalls(Context context, String number) {
    if (number == null || number.trim().isEmpty() || "رقم غير معروف".equals(number)
        || ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
      return "لا يتوفر إذن سجل المكالمات";
    }
    Uri uri = Uri.withAppendedPath(CallLog.Calls.CONTENT_FILTER_URI, Uri.encode(number))
        .buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, "3").build();
    String[] projection = { CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION };
    List<String> events = new ArrayList<>();
    try (Cursor cursor = context.getContentResolver().query(uri, projection, null, null, CallLog.Calls.DEFAULT_SORT_ORDER)) {
      if (cursor != null) {
        while (cursor.moveToNext()) {
          int type = cursor.getInt(0);
          long date = cursor.getLong(1);
          String kind = type == CallLog.Calls.MISSED_TYPE ? "فائتة"
              : type == CallLog.Calls.OUTGOING_TYPE ? "صادرة"
              : type == CallLog.Calls.REJECTED_TYPE ? "مرفوضة" : "واردة";
          events.add(kind + " · " + relativeTime(date));
        }
      }
      return events.isEmpty() ? "لا توجد مكالمات سابقة مسجلة" : "آخر المكالمات: " + join(events, "، ");
    } catch (SecurityException ignored) {
      return "لا يتوفر إذن سجل المكالمات";
    } catch (RuntimeException ignored) {
      return "تعذر قراءة سجل المكالمات";
    }
  }

  private static String recentSms(Context context, String number) {
    if (number == null || number.trim().isEmpty() || "رقم غير معروف".equals(number)
        || ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
      return "لا تتوفر صلاحية قراءة الرسائل";
    }
    String[] projection = { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
    List<String> snippets = new ArrayList<>();
    String target = MurshidCallerInfo.normalize(number);
    try (Cursor cursor = context.getContentResolver().query(Telephony.Sms.Inbox.CONTENT_URI,
        projection, null, null, Telephony.Sms.DEFAULT_SORT_ORDER + " LIMIT 100")) {
      if (cursor != null) {
        int addressIndex = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
        int bodyIndex = cursor.getColumnIndex(Telephony.Sms.BODY);
        int dateIndex = cursor.getColumnIndex(Telephony.Sms.DATE);
        while (cursor.moveToNext() && snippets.size() < 2) {
          String address = addressIndex < 0 || cursor.isNull(addressIndex) ? "" : cursor.getString(addressIndex);
          if (!target.equals(MurshidCallerInfo.normalize(address))) continue;
          String body = bodyIndex < 0 || cursor.isNull(bodyIndex) ? "" : cursor.getString(bodyIndex);
          body = body.replaceAll("\\s+", " ").trim();
          if (body.length() > 68) body = body.substring(0, 67) + "…";
          long date = dateIndex < 0 ? 0L : cursor.getLong(dateIndex);
          snippets.add("“" + body + "” · " + relativeTime(date));
        }
      }
      return snippets.isEmpty() ? "لا توجد رسائل SMS سابقة من هذا الرقم"
          : "آخر الرسائل: " + join(snippets, "  |  ");
    } catch (SecurityException ignored) {
      return "لا تتوفر صلاحية قراءة الرسائل";
    } catch (RuntimeException ignored) {
      return "تعذر قراءة الرسائل";
    }
  }

  private static String relativeTime(long timestamp) {
    if (timestamp <= 0L) return "وقت غير معروف";
    long minutes = Math.max(0L, (System.currentTimeMillis() - timestamp) / 60000L);
    if (minutes < 1L) return "الآن";
    if (minutes < 60L) return "منذ " + minutes + " د";
    long hours = minutes / 60L;
    if (hours < 24L) return "منذ " + hours + " س";
    long days = hours / 24L;
    return days == 1L ? "أمس" : "منذ " + days + " يوم";
  }

  private static String join(List<String> values, String separator) {
    StringBuilder builder = new StringBuilder();
    for (String value : values) {
      if (builder.length() > 0) builder.append(separator);
      builder.append(value);
    }
    return builder.toString();
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
