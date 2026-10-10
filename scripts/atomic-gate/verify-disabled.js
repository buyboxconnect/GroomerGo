try {
  await base44.functions.invoke('atomic-sync-probe', {action: 'prepare', runId: crypto.randomUUID()});
  console.log(JSON.stringify({check: 'probe-disabled', passed: false, reason: 'REQUEST_ACCEPTED'}));
} catch (error) {
  const status = error?.status || error?.response?.status || 0;
  const code = error?.data?.code || error?.response?.data?.code;
  console.log(JSON.stringify({check: 'probe-disabled', status, code, passed: status === 410 && code === 'PROBE_DISABLED'}));
}
try {
  await base44.functions.invoke('sync-workspace', {});
  console.log(JSON.stringify({check: 'live-upload-still-paused', passed: false, reason: 'REQUEST_ACCEPTED'}));
} catch (error) {
  const status = error?.status || error?.response?.status || 0;
  const code = error?.data?.code || error?.response?.data?.code;
  console.log(JSON.stringify({check: 'live-upload-still-paused', status, code, passed: status === 409 && code === 'RECORD_SYNC_REQUIRED'}));
}
try {
  const response = await base44.functions.invoke('test-connection', {});
  console.log(JSON.stringify({check: 'read-only-connection', passed: response.data?.connected === true && !!response.data?.user?.id}));
} catch (error) {
  console.log(JSON.stringify({check: 'read-only-connection', status: error?.status || error?.response?.status || 0, passed: false}));
}
