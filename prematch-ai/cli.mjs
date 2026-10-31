import {readFileSync,writeFileSync} from 'node:fs';
import {trainArtifact} from './fit.mjs';
import {analyze} from './runtime.mjs';
import {validateCohort} from './evidence.mjs';
const [action,inputFile,outputFile]=process.argv.slice(2);
if(!['train','analyze','validate'].includes(action)||!inputFile||!outputFile)throw Error('Usage: node prematch-ai/cli.mjs train|analyze|validate INPUT.json OUTPUT.json');
const input=JSON.parse(readFileSync(inputFile,'utf8'));
const result=action==='train'?await trainArtifact(input):action==='analyze'?await analyze(input):await validateCohort(input.pairs,input.outcomes,{closingQuotes:input.closingQuotes||[]});
writeFileSync(outputFile,JSON.stringify(result,null,2));console.log(JSON.stringify({status:'DONE',action,providerRequests:0,productionWrites:0}));
