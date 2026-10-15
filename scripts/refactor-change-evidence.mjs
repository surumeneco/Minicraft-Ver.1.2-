#!/usr/bin/env node
// Project-level deterministic preflight, NOT the CAT-TDD conformance validator.
// Formal CAT process/model/implementation conformance belongs to the canonical
// CAT-TDD workspace and cannot be inferred from a green source-code CI run.
import {execFileSync} from 'node:child_process';
import {cpSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function assessChangeSet(paths,prTitle=''){
 const changed=[...new Set(paths)].filter(Boolean);
 const sources=changed.filter(x=>x.startsWith('src/')||x==='index.html');
 const tests=changed.filter(x=>/^tests\/.+\.test\.mjs$/.test(x)||/^tests\/browser\/.+\.mjs$/.test(x));
 const documents=changed.filter(x=>/^docs\/.+\.md$/.test(x));
 const errors=[];
 if(sources.length){
  if(!tests.length)errors.push('Production source changes require a regression test file in the same PR');
  if(!documents.length)errors.push('Production source changes require documentation of preserved behavior and scope');
 }
 return {sources,tests,documents,errors,requireBaseline:sources.length>0&&/^refactor:/i.test(prTitle.trim())};
}

function git(...args){return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}).trim()}
function runBaseline(baseSha){
 const original=resolve('.');
 const tmp=mkdtempSync(join(tmpdir(),'minicraft-refactor-baseline-'));
 let attached=false;
 try{
  git('worktree','add','--detach',tmp,baseSha);attached=true;
  // Refactor tests are authored BEFORE changing product behavior and must pass
  // against the unmodified base tree. Do not copy modified product source.
  cpSync(join(original,'tests'),join(tmp,'tests'),{recursive:true,force:true});
  execFileSync('node',['--test',...git('ls-files','tests/*.test.mjs').split('\n').filter(Boolean)],{
   cwd:tmp,stdio:'inherit',timeout:90000
  });
 }finally{
  if(attached)try{git('worktree','remove','--force',tmp)}catch(e){console.error(e.message)}
  rmSync(tmp,{recursive:true,force:true});
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=process.env.CAT_DIFF_BASE||'';
 if(!/^[a-f0-9]{40}$/.test(base)){
  console.error('CAT_DIFF_BASE must be the 40-character PR base SHA');process.exit(2);
 }
 try{
  const paths=git('diff','--name-only','--diff-filter=ACMR',base+'...HEAD').split('\n').filter(Boolean);
  const result=assessChangeSet(paths,process.env.CAT_PR_TITLE||'');
  console.log('Change-set classification: '+JSON.stringify(result));
  if(result.errors.length){for(const e of result.errors)console.error(e);process.exitCode=1}
  else if(result.requireBaseline){console.log('Running unchanged-oracle suite against the original base source');runBaseline(base)}
  else console.log('No refactor-baseline requirement for this PR (does not imply CAT conformance)');
 }catch(e){console.error('Change-set preflight blocked:',e.message);process.exitCode=1}
}
