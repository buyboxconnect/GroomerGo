Deno.serve(() => Response.json({code:"PROBE_DISABLED"}, {status:410,headers:{"Cache-Control":"no-store"}}));
