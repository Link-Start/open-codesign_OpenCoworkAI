// Publication implementation suite, not native/pilot evidence. No installation or downloads.
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {researchRoot, checkImplementationDependencies} from './paths.mjs';
const args = process.argv.slice(2);
if (args.some(arg => !['--check-only', '--historical', '--historical-artifacts'].includes(arg)) || args.length > 1) throw Error('PUBLICATION_UNKNOWN_ARGUMENT');
if (Number(process.versions.node.split('.')[0]) !== 22) throw Error('PUBLICATION_NODE_22_LTS_REQUIRED');
if (args.includes('--historical-artifacts')) {
  console.error('HISTORICAL_ARTIFACTS_NOT_DISTRIBUTED: not part of default test. Requires separately reviewed public original plans, source snapshots, simulation receipts, TAP and browser-calibration-r3-MDiU66 report/raw inputs plus portable manifest rebinding. No local results or manifest paths are read. See publication/historical-requirements.json.');
  process.exit(2);
}
const historical = args.includes('--historical');
const files = historical ? ['r3-evidence-audit-v1.test.mjs', 'browser-session-r3.test.mjs'] : readdirSync(path.join(researchRoot, 'tests')).filter(name => name.endsWith('.test.mjs') && name !== 'r3-evidence-audit-v1.test.mjs').sort();
const dependencies = checkImplementationDependencies();
console.log(JSON.stringify({publicationRevision:true, suite: historical ? 'historical-defect-reproductions-not-current-validation' : 'pure-implementation', testFiles: files.length, nativeStudy:'blocked', browserCalls:0, modelCalls:0, evidenceClaim:false, ...(args.includes('--check-only') ? {dependencies, files} : {})}));
if (args.includes('--check-only')) process.exit(0);
const env = {...process.env};
delete env.R3_AUDIT_RECEIPT;
delete env.NODE_OPTIONS;
if (historical) env.CODESIGN_RUN_HISTORICAL = '1'; else delete env.CODESIGN_RUN_HISTORICAL;
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files.map(name => path.join(researchRoot, 'tests', name))], {cwd:researchRoot, env, stdio:'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
