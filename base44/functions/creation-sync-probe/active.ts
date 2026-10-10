import {createClientFromRequest} from "npm:@base44/sdk@0.8.53";
import {handleCreationProbe} from "./handler.js";
Deno.serve(request => handleCreationProbe(request, createClientFromRequest(request)));
