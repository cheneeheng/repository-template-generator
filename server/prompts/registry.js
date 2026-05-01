import { CUSTOMISE_V1 } from './versions/customise.v1.js';
import { CUSTOMISE_V2 } from './versions/customise.v2.js';

const VERSIONS = {
  'customise-v1': CUSTOMISE_V1,
  'customise-v2': CUSTOMISE_V2,
};

const ACTIVE_KEY = process.env.PROMPT_VERSION ?? 'customise-v2';

export const CURRENT_PROMPT_VERSION = VERSIONS[ACTIVE_KEY];

if (!CURRENT_PROMPT_VERSION) {
  throw new Error(`Unknown PROMPT_VERSION: "${ACTIVE_KEY}". Available: ${Object.keys(VERSIONS).join(', ')}`);
}
