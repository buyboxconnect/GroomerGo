import { createClientFromRequest } from "npm:@base44/sdk";
import { handleBusinessAccess } from "./handler.js";

Deno.serve((request) => handleBusinessAccess(request, createClientFromRequest(request)));
