import { readFileSync, writeFileSync } from 'node:fs';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node extract-report.mjs input.log output.json');
const records = readFileSync(input, 'utf8').split('\n').flatMap(line => {
  try { return [JSON.parse(line)]; } catch { return []; }
});
const report = records.findLast(record => record.type === 'report');
if (!report) throw new Error('No sanitized gate report was emitted');
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({gate: report.gate, passed: report.passed, rounds: report.rounds.length, cleanup: report.cleanup}));
process.exitCode = report.passed ? 0 : 1;
