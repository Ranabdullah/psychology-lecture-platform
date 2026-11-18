import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
const directory=new URL('./private/',import.meta.url);
if(existsSync(new URL('gateway.txt',directory)))throw Error('Private setup already exists. Retain your original values; do not overwrite a working classroom.');
const gateway=randomBytes(32).toString('hex'),invite=randomBytes(32).toString('hex');const hash=value=>createHash('sha256').update(value).digest('hex');
mkdirSync(directory,{recursive:true});
const schema=readFileSync(new URL('schema.sql',import.meta.url),'utf8').replace('REPLACE_GATEWAY_HASH',hash(gateway)).replace('REPLACE_SETUP_HASH',hash(invite));
writeFileSync(new URL('setup.sql',directory),schema,{flag:'wx',mode:0o600});writeFileSync(new URL('gateway.txt',directory),gateway,{flag:'wx',mode:0o600});writeFileSync(new URL('teacher-setup.txt',directory),invite,{flag:'wx',mode:0o600});
console.log('Generated private/setup.sql, private/gateway.txt and private/teacher-setup.txt. Keep these local and private. Follow README.md; no secret values were printed.');
