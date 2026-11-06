module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testMatch: [
        "**/__tests__/**/*.test.ts"
    ],
    reporters: [
        "default",
        ["jest-junit", { "outputDirectory": "./reports", "outputName": "junit.xml" }]
    ]
};