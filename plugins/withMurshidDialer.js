const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const PACKAGE = 'com.murshid.s7';
const SERVICE_NAME = '.MurshidInCallService';
const ACTIVITY_NAME = '.MurshidDialerActivity';

function ensurePermission(manifest, name) {
  manifest.manifest['uses-permission'] ??= [];
  if (!manifest.manifest['uses-permission'].some((entry) => entry.$?.['android:name'] === name)) {
    manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function ensureActivity(application, name) {
  application.activity ??= [];
  if (application.activity.some((entry) => entry.$?.['android:name'] === name)) return;
  application.activity.push({
    $: {
      'android:name': name,
      'android:exported': 'true',
      'android:theme': '@style/Theme.App.SplashScreen',
      'android:showWhenLocked': 'true',
      'android:turnScreenOn': 'true',
    },
    'intent-filter': [
      { action: [{ $: { 'android:name': 'android.intent.action.DIAL' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }], data: [{ $: { 'android:scheme': 'tel' } }] },
      { action: [{ $: { 'android:name': 'android.intent.action.DIAL' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }] },
    ],
  });
}

function ensureInCallService(application) {
  application.service ??= [];
  if (application.service.some((entry) => entry.$?.['android:name'] === SERVICE_NAME)) return;
  application.service.push({
    $: {
      'android:name': SERVICE_NAME,
      'android:permission': 'android.permission.BIND_INCALL_SERVICE',
      'android:exported': 'true',
    },
    'meta-data': [
      { $: { 'android:name': 'android.telecom.IN_CALL_SERVICE_UI', 'android:value': 'true' } },
      { $: { 'android:name': 'android.telecom.IN_CALL_SERVICE_RINGING', 'android:value': 'true' } },
    ],
    'intent-filter': [{ action: [{ $: { 'android:name': 'android.telecom.InCallService' } }] }],
  });
}

module.exports = function withMurshidDialer(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    ensurePermission(manifest, 'android.permission.READ_PHONE_STATE');
    ensurePermission(manifest, 'android.permission.CALL_PHONE');
    ensurePermission(manifest, 'android.permission.ANSWER_PHONE_CALLS');
    ensurePermission(manifest, 'android.permission.READ_CONTACTS');
    ensurePermission(manifest, 'android.permission.POST_NOTIFICATIONS');
    const application = manifest.manifest.application?.[0];
    if (application) {
      ensureActivity(application, ACTIVITY_NAME);
      ensureInCallService(application);
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const sourceDir = path.join(config.modRequest.projectRoot, 'native', 'android');
    const targetDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...PACKAGE.split('.'));
    fs.mkdirSync(targetDir, { recursive: true });
    for (const filename of ['MurshidCallerInfo.java', 'MurshidDialerActivity.java', 'MurshidInCallService.java']) {
      fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, filename));
    }
    return config;
  }]);
};
