const { defaults } = require('jest-config');

module.exports = {
	...defaults,
	rootDir: process.cwd(),
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	moduleNameMapper: {
		'^scheduler$': '<rootDir>/node_modules/scheduler/unstable_mock.js'
	},
	moduleDirectories: [
		// 对于react reactdom
		// 先从dist/node_modules下面解析
		'dist/node_modules',
		// 对于第三方依赖
		...defaults.moduleDirectories
	],
	fakeTimers: {
		enableGlobally: true,
		legacyFakeTimers: true
	},
	setupFilesAfterEnv: ['./scripts/jest/setupJest.js'],
	testEnvironment: 'jsdom'
};
