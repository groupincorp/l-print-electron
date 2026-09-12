const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
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
        name: 'Printer Restaurant',
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
