package com.murshid.s7;

import android.Manifest;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.BaseColumns;
import android.provider.Telephony;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

public final class MurshidSmsModule extends ReactContextBaseJavaModule {
  public MurshidSmsModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "MurshidSms";
  }

  @ReactMethod
  public void isDefaultSmsApp(Promise promise) {
    try {
      String defaultPackage = Telephony.Sms.getDefaultSmsPackage(getReactApplicationContext());
      promise.resolve(getReactApplicationContext().getPackageName().equals(defaultPackage));
    } catch (RuntimeException error) {
      promise.reject("E_SMS_ROLE", "تعذر التحقق من تطبيق الرسائل الافتراضي", error);
    }
  }

  @ReactMethod
  public void getMessages(Promise promise) {
    ReactApplicationContext context = getReactApplicationContext();
    if (!isDefaultSmsApp(context)) {
      promise.reject("E_NOT_DEFAULT_SMS", "يجب تعيين مُرشد تطبيق الرسائل الافتراضي أولًا");
      return;
    }
    if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_SMS_PERMISSION", "إذن قراءة SMS غير ممنوح");
      return;
    }

    String[] projection = {
      BaseColumns._ID,
      Telephony.Sms.ADDRESS,
      Telephony.Sms.BODY,
      Telephony.Sms.DATE,
      Telephony.Sms.READ,
      Telephony.Sms.THREAD_ID
    };
    WritableArray messages = Arguments.createArray();
    try (Cursor cursor = context.getContentResolver().query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        null,
        null,
        Telephony.Sms.DEFAULT_SORT_ORDER + " LIMIT 250")) {
      if (cursor != null) {
        int idColumn = cursor.getColumnIndex(BaseColumns._ID);
        int addressColumn = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
        int bodyColumn = cursor.getColumnIndex(Telephony.Sms.BODY);
        int dateColumn = cursor.getColumnIndex(Telephony.Sms.DATE);
        int readColumn = cursor.getColumnIndex(Telephony.Sms.READ);
        int threadColumn = cursor.getColumnIndex(Telephony.Sms.THREAD_ID);
        while (cursor.moveToNext()) {
          WritableMap message = Arguments.createMap();
          message.putString("id", idColumn < 0 ? "" : cursor.getString(idColumn));
          message.putString("address", addressColumn < 0 || cursor.isNull(addressColumn) ? "رقم غير معروف" : cursor.getString(addressColumn));
          message.putString("body", bodyColumn < 0 || cursor.isNull(bodyColumn) ? "" : cursor.getString(bodyColumn));
          message.putDouble("date", dateColumn < 0 ? 0 : cursor.getLong(dateColumn));
          message.putBoolean("read", readColumn >= 0 && cursor.getInt(readColumn) != 0);
          message.putString("threadId", threadColumn < 0 ? "" : cursor.getString(threadColumn));
          messages.pushMap(message);
        }
      }
      promise.resolve(messages);
    } catch (Exception error) {
      promise.reject("E_SMS_READ", "تعذر قراءة صندوق الرسائل على هذا الجهاز", error);
    }
  }

  @ReactMethod
  public void markAllMessagesRead(Promise promise) {
    ReactApplicationContext context = getReactApplicationContext();
    if (!isDefaultSmsApp(context)) {
      promise.reject("E_NOT_DEFAULT_SMS", "يجب تعيين مُرشد تطبيق الرسائل الافتراضي أولًا");
      return;
    }
    if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_SMS_PERMISSION", "إذن قراءة SMS غير ممنوح");
      return;
    }
    try {
      ContentValues values = new ContentValues();
      values.put(Telephony.Sms.READ, 1);
      values.put(Telephony.Sms.SEEN, 1);
      int updated = context.getContentResolver().update(
          Telephony.Sms.Inbox.CONTENT_URI,
          values,
          Telephony.Sms.READ + "=0",
          null);
      promise.resolve(updated);
    } catch (Exception error) {
      promise.reject("E_SMS_UPDATE", "تعذر تحديث حالة قراءة الرسائل", error);
    }
  }

  private boolean isDefaultSmsApp(Context context) {
    String defaultPackage = Telephony.Sms.getDefaultSmsPackage(context);
    return context.getPackageName().equals(defaultPackage);
  }
}
