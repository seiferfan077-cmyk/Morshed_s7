package com.murshid.s7;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.List;

public final class MurshidShortcutModule extends ReactContextBaseJavaModule {
  private static final String MODULE_NAME = "MurshidShortcutModule";
  private static final String SHORTCUT_ID = "murshid_call_shortcut";
  private static final String PREFERENCES = "murshid_launcher_shortcut";
  private static final String REQUESTED_KEY = "pin_request_started";

  public MurshidShortcutModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return MODULE_NAME;
  }

  @ReactMethod
  public void requestPinShortcut(Promise promise) {
    ReactApplicationContext context = getReactApplicationContext();
    try {
      if (!ShortcutManagerCompat.isRequestPinShortcutSupported(context)) {
        promise.resolve(false);
        return;
      }

      SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
      if (preferences.getBoolean(REQUESTED_KEY, false)) {
        promise.resolve(false);
        return;
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
        List<ShortcutInfoCompat> pinnedShortcuts = ShortcutManagerCompat.getShortcuts(
            context, ShortcutManagerCompat.FLAG_MATCH_PINNED);
        for (ShortcutInfoCompat pinnedShortcut : pinnedShortcuts) {
          if (SHORTCUT_ID.equals(pinnedShortcut.getId())) {
            preferences.edit().putBoolean(REQUESTED_KEY, true).apply();
            promise.resolve(false);
            return;
          }
        }
      }

      Intent appIntent = new Intent(context, MainActivity.class);
      appIntent.setAction(Intent.ACTION_MAIN);
      appIntent.addCategory(Intent.CATEGORY_LAUNCHER);
      appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

      Intent dialerIntent = new Intent(context, MurshidDialerActivity.class);
      dialerIntent.setAction(MurshidDialerActivity.ACTION_OPEN_DIALER);

      ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, SHORTCUT_ID)
          .setShortLabel("اتصال")
          .setLongLabel("جهات الاتصال والاتصال")
          .setIcon(IconCompat.createWithResource(context, R.drawable.murshid_call_shortcut))
          .setIntents(new Intent[] { appIntent, dialerIntent })
          .build();

      boolean requested = ShortcutManagerCompat.requestPinShortcut(context, shortcut, null);
      if (requested) {
        preferences.edit().putBoolean(REQUESTED_KEY, true).apply();
      }
      promise.resolve(requested);
    } catch (RuntimeException exception) {
      promise.reject("E_SHORTCUT_PIN", "Android could not request the pinned shortcut", exception);
    }
  }
}
