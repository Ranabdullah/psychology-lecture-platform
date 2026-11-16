import {defineConfig,globalIgnores} from 'eslint/config';
import nextCore from 'eslint-config-next/core-web-vitals';
export default defineConfig([...nextCore,globalIgnores(['.next/**','next-env.d.ts'])]);
