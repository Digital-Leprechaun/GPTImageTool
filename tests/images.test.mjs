/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildReferences, compositeSelection, requestSchema } from '../lib/images.mjs';

test('finishing an edit keeps every unpainted RGBA pixel exactly unchanged', async () => {
  const width=41,height=31, raw=Buffer.alloc(width*height*4);
  for(let i=0;i<raw.length;i++)raw[i]=(i*37)%256;
  const source=await sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer();
  const candidate=await sharp({create:{width,height,channels:4,background:{r:225,g:30,b:100,alpha:1}}}).png().toBuffer();
  const refs=await buildReferences(source,[{color:'yellow',width:.14,points:[[.5,.5]]}]);
  const result=await compositeSelection(source,candidate,refs.mask);
  const output=await sharp(result).raw().toBuffer();
  const edited=await sharp(candidate).raw().toBuffer();
  const mask=await sharp(refs.mask).greyscale().raw().toBuffer();
  let selected=0,unchanged=0;
  for(let i=0;i<width*height;i++){
    if(mask[i]===255){assert.deepEqual(output.subarray(i*4,i*4+4),edited.subarray(i*4,i*4+4));selected++;}
    else{assert.deepEqual(output.subarray(i*4,i*4+4),raw.subarray(i*4,i*4+4));unchanged++;}
  }
  assert.ok(selected>0&&unchanged>0);
});
test('a ring highlight does not authorize changing its unpainted interior',async()=>{
  const source=await sharp({create:{width:100,height:100,channels:4,background:'#444444'}}).png().toBuffer();
  const refs=await buildReferences(source,[{color:'red',width:.05,points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8],[.2,.2]]}]);
  const mask=await sharp(refs.mask).greyscale().raw().toBuffer();
  assert.equal(mask[50*100+50],0);assert.equal(mask[20*100+50],255);
  const api=await sharp(refs.apiMask).raw().toBuffer();
  assert.equal(api[(20*100+50)*4+3],0);assert.equal(api[(50*100+50)*4+3],255);
});
test('candidate dimensions must match; no silent stretching',async()=>{
  const source=await sharp({create:{width:30,height:20,channels:4,background:'#555'}}).png().toBuffer();
  const candidate=await sharp({create:{width:31,height:20,channels:4,background:'#fff'}}).png().toBuffer();
  const refs=await buildReferences(source,[{color:'blue',width:.1,points:[[.4,.4]]}]);
  await assert.rejects(compositeSelection(source,candidate,refs.mask),/Dimensions differ/);
});

test('a filled concave fence selects its interior but excludes its notch and outside pixels',async()=>{
  const source=await sharp({create:{width:100,height:100,channels:4,background:'#444444'}}).png().toBuffer();
  const candidate=await sharp({create:{width:100,height:100,channels:4,background:'#ff0000'}}).png().toBuffer();
  const refs=await buildReferences(source,[{kind:'fence',color:'blue',width:.001,points:[[.2,.2],[.8,.2],[.8,.4],[.4,.4],[.4,.8],[.2,.8]]}]);
  const mask=await sharp(refs.mask).greyscale().raw().toBuffer();
  assert.equal(mask[30*100+30],255);
  assert.equal(mask[60*100+30],255);
  assert.equal(mask[60*100+60],0);
  assert.equal(mask[10*100+10],0);
  const original=await sharp(source).raw().toBuffer();
  const edited=await sharp(candidate).raw().toBuffer();
  const output=await sharp(await compositeSelection(source,candidate,refs.mask)).raw().toBuffer();
  for(let i=0;i<100*100;i++)assert.deepEqual(output.subarray(i*4,i*4+4),(mask[i]?edited:original).subarray(i*4,i*4+4));
});

test('request schema preserves fence type, accepts legacy brush strokes, and rejects unfinished fences',()=>{
  const base={requestId:'00000000-0000-4000-8000-000000000001',name:'image.png',source:'image',prompt:'edit'};
  const stroke={color:'yellow',width:.04,points:[[.2,.2],[.8,.2],[.5,.8]]};
  assert.equal(requestSchema.parse({...base,strokes:[{...stroke,kind:'fence'}]}).strokes[0].kind,'fence');
  assert.equal(requestSchema.parse({...base,strokes:[stroke]}).strokes[0].kind,undefined);
  assert.throws(()=>requestSchema.parse({...base,strokes:[{...stroke,kind:'fence',points:[[.2,.2],[.8,.2]]}]}));
});
