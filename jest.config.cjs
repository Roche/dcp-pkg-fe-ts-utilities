module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: { module: 'CommonJS', moduleResolution: 'Node' }
        }],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    testMatch: [
        "**/__tests__/**/*.test.ts"
    ],
    reporters: [
        "default",
        ["jest-junit", { "outputDirectory": "./reports", "outputName": "junit.xml" }]
    ]
};