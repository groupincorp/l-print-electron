const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

// Electron bundles Chromium locale strings for ~60 languages, used only for
// native right-click menus (Copy/Paste/Undo). This app doesn't rely on OS
// locale for that, so keep English only to cut ~40MB from every installer.
const KEEP_LOCALES = new Set(['en-US.pak', 'en-US.pak.info']);
function pruneLocales(buildPath, _electronVersion, platform, _arch, callback) {
  if (platform !== 'win32' && platform !== 'linux') return callback();
  // buildPath is <dist root>/resources/app; locales/ lives at <dist root>.
  const localesDir = path.resolve(buildPath, '..', '..', 'locales');
  fs.readdir(localesDir, (err, files) => {
    if (err) return callback(); // no locales dir on this platform/build
    Promise.all(
      files
        .filter((f) => !KEEP_LOCALES.has(f))
        .map((f) => fs.promises.rm(path.join(localesDir, f), { force: true })),
    )
      .then(() => callback())
      .catch(callback);
  });
}

module.exports = {
  packagerConfig: {
    name: 'Printer Maintenance',
    afterCopy: [pruneLocales],
    asar: {
      unpack: "**/node_modules/pdf-to-printer/dist/*.exe",
    },
    icon: path.resolve(__dirname, 'src/assets/printer-maintenance'), // Electron Forge will automatically append the correct extension
    extraResource: [
      path.resolve(__dirname, 'src/assets/printer-maintenance.icns'),
      path.resolve(__dirname, 'src/assets/printer-maintenance.ico'),
      path.resolve(__dirname, 'src/assets/printer-maintenance.png')
    ],
  },
  rebuildConfig: {},
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'groupincorp',
          name: 'l-print-electron',
        },
        authToken: process.env.GH_TOKEN,
        draft: false,
        generateReleaseNotes: true,
      },
    },
  ],
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        iconUrl: path.resolve(__dirname, 'src/assets/printer-maintenance.ico'),
        setupIcon: path.resolve(__dirname, 'src/assets/printer-maintenance.ico'),
        // Lets Squirrel diff against the last published release to produce a
        // small delta.nupkg, so updates don't re-download the full ~140MB
        // package every time. Resolves to whatever was most recently
        // published on GitHub at build time.
        remoteReleases: 'https://github.com/groupincorp/l-print-electron/releases/latest/download',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: path.resolve(__dirname, 'src/assets/printer-maintenance.icns'),
        name: 'Printer Maintenance',
      },
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: path.resolve(__dirname, 'src/assets/printer-maintenance.png'),
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: path.resolve(__dirname, 'src/assets/printer-maintenance.png'),
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
