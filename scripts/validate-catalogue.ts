import { validateCatalogue } from '../src/lib/catalogue';
const result=validateCatalogue();
if(process.argv.includes('--production')&&!result.reviewed){console.error('BLOCKED: the catalogue is synthetic and has no professional review.');process.exit(1);}
console.log(JSON.stringify(result));
