package com.murshid.s7;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telecom.TelecomManager;

public final class MurshidRolePromptActivity extends Activity {
  public static final String ACTION_REQUEST_DEFAULT_ROLES = "com.murshid.s7.REQUEST_DEFAULT_ROLES";
  public static final String ACTION_REQUEST_SMS_ROLE = "com.murshid.s7.REQUEST_SMS_ROLE";
  private static final int REQUEST_DIALER_ROLE = 9620;
  private static final int REQUEST_SMS_ROLE = 9621;
  private static final String PREFS_NAME = "murshid_dialer";
  private static final String PREF_DIALER_PROMPTED = "startup_dialer_role_prompted";
  private static final String PREF_SMS_PROMPTED = "startup_sms_role_prompted";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    String action = getIntent() == null ? null : getIntent().getAction();
    if (ACTION_REQUEST_SMS_ROLE.equals(action)) {
      requestSmsRole(false);
      return;
    }
    requestNextStartupRole();
  }

  private SharedPreferences preferences() {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
  }

  private void requestNextStartupRole() {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        RoleManager roleManager = getSystemService(RoleManager.class);
        if (roleManager == null) {
          finish();
          return;
        }
        if (roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)
            && !roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
            && !preferences().getBoolean(PREF_DIALER_PROMPTED, false)) {
          preferences().edit().putBoolean(PREF_DIALER_PROMPTED, true).apply();
          startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER), REQUEST_DIALER_ROLE);
          return;
        }
        if (roleManager.isRoleAvailable(RoleManager.ROLE_SMS)
            && !roleManager.isRoleHeld(RoleManager.ROLE_SMS)
            && !preferences().getBoolean(PREF_SMS_PROMPTED, false)) {
          preferences().edit().putBoolean(PREF_SMS_PROMPTED, true).apply();
          startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS), REQUEST_SMS_ROLE);
          return;
        }
        finish();
        return;
      }

      TelecomManager telecom = (TelecomManager) getSystemService(TELECOM_SERVICE);
      boolean isDefaultDialer = telecom != null && getPackageName().equals(telecom.getDefaultDialerPackage());
      if (!isDefaultDialer && !preferences().getBoolean(PREF_DIALER_PROMPTED, false)) {
        preferences().edit().putBoolean(PREF_DIALER_PROMPTED, true).apply();
        Intent request = new Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER);
        request.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, getPackageName());
        startActivityForResult(request, REQUEST_DIALER_ROLE);
        return;
      }
      requestSmsRole(true);
    } catch (RuntimeException error) {
      finish();
    }
  }

  private void requestSmsRole(boolean startupFlow) {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        RoleManager roleManager = getSystemService(RoleManager.class);
        if (roleManager == null || !roleManager.isRoleAvailable(RoleManager.ROLE_SMS)
            || roleManager.isRoleHeld(RoleManager.ROLE_SMS)) {
          finish();
          return;
        }
        if (startupFlow) {
          if (preferences().getBoolean(PREF_SMS_PROMPTED, false)) {
            finish();
            return;
          }
          preferences().edit().putBoolean(PREF_SMS_PROMPTED, true).apply();
        }
        startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS), REQUEST_SMS_ROLE);
        return;
      }

      String defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(this);
      if (getPackageName().equals(defaultSmsPackage)) {
        finish();
        return;
      }
      if (startupFlow) {
        if (preferences().getBoolean(PREF_SMS_PROMPTED, false)) {
          finish();
          return;
        }
        preferences().edit().putBoolean(PREF_SMS_PROMPTED, true).apply();
      }
      Intent request = new Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT);
      request.putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, getPackageName());
      startActivityForResult(request, REQUEST_SMS_ROLE);
    } catch (RuntimeException error) {
      finish();
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == REQUEST_DIALER_ROLE) {
      requestNextStartupRole();
    } else if (requestCode == REQUEST_SMS_ROLE) {
      finish();
    }
  }
}
