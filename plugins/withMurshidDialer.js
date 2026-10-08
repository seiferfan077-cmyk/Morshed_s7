const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');

const PACKAGE = 'com.murshid.s7';
const SERVICE_NAME = '.MurshidInCallService';
const DIALER_ACTIVITY_NAME = '.MurshidDialerActivity';
const ROLE_PROMPT_ACTIVITY_NAME = '.MurshidRolePromptActivity';
const RESPOND_SERVICE_NAME = '.MurshidRespondViaMessageService';

function ensurePermission(manifest, name) {
  manifest.manifest['uses-permission'] ??= [];
  if (!manifest.manifest['uses-permission'].some((entry) => entry.$?.['android:name'] === name)) {
    manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function ensureIntentFilter(component, filter) {
  component['intent-filter'] ??= [];
  const actionNames = (filter.action ?? []).map((item) => item.$?.['android:name'] || '').sort().join(',');
  const categoryNames = (filter.category ?? []).map((item) => item.$?.['android:name'] || '').sort().join(',');
  const dataKey = (items) => (items ?? []).map((item) => `${item.$?.['android:scheme'] || ''}:${item.$?.['android:host'] || ''}:${item.$?.['android:mimeType'] || ''}`).sort().join(',');
  const key = `${actionNames}|${categoryNames}|${dataKey(filter.data)}`;
  const existing = component['intent-filter'].some((candidate) => {
    const candidateActions = (candidate.action ?? []).map((item) => item.$?.['android:name'] || '').sort().join(',');
    const candidateCategories = (candidate.category ?? []).map((item) => item.$?.['android:name'] || '').sort().join(',');
    return `${candidateActions}|${candidateCategories}|${dataKey(candidate.data)}` === key;
  });
  if (!existing) component['intent-filter'].push(filter);
}

function ensureDialerActivity(application) {
  application.activity ??= [];
  const name = DIALER_ACTIVITY_NAME;
  let activity = application.activity.find((entry) => entry.$?.['android:name'] === name);
  if (!activity) {
    activity = {
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
    application.activity.push(activity);
  }
  activity.$ = {
    ...activity.$,
    'android:exported': 'true',
    'android:launchMode': 'singleTask',
    'android:theme': '@style/Theme.App.SplashScreen',
    'android:showWhenLocked': 'true',
    'android:turnScreenOn': 'true',
  };
  [
    { action: 'android.intent.action.DIAL', category: ['android.intent.category.DEFAULT'], scheme: 'tel' },
    { action: 'android.intent.action.DIAL', category: ['android.intent.category.DEFAULT'] },
    { action: 'com.murshid.s7.OPEN_DIALER', category: ['android.intent.category.DEFAULT'] },
    { action: 'android.intent.action.VIEW', category: ['android.intent.category.DEFAULT', 'android.intent.category.BROWSABLE'], scheme: 'murshid', host: 'dialer' },
  ].forEach((item) => ensureIntentFilter(activity, {
    action: [{ $: { 'android:name': item.action } }],
    category: item.category.map((category) => ({ $: { 'android:name': category } })),
    ...(item.scheme ? { data: [{ $: { 'android:scheme': item.scheme, ...(item.host ? { 'android:host': item.host } : {}) } }] } : {}),
  }));
}

function ensureRolePromptActivity(application) {
  application.activity ??= [];
  const name = ROLE_PROMPT_ACTIVITY_NAME;
  let activity = application.activity.find((entry) => entry.$?.['android:name'] === name);
  if (!activity) {
    activity = { $: { 'android:name': name }, 'intent-filter': [] };
    application.activity.push(activity);
  }
  activity.$ = {
    ...activity.$,
    'android:exported': 'true',
    'android:launchMode': 'singleTop',
    'android:excludeFromRecents': 'true',
    'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
  };
  ['com.murshid.s7.REQUEST_DEFAULT_ROLES', 'com.murshid.s7.REQUEST_SMS_ROLE'].forEach((action) => ensureIntentFilter(activity, {
    action: [{ $: { 'android:name': action } }],
    category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
  }));
}

function ensureMessagingMainActivity(application) {
  const activity = application.activity?.find((entry) => {
    const name = entry.$?.['android:name'] || '';
    return name === '.MainActivity' || name === `${PACKAGE}.MainActivity`;
  });
  if (!activity) throw new Error('withMurshidDialer: Expo MainActivity was not found to register SMS intents.');
  ensureIntentFilter(activity, {
    action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
    category: [{ $: { 'android:name': 'android.intent.category.APP_MESSAGING' } }],
  });
  ensureIntentFilter(activity, {
    action: [{ $: { 'android:name': 'android.intent.action.SENDTO' } }],
    category: [
      { $: { 'android:name': 'android.intent.category.DEFAULT' } },
      { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
    ],
    data: ['sms', 'smsto', 'mms', 'mmsto'].map((scheme) => ({ $: { 'android:scheme': scheme } })),
  });
}

function ensureReceiver(application, name, permission, filter) {
  application.receiver ??= [];
  let receiver = application.receiver.find((entry) => entry.$?.['android:name'] === name);
  if (!receiver) {
    receiver = { $: { 'android:name': name }, 'intent-filter': [] };
    application.receiver.push(receiver);
  }
  receiver.$ = { ...receiver.$, 'android:exported': 'true', 'android:permission': permission };
  ensureIntentFilter(receiver, filter);
}

function ensureSmsRespondService(application) {
  application.service ??= [];
  let service = application.service.find((entry) => entry.$?.['android:name'] === RESPOND_SERVICE_NAME);
  if (!service) {
    service = { $: { 'android:name': RESPOND_SERVICE_NAME }, 'intent-filter': [] };
    application.service.push(service);
  }
  service.$ = {
    ...service.$,
    'android:exported': 'true',
    'android:permission': 'android.permission.SEND_RESPOND_VIA_MESSAGE',
  };
  ensureIntentFilter(service, {
    action: [{ $: { 'android:name': 'android.intent.action.RESPOND_VIA_MESSAGE' } }],
    data: ['sms', 'smsto', 'mms', 'mmsto'].map((scheme) => ({ $: { 'android:scheme': scheme } })),
  });
}

function ensureInCallService(application) {
  application.service ??= [];
  const existing = application.service.find((entry) => entry.$?.['android:name'] === SERVICE_NAME);
  if (existing) return;
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
    [
      'android.permission.READ_PHONE_STATE',
      'android.permission.CALL_PHONE',
      'android.permission.ANSWER_PHONE_CALLS',
      'android.permission.READ_CONTACTS',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.RECEIVE_MMS',
      'android.permission.SEND_SMS',
    ].forEach((permission) => ensurePermission(manifest, permission));
    manifest.manifest['uses-feature'] ??= [];
    if (!manifest.manifest['uses-feature'].some((entry) => entry.$?.['android:name'] === 'android.hardware.telephony')) {
      manifest.manifest['uses-feature'].push({ $: { 'android:name': 'android.hardware.telephony', 'android:required': 'false' } });
    }

    const application = manifest.manifest.application?.[0];
    if (application) {
      ensureDialerActivity(application);
      ensureRolePromptActivity(application);
      ensureMessagingMainActivity(application);
      ensureReceiver(application, '.MurshidSmsReceiver', 'android.permission.BROADCAST_SMS', {
        action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_DELIVER' } }],
      });
      ensureReceiver(application, '.MurshidWapPushReceiver', 'android.permission.BROADCAST_WAP_PUSH', {
        action: [{ $: { 'android:name': 'android.provider.Telephony.WAP_PUSH_DELIVER' } }],
        data: [{ $: { 'android:mimeType': 'application/vnd.wap.mms-message' } }],
      });
      ensureSmsRespondService(application);
      ensureInCallService(application);
      application.receiver ??= [];
      const callActionReceiver = '.MurshidCallActionReceiver';
      if (!application.receiver.some((entry) => entry.$?.['android:name'] === callActionReceiver)) {
        application.receiver.push({ $: { 'android:name': callActionReceiver, 'android:exported': 'false' } });
      }
    }
    return config;
  });

  config = withMainApplication(config, (config) => {
    const source = config.modResults.contents;
    if (!source.includes('add(MurshidSmsPackage())')) {
      const packageListPattern = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!packageListPattern.test(source)) {
        throw new Error('withMurshidDialer: could not register MurshidSmsPackage in MainApplication.');
      }
      config.modResults.contents = source.replace(packageListPattern, (match) => `${match}\n          add(MurshidSmsPackage())`);
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const sourceDir = path.join(config.modRequest.projectRoot, 'native', 'android');
    const targetDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...PACKAGE.split('.'));
    fs.mkdirSync(targetDir, { recursive: true });
    const fontSourceDir = path.join(config.modRequest.projectRoot, 'assets', 'fonts');
    const fontTargetDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets', 'fonts');
    fs.mkdirSync(fontTargetDir, { recursive: true });
    for (const fontName of ['ArefRuqaa-Regular.ttf', 'ArefRuqaa-Bold.ttf']) {
      fs.copyFileSync(path.join(fontSourceDir, fontName), path.join(fontTargetDir, fontName));
    }
    for (const filename of [
      'MurshidCallerInfo.java',
      'MurshidDialerActivity.java',
      'MurshidInCallService.java',
      'MurshidCallActionReceiver.java',
      'MurshidRolePromptActivity.java',
      'MurshidSmsModule.java',
      'MurshidSmsPackage.java',
      'MurshidThemeModule.java',
      'MurshidSmsReceiver.java',
      'MurshidWapPushReceiver.java',
      'MurshidRespondViaMessageService.java',
    ]) {
      fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, filename));
    }
    return config;
  }]);
};
