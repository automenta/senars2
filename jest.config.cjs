module.exports = {
  rootDir: '.', // root is /app
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@core/(.*)$': '<rootDir>/core/src/$1',
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/core/src/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
};
