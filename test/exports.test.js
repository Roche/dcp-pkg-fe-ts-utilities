import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('all package entry points are importable as ES modules', async () => {
    const entries = [
        ['@open-dcp/utilities', 'logger', 'object'],
        ['@open-dcp/utilities/node/dependencyChangeSummary', 'generateDependencyChangeSummary', 'function'],
        ['@open-dcp/utilities/node/checkDependencyPolicy', 'checkDependencyPolicy', 'function'],
        ['@open-dcp/utilities/node/enforceInstallPolicy', 'enforceInstallPolicy', 'function'],
        ['@open-dcp/utilities/vite/MoveConfigPlugin', 'default', 'function'],
        ['@open-dcp/utilities/vite/SingleSpaTestPlugin', 'singleSpaTestPlugin', 'function']
    ];

    for (const [specifier, name, type] of entries) {
        const entry = await import(specifier);
        assert.equal(typeof entry[name], type, `${specifier} exports ${name}`);
    }
});
