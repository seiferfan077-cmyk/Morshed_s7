const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withMurshidLargeHeap(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('withMurshidLargeHeap: Android application manifest entry was not found.');
    }

    application.$ ??= {};
    application.$['android:largeHeap'] = 'true';
    return config;
  });
};
