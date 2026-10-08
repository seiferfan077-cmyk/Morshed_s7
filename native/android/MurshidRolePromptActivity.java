package com.murshid.s7;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telecom.TelecomManager;

public final class MurshidRolePromptActivity extends Activity {
  public static final String ACTION_REQUEST_DEFAULT_DIALER = "com.murshid.s7.REQUEST_DEFAULT_DIALER";
  private static final int REQUEST_DIALER_ROLE = 9620;
  private static final String PREFS_NAME = "murshid_dialer";
  private static final String PREF_PROMPTED = "startup_dialer_role_prompted";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    boolean alreadyPrompted = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(PREF_PROMPTED, false);
    if (alreadyPrompted) {
      finish();
      return;
    }
    // Persist before showing the system dialog so dismissing it never causes a prompt loop.
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(PREF_PROMPTED, true).apply();

    try {
      if (Build.VERSION.SDK_INT >= 29) {
        RoleManager roleManager = getSystemService(RoleManager.class);
        if (roleManager == null || !roleManager.isRoleAvailable(RoleManager.ROLE_DIALER) || roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
          finish();
          return;
        }
        startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER), REQUEST_DIALER_ROLE);
        return;
      }

      TelecomManager telecom = (TelecomManager) getSystemService(TELECOM_SERVICE);
      if (telecom != null && !getPackageName().equals(telecom.getDefaultDialerPackage())) {
        Intent request = new Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER);
        request.putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, getPackageName());
        startActivityForResult(request, REQUEST_DIALER_ROLE);
      } else {
        finish();
      }
    } catch (RuntimeException error) {
      finish();
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == REQUEST_DIALER_ROLE) finish();
  }
}
