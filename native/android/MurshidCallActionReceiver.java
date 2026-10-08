package com.murshid.s7;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class MurshidCallActionReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    MurshidInCallService.dispatchAction(
        intent.getAction(),
        intent.getBooleanExtra(MurshidInCallService.EXTRA_ENABLED, false));
  }
}
