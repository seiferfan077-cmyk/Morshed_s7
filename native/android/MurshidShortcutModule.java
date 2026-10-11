package com.murshid.s7;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;

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
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false);
      return;
    }

    ShortcutManager shortcutManager = (ShortcutManager) context.getSystemService(Context.SHORTCUT_SERVICE);
    if (shortcutManager == null || !shortcutManager.isRequestPinShortcutSupported()) {
      promise.resolve(false);
      return;
    }

    SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    if (preferences.getBoolean(REQUESTED_KEY, false)) {
      promise.resolve(false);
      return;
    }

    List<ShortcutInfo> pinnedShortcuts = shortcutManager.getPinnedShortcuts();
    for (ShortcutInfo pinnedShortcut : pinnedShortcuts) {
      if (SHORTCUT_ID.equals(pinnedShortcut.getId())) {
        preferences.edit().putBoolean(REQUESTED_KEY, true).apply();
        promise.resolve(false);
        return;
      }
    }

    Intent appIntent = new Intent(context, MainActivity.class);
    appIntent.setAction(Intent.ACTION_MAIN);
    appIntent.addCategory(Intent.CATEGORY_LAUNCHER);
    appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

    Intent dialerIntent = new Intent(context, MurshidDialerActivity.class);
    dialerIntent.setAction(MurshidDialerActivity.ACTION_OPEN_DIALER);

    ShortcutInfo shortcut = new ShortcutInfo.Builder(context, SHORTCUT_ID)
        .setShortLabel("اتصال")
        .setLongLabel("جهات الاتصال والاتصال")
        .setIcon(Icon.createWithResource(context, R.drawable.murshid_call_shortcut))
        .setIntents(new Intent[] { appIntent, dialerIntent })
        .build();

    try {
      boolean requested = shortcutManager.requestPinShortcut(shortcut, null);
      if (requested) {
        preferences.edit().putBoolean(REQUESTED_KEY, true).apply();
      }
      promise.resolve(requested);
    } catch (Exception exception) {
      promise.reject("E_SHORTCUT_PIN", "Android could not request the pinned shortcut", exception);
    }
  }
}
