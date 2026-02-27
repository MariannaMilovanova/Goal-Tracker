module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  env: {
    node: true,
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true,
      },
    },
  ],
};
