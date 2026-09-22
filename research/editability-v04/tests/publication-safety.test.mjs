import {readFile, access} from 'node:fs/promises';
import {join, resolve} from 'node:path';
// Publication-only checks. These do not authorize native execution or claim browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {researchRoot, repoRoot, productFile, productPackageURL, productRequire, rootRequire, runtimeDirectory} from '../publication/paths.mjs';
import {createStudyRuntimeV1} from '../src/study-runtime-v1.mjs';
import {sealNativeEvidenceV1, verifyNativeEvidenceSealV1} from '../src/study-native-evidence-seal-v1.mjs';
import {runTrustedStudyControlsV1, handwrittenStudyTasksV1} from '../scripts/run-study-controls-v1.mjs';
function withRoots(repo, product, fn) {
  const oldRepo = process.env.CODESIGN_REPO_ROOT, oldProduct = process.env.CODESIGN_PRODUCT_ROOT;
  try {
    if(repo === undefined) delete process.env.CODESIGN_REPO_ROOT; else process.env.CODESIGN_REPO_ROOT = repo;
    if(product === undefined) delete process.env.CODESIGN_PRODUCT_ROOT; else process.env.CODESIGN_PRODUCT_ROOT = product;
    return fn();
  } finally {
    if(oldRepo === undefined) delete process.env.CODESIGN_REPO_ROOT; else process.env.CODESIGN_REPO_ROOT = oldRepo;
    if(oldProduct === undefined) delete process.env.CODESIGN_PRODUCT_ROOT; else process.env.CODESIGN_PRODUCT_ROOT = oldProduct;
  }
}
test('publication paths use validated desktop parser and root tsx without installation', () => {
  const root = repoRoot();
  assert.ok(productPackageURL().href.endsWith('/apps/desktop/package.json'));
  assert.equal(typeof productRequire()('@babel/parser').parse, 'function');
  assert.equal(typeof rootRequire()('tsx/cjs/api').require, 'function');
  assert.ok(runtimeDirectory().startsWith(root));
  withRoots(undefined, root, () => assert.equal(repoRoot(), root));
});
test('explicit relative or forbidden checkout roots fail before access', () => {
  for(const value of ['', '.', '../guessed-product', '/private-test/never-open', '/credentials/never-open']) withRoots(value, undefined, () => assert.throws(repoRoot, /PUBLICATION_REPO_ROOT_INVALID/));
  assert.throws(() => productFile('../escape'), /RELATIVE_PATH_REQUIRED/);
});
test('publication native runtime rejects even structurally authorized admission before paths or I/O', async () => {
  await assert.rejects(createStudyRuntimeV1({manifest:{schemaVersion:'v04-study-controls-admission-1',authorizedTrustedControls:true,calibrationReady:true,evaluatorContractReady:true}}), /PUBLICATION_NATIVE_ADMISSION_BLOCKED/);
});
test('native evidence seal remains an explicitly blocked stub', async () => {
  for(const fn of [sealNativeEvidenceV1, verifyNativeEvidenceSealV1]) await assert.rejects(fn(), /NATIVE_EVIDENCE_SEAL_IMPLEMENTATION_PENDING/);
});
test('publication study CLI library blocks native execution but preserves inert handwritten tasks', async () => {
  assert.equal(handwrittenStudyTasksV1().length, 2);
  await assert.rejects(runTrustedStudyControlsV1({}), /PUBLICATION_NATIVE_EXECUTION_BLOCKED/);
});

test('guarded calibration bodies bind research inputs/out separately from product runtime vendor', async () => {
  assert.notEqual(resolve(researchRoot), resolve(repoRoot()));
  for(const name of ['run-trusted-calibration-r2.mjs', 'run-trusted-calibration-r3.mjs', 'layout-domain-controls-r3.mjs', 'number-value-controls-r3.mjs']) {
    const source = await readFile(new URL('../scripts/' + name, import.meta.url), 'utf8');
    assert.match(source, /const \{researchRoot,runtimeDirectory\}=await import/);
    assert.match(source, /const root=researchRoot;/);
    assert.doesNotMatch(source, /root=repoRoot\(\)/);
    assert.ok(source.indexOf('blockPublicationNativeExecution();') < source.indexOf('const root=researchRoot;'));
  }
  for(const relative of ['src/browser-session-r2.mjs', 'src/browser-session-r3.mjs', 'fixtures/handwritten/value-matrix.html', 'fixtures/handwritten/layout-domain-r3.jsx', 'fixtures/handwritten/number-value-r3.jsx']) await access(join(researchRoot, relative));
  assert.equal(resolve(runtimeDirectory()), resolve(repoRoot(), 'packages/runtime/vendor'));
});