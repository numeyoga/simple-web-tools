import { base, node } from './eslint.js';

export default [...base(), node(['*.js'])];
