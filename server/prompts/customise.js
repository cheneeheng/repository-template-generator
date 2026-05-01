// Thin re-export for any legacy import of SYSTEM_PROMPT — nothing should import this file after ITER_05
export { CUSTOMISE_V1 as SYSTEM_PROMPT_VERSION } from './versions/customise.v1.js';
import { CUSTOMISE_V1 } from './versions/customise.v1.js';
export const SYSTEM_PROMPT = CUSTOMISE_V1.system;
