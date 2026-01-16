import { InitHandler } from '../dist/index.js';

console.log('Importing from dist/index.js...');
if (typeof InitHandler !== 'function') {
  console.error('❌ InitHandler export is missing or not a function');
  process.exit(1);
}

console.log('✅ Library verification successful: InitHandler imported correctly');
