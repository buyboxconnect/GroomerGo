"""Run one actual Simulator phase; private test capability is never printed."""
import json, os, pathlib, subprocess, sys, time

devices = {'a': '9817E7E6-CB64-4DEC-BD53-E4E882D60746', 'b': '1E50A7A1-6265-4731-825A-E4AB0D7921BA'}
device, phase = sys.argv[1:3]
seed = json.loads(pathlib.Path('/private/tmp/groomergo-two-device.json').read_text())
env = dict(os.environ, DEVELOPER_DIR='/Applications/Xcode.app/Contents/Developer')
bundle = 'devplaceholder.IUJCWGE4.GroomerGo'
def sim(*args):
    return subprocess.run(['xcrun', 'simctl', *args], env=env, capture_output=True, text=True)

sim('terminate', devices[device], bundle)
root = pathlib.Path(sim('get_app_container', devices[device], bundle, 'data').stdout.strip())
result = root / 'Library/Application Support/SyncValidation' / seed['runId'] / (phase + '.json')
if result.exists(): result.unlink()
if phase in ['seed', 'competing-create']:
    env['SIMCTL_CHILD_GROOMERGO_PROBE_CAPABILITY'] = seed['capability']
launch = sim('launch', devices[device], bundle, '-sync-validation', '-run', seed['runId'], '-business', seed['businessId'], '-record', seed['recordUUID'], '-phase', phase)
if launch.returncode: raise SystemExit('SIMULATOR_LAUNCH_FAILED')
for _ in range(60):
    if result.exists(): break
    time.sleep(0.5)
if not result.exists(): raise SystemExit('NO_SIMULATOR_EVIDENCE')
report = json.loads(result.read_text())
report['simulatorId'] = devices[device]
report['device'] = device
evidence = pathlib.Path(__file__).resolve().parents[2] / 'sync/evidence'
evidence.mkdir(parents=True, exist_ok=True)
(evidence / ('native-' + device + '-' + phase + '.json')).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
if not report['passed']: raise SystemExit(1)
