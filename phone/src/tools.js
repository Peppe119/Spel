// Verktygen som AI-rösten får använda. Själva logiken finns i js/helpline.js
// (delas med betasidan) och kör samma filterkod som webbsidan.
import { TOOLS_SCHEMA, validate, findHelp, getPlace } from "./data.js";

// Verktygsinput strömmas direkt (eager_input_streaming), så API:t validerar den inte.
// validate() kontrollerar den innan verktyget körs.
export const TOOLS = TOOLS_SCHEMA.map(t => ({ ...t, eager_input_streaming: true }));
export { validate, findHelp, getPlace };
