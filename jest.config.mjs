export default {
  rootDir: '.',
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        // The tsconfig option is needed to override the one in the root
        tsconfig: './core/tsconfig.json'
      },
    ],
  },
  moduleNameMapper: {
    // This is needed to ensure that imports with the .js extension are resolved correctly
    // when running tests. It maps imports like './agenda.js' to './agenda.ts'.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // This maps the path alias @core/ to the core source directory
    '^@core/(.*)$': '<rootDir>/core/src/$1',
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/core/src/**/*.test.ts'],
  // This tells Jest to treat .ts files as ES modules
  extensionsToTreatAsEsm: ['.ts'],
};
