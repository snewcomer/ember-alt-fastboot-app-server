module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'script'
  },
  extends: [
    'eslint:recommended',
    'plugin:node/recommended'
  ],
  env: {
    node: true
  },
  rules: {
  },
  overrides: [
    {
      files: ['test/*.js'],
      env: {
        mocha: true
      }
    },
    {
      files: ['src/backing-classes/ui.js'],
      rules: {
        'no-console': [0]
      }
    }
  ]
};
