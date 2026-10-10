import {readFileSync, writeFileSync} from 'node:fs';
const reportFrom = path => readFileSync(path, 'utf8').split('\n').flatMap(line => {
  try {return [JSON.parse(line)];} catch {return [];}
}).findLast(row => row.type === 'report');
const edits = reportFrom('sync/evidence/atomic-gate-ten-edit-rounds.log');
const scope = reportFrom('sync/evidence/atomic-gate-scope.log');
const checks = readFileSync('sync/evidence/post-gate-checks.log', 'utf8').split('\n').flatMap(line => {
  try {return [JSON.parse(line)];} catch {return [];}
});
const editRounds = edits?.rounds?.filter(round => /^edit-\d+$/.test(round.label)) ?? [];
const editCasesPassed = editRounds.length === 10 && editRounds.every(round => round.passed && round.writers === 8 && round.applied === 1 && round.conflicts === 7 && round.storedRevision === round.expectedRevision + 1 && round.payloadMatchesWinner);
const scopePassed = scope?.scopeOnly === true && scope?.passed === true && scope.checks.some(check => check.name === 'tombstone-blocks-eight-current-revision-writers' && check.passed);
const cleanupPassed = [edits, scope].every(report => report?.cleanup?.status === 200 && report.cleanup.remaining === 0);
const postChecksPassed = ['probe-disabled','live-upload-still-paused','read-only-connection'].every(name => checks.some(check => check.check === name && check.passed));
const result = {
  gate: 'base44-existing-record-compare-and-update',
  passed: editCasesPassed && scopePassed && cleanupPassed && postChecksPassed,
  verifiedAt: new Date().toISOString(), backendSdkVersion: '0.8.53',
  editRace: {rounds: editRounds.length, writersPerRound: 8, applied: editRounds.reduce((sum,r) => sum + r.applied,0), conflicts: editRounds.reduce((sum,r) => sum + r.conflicts,0), passed: editCasesPassed},
  scopeAndTombstonePassed: scopePassed, cleanupPassed, postChecksPassed,
  runs: [edits, scope].map(report => ({runId: report?.runId, startedAt: report?.startedAt, finishedAt: report?.finishedAt, originalReportPassed: report?.passed, failures: report?.failures, cleanup: report?.cleanup})),
  qualification: 'Composite evidence: ten successful edit races from the first paced run, plus scope/tombstone cases from a focused follow-up. The first full report failed after its successful races because the missing-id test used a malformed internal ID; the focused follow-up corrects that test. No failed race is treated as a pass.',
  notVerified: ['Unique concurrent record creation', 'Atomic durable operation receipts', 'Transactions across entities', 'Two actual iOS devices and relaunch persistence'],
  liveUploadsEnabled: false,
};
writeFileSync('sync/evidence/atomic-gate-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
process.exitCode = result.passed ? 0 : 1;
