const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication, withAppBuildGradle } = require('@expo/config-plugins');

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

function ensureSmsPackageVisibilityQuery(manifest) {
  const queries = manifest.manifest.queries ?? [];
  const mergedQuery = {};
  for (const query of queries) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        mergedQuery[key] ??= [];
        for (const item of value) {
          if (!mergedQuery[key].some((existing) => JSON.stringify(existing) === JSON.stringify(item))) {
            mergedQuery[key].push(item);
          }
        }
      } else if (!(key in mergedQuery)) {
        mergedQuery[key] = value;
      }
    }
  }
  const actionName = 'android.provider.Telephony.SMS_DELIVER';
  const exists = (mergedQuery.intent ?? []).some((intent) =>
    (intent.action ?? []).some((action) => action.$?.['android:name'] === actionName),
  );
  if (!exists) {
    mergedQuery.intent ??= [];
    mergedQuery.intent.push({ action: [{ $: { 'android:name': actionName } }] });
  }
  manifest.manifest.queries = [mergedQuery];
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
  ensureIntentFilter(activity, {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    category: [
      { $: { 'android:name': 'android.intent.category.DEFAULT' } },
      { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
    ],
    data: [{ $: { 'android:scheme': 'murshid', 'android:host': 'messages' } }],
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
  let service = application.service.find((entry) => entry.$?.['android:name'] === SERVICE_NAME);
  if (!service) {
    service = { $: { 'android:name': SERVICE_NAME }, 'meta-data': [], 'intent-filter': [] };
    application.service.push(service);
  }
  service.$ = {
    ...service.$,
    'android:name': SERVICE_NAME,
    'android:permission': 'android.permission.BIND_INCALL_SERVICE',
    'android:exported': 'true',
  };
  service['meta-data'] ??= [];
  for (const name of ['android.telecom.IN_CALL_SERVICE_UI', 'android.telecom.IN_CALL_SERVICE_RINGING']) {
    let metadata = service['meta-data'].find((entry) => entry.$?.['android:name'] === name);
    if (!metadata) {
      metadata = { $: { 'android:name': name } };
      service['meta-data'].push(metadata);
    }
    metadata.$ = { ...metadata.$, 'android:name': name, 'android:value': 'true' };
  }
  ensureIntentFilter(service, {
    action: [{ $: { 'android:name': 'android.telecom.InCallService' } }],
  });
}

module.exports = function withMurshidDialer(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest.$ ??= {};
    manifest.manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
    [
      'android.permission.READ_PHONE_STATE',
      'android.permission.CALL_PHONE',
      'android.permission.ANSWER_PHONE_CALLS',
      'android.permission.READ_CONTACTS',
      'android.permission.READ_CALL_LOG',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.RECEIVE_MMS',
      'android.permission.SEND_SMS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    ].forEach((permission) => ensurePermission(manifest, permission));
    ensureSmsPackageVisibilityQuery(manifest);
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
      application.service ??= [];
      let foregroundWorker = application.service.find((entry) => entry.$?.['android:name'] === 'androidx.work.impl.foreground.SystemForegroundService');
      if (!foregroundWorker) {
        foregroundWorker = { $: { 'android:name': 'androidx.work.impl.foreground.SystemForegroundService' } };
        application.service.push(foregroundWorker);
      }
      foregroundWorker.$ = {
        ...foregroundWorker.$,
        'android:foregroundServiceType': 'dataSync',
        'tools:node': 'merge',
      };
      application.receiver ??= [];
      const callActionReceiver = '.MurshidCallActionReceiver';
      if (!application.receiver.some((entry) => entry.$?.['android:name'] === callActionReceiver)) {
        application.receiver.push({ $: { 'android:name': callActionReceiver, 'android:exported': 'false' } });
      }
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    const requiredDependencies = [
      ['androidx.work:work-runtime', 'implementation("androidx.work:work-runtime:2.10.0")'],
      ['com.google.guava:listenablefuture', 'implementation("com.google.guava:listenablefuture:1.0")'],
    ];
    const missingDependencies = requiredDependencies
      .filter(([coordinate]) => !contents.includes(coordinate))
      .map(([, declaration]) => `    ${declaration}`);
    if (missingDependencies.length > 0) {
      const dependencyBlock = /dependencies\s*\{/;
      if (!dependencyBlock.test(contents)) throw new Error('withMurshidDialer: app Gradle dependencies block was not found.');
      config.modResults.contents = contents.replace(dependencyBlock, (match) => `${match}\n${missingDependencies.join('\n')}`);
    }
    return config;
  });

  config = withMainApplication(config, (config) => {
    let source = config.modResults.contents;
    const additions = [];
    if (!source.includes('add(MurshidSmsPackage())')) additions.push('          add(MurshidSmsPackage())');
    if (!source.includes('add(MurshidGalleryPackage())')) additions.push('          add(MurshidGalleryPackage())');
    if (additions.length) {
      const packageListPattern = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!packageListPattern.test(source)) {
        throw new Error('withMurshidDialer: could not register custom packages in MainApplication.');
      }
      source = source.replace(packageListPattern, (match) => `${match}\n${additions.join('\n')}`);
    }
    config.modResults.contents = source;
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
      'MurshidCallOverlay.java',
      'MurshidCallScreenView.java',
      'MurshidCallActionReceiver.java',
      'MurshidRolePromptActivity.java',
      'MurshidSmsModule.java',
      'MurshidSmsPackage.java',
      'MurshidShortcutModule.java',
      'MurshidThemeModule.java',
      'MurshidSmsReceiver.java',
      'MurshidWapPushReceiver.java',
      'MurshidRespondViaMessageService.java',
      'MurshidGalleryModule.java',
      'MurshidGalleryPackage.java',
      'MurshidGalleryImportWorker.java',
    ]) {
      fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, filename));
    }
    const resourceSourceDir = path.join(sourceDir, 'res');
    if (fs.existsSync(resourceSourceDir)) {
      const resourceTargetDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const directory of fs.readdirSync(resourceSourceDir, { withFileTypes: true })) {
        if (!directory.isDirectory()) continue;
        const sourceFolder = path.join(resourceSourceDir, directory.name);
        const targetFolder = path.join(resourceTargetDir, directory.name);
        fs.mkdirSync(targetFolder, { recursive: true });
        for (const filename of fs.readdirSync(sourceFolder)) {
          const sourceFile = path.join(sourceFolder, filename);
          if (fs.statSync(sourceFile).isFile()) {
            fs.copyFileSync(sourceFile, path.join(targetFolder, filename));
          }
        }
      }
    }
    return config;
  }]);
};
