package com.murshid.s7;

import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public final class MurshidThemeModule extends ReactContextBaseJavaModule {
  private static final String PREFERENCES = "murshid_theme";
  private static final String THEME_KEY = "theme_mode";

  public MurshidThemeModule(ReactApplicationContext context) {
    super(context);
  }

  @Override public String getName() {
    return "MurshidTheme";
  }

  @ReactMethod
  public void setThemeMode(String mode) {
    if (!"light".equals(mode) && !"dark".equals(mode)) return;
    SharedPreferences preferences = getReactApplicationContext()
        .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    preferences.edit().putString(THEME_KEY, mode).apply();
  }
}
