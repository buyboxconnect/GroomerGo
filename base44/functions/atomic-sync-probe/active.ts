import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { handleProbe } from "./probe.js";

Deno.serve(request => handleProbe(request, createClientFromRequest(request)));
