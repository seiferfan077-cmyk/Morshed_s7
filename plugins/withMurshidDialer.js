const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const PACKAGE = 'com.murshid.s7';
const SERVICE_NAME = '.MurshidInCallService';
const ACTIVITY_NAME = '.MurshidDialerActivity';
const ROLE_PROMPT_ACTIVITY_NAME = '.MurshidRolePromptActivity';

function ensurePermission(manifest, name) {
  manifest.manifest['uses-permission'] ??= [];
  if (!manifest.manifest['uses-permission'].some((entry) => entry.$?.['android:name'] === name)) {
    manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function ensureActivity(application, name) {
  application.activity ??= [];
  const filters = [
    { action: [{ $: { 'android:name': 'android.intent.action.DIAL' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }], data: [{ $: { 'android:scheme': 'tel' } }] },
    { action: [{ $: { 'android:name': 'android.intent.action.DIAL' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }] },
    { action: [{ $: { 'android:name': 'com.murshid.s7.OPEN_DIALER' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }] },
    { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }, { $: { 'android:name': 'android.intent.category.BROWSABLE' } }], data: [{ $: { 'android:scheme': 'murshid', 'android:host': 'dialer' } }] },
  ];
  const existing = application.activity.find((entry) => entry.$?.['android:name'] === name);
  const activity = existing || {
    $: {
      'android:name': name,
      'android:exported': 'true',
      'android:launchMode': 'singleTask',
      'android:theme': '@style/Theme.App.SplashScreen',
      'android:showWhenLocked': 'true',
      'android:turnScreenOn': 'true',
    },
    'intent-filter': [],
  };
  if (!existing) application.activity.push(activity);
  activity.$ = {
    ...activity.$,
    'android:exported': 'true',
    'android:launchMode': 'singleTask',
    'android:theme': '@style/Theme.App.SplashScreen',
    'android:showWhenLocked': 'true',
    'android:turnScreenOn': 'true',
  };
  activity['intent-filter'] ??= [];
  const filterKey = (filter) => {
    const actions = (filter.action ?? []).map((item) => item.$?.['android:name'] || '').sort().join(',');
    const data = (filter.data ?? []).map((item) => `${item.$?.['android:scheme'] || ''}:${item.$?.['android:host'] || ''}:${item.$?.['android:path'] || ''}`).sort().join(',');
    return `${actions}|${data}`;
  };
  const existingKeys = new Set(activity['intent-filter'].map(filterKey));
  for (const filter of filters) {
    const key = filterKey(filter);
    if (!existingKeys.has(key)) activity['intent-filter'].push(filter);
  }
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

function ensureRolePromptActivity(application) {
  application.activity ??= [];
  let activity = application.activity.find((entry) => entry.$?.['android:name'] === ROLE_PROMPT_ACTIVITY_NAME);
  if (!activity) {
    activity = {
      $: {
        'android:name': ROLE_PROMPT_ACTIVITY_NAME,
        'android:exported': 'true',
        'android:launchMode': 'singleTop',
        'android:excludeFromRecents': 'true',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
      },
      'intent-filter': [],
    };
    application.activity.push(activity);
  }
  activity.$ = {
    ...activity.$,
    'android:exported': 'true',
    'android:launchMode': 'singleTop',
    'android:excludeFromRecents': 'true',
    'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
  };
  activity['intent-filter'] ??= [];
  const actionName = 'com.murshid.s7.REQUEST_DEFAULT_DIALER';
  if (!activity['intent-filter'].some((filter) => filter.action?.some((action) => action.$?.['android:name'] === actionName))) {
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': actionName } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    });
  }
}

module.exports = function withMurshidDialer(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    ensurePermission(manifest, 'android.permission.READ_PHONE_STATE');
    ensurePermission(manifest, 'android.permission.CALL_PHONE');
    ensurePermission(manifest, 'android.permission.ANSWER_PHONE_CALLS');
    ensurePermission(manifest, 'android.permission.READ_CONTACTS');
    ensurePermission(manifest, 'android.permission.POST_NOTIFICATIONS');
    ensurePermission(manifest, 'android.permission.USE_FULL_SCREEN_INTENT');
    const application = manifest.manifest.application?.[0];
    if (application) {
      ensureActivity(application, ACTIVITY_NAME);
      ensureRolePromptActivity(application);
      ensureInCallService(application);
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const sourceDir = path.join(config.modRequest.projectRoot, 'native', 'android');
    const targetDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...PACKAGE.split('.'));
    fs.mkdirSync(targetDir, { recursive: true });
    for (const filename of ['MurshidCallerInfo.java', 'MurshidDialerActivity.java', 'MurshidInCallService.java', 'MurshidRolePromptActivity.java']) {
      fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, filename));
    }
    return config;
  }]);
};
