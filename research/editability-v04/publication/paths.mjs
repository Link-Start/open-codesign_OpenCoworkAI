// Publication revision: validated checkout paths; no machine-path fallback.
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
export const researchRoot = fileURLToPath(new URL('../', import.meta.url));
const forbidden = /(?:^|[\\/])(?:private[^\\/]*|\.env[^\\/]*|credentials?)(?:[\\/]|$)/i;
function validate(candidate) {
  if (!path.isAbsolute(candidate) || forbidden.test(candidate)) throw Error('PUBLICATION_REPO_ROOT_INVALID');
  const root = realpathSync(candidate);
  if (forbidden.test(root)) throw Error('PUBLICATION_REPO_ROOT_INVALID');
  for (const relative of ['package.json', 'apps/desktop/package.json', 'apps/desktop/src/main/source-edit-engine.ts', 'packages/shared', 'packages/runtime/vendor/babel.standalone.js', 'packages/runtime/vendor/react.umd.js', 'packages/runtime/vendor/react-dom.umd.js']) {
    if (!existsSync(path.join(root, relative))) throw Error(`PUBLICATION_REPO_LAYOUT_MISSING: ${relative}`);
  }
  return root;
}
export function repoRoot() {
  const explicit = [process.env.CODESIGN_REPO_ROOT, process.env.CODESIGN_PRODUCT_ROOT].filter(value => value !== undefined);
  if (explicit.length) {
    const roots = explicit.map(validate);
    if (roots.some(root => root !== roots[0])) throw Error('PUBLICATION_ROOT_OVERRIDES_DISAGREE');
    return roots[0];
  }
  if (path.basename(path.resolve(researchRoot)) !== 'editability-v04' || path.basename(path.dirname(path.resolve(researchRoot))) !== 'research') throw Error('PUBLICATION_REPO_ROOT_REQUIRED: set CODESIGN_REPO_ROOT or CODESIGN_PRODUCT_ROOT to an absolute checkout root');
  return validate(path.resolve(researchRoot, '../..'));
}
export function productFile(relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..') || forbidden.test(relative)) throw Error('PUBLICATION_PRODUCT_RELATIVE_PATH_REQUIRED');
  return path.join(repoRoot(), relative);
}
export const productFileURL = relative => pathToFileURL(productFile(relative));
export const productPackageURL = () => productFileURL('apps/desktop/package.json');
export const productRequire = () => createRequire(productPackageURL());
export const rootRequire = () => createRequire(productFileURL('package.json'));
export const runtimeDirectory = () => productFile('packages/runtime/vendor');
export function checkImplementationDependencies() {
  return { root: repoRoot(), parser: productRequire().resolve('@babel/parser'), tsx: rootRequire().resolve('tsx/cjs/api'), runtimeDirectory: runtimeDirectory(), formalNativeReady: false };
}
export function assertHistoricalOptIn() {
  if (process.env.CODESIGN_RUN_HISTORICAL !== '1') throw Error('HISTORICAL_NONDEFAULT_OPT_IN_REQUIRED');
}
