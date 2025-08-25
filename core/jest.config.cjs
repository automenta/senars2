/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // We have to use a relative path here because of how the monorepo is set up.
  // The rootDir for this project is /app/core, but node_modules is at /app/node_modules.
  preset: '../node_modules/ts-jest/presets/default-esm.js',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts'],
};
