module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^expo/src/winter$': '<rootDir>/jest.expo-winter.js',
  },
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
