import 'server-only';
const {licenseStore}=require('./purchase-license.cjs');
export const purchaseLicense=licenseStore(process.cwd(),'psych-lecture');
