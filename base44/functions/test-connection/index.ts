import { createClientFromRequest } from "npm:@base44/sdk";
import { handleConnection } from "./handler.js";

Deno.serve((request) => handleConnection(request, createClientFromRequest(request)));
