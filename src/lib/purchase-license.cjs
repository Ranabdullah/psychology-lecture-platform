const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function verifyCertificate(c,publicJwk,product,installationId,now=Date.now()){
 try{if(!c||typeof c.payload!=='string'||typeof c.signature!=='string'||c.payload.length>3000)return false;
  if(!crypto.verify('sha256',Buffer.from(c.payload),{key:crypto.createPublicKey({key:publicJwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(c.signature,'base64url')))return false;
  const p=JSON.parse(Buffer.from(c.payload,'base64url'));return p.version===1&&p.product===product&&p.installationId===installationId&&typeof p.activationId==='string'&&Number.isFinite(Date.parse(p.expiresAt))&&Date.parse(p.expiresAt)>now&&Date.parse(p.issuedAt)<=now+60000;
 }catch{return false;}
}
function licenseStore(root,product){
 const file=path.join(root,'Local Data','purchase-activation.json');
 async function identity(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Saved activation cannot be read. Restore your local backup.');const data={installationId:process.env.ACTIVATION_INSTALLATION_ID||crypto.randomUUID(),certificate:null};await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(file,JSON.stringify(data),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;return JSON.parse(await fs.readFile(file,'utf8'));}return data;}}
 async function status(){const data=await identity();return {required:process.env.ACTIVATION_REQUIRED==='true',valid:verifyCertificate(data.certificate,JSON.parse(process.env.ACTIVATION_PUBLIC_JWK||'{}'),product,data.installationId),installationId:data.installationId,product,configured:!!process.env.ACTIVATION_URL&&!!process.env.ACTIVATION_PUBLIC_JWK};}
 async function activate(platform,purchaseKey){const data=await identity(),url=new URL(process.env.ACTIVATION_URL||'');if(url.protocol!=='https:'&&url.hostname!=='127.0.0.1'&&url.hostname!=='localhost')throw Error('Activation requires a secure seller connection.');
  const response=await fetch(new URL('/activate',url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product,installationId:data.installationId,platform,purchaseKey}),signal:AbortSignal.timeout(40000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Purchase could not be verified.');
  if(!verifyCertificate(result.certificate,JSON.parse(process.env.ACTIVATION_PUBLIC_JWK||'{}'),product,data.installationId))throw Error('Activation signature was not valid.');
  const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify({...data,certificate:result.certificate},null,2));await fs.rename(temp,file);return {activated:true,activationId:result.activationId,expiresInDays:result.expiresInDays};
 }
 return {status,activate};
}
module.exports={verifyCertificate,licenseStore};
