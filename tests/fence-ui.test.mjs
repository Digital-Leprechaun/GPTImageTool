/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

// Exercise the actual viewer event handlers without a host bridge or image generation.
const viewer=(await readFile(new URL('../web/viewer.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function setup(){
  const nodes=new Map(),listeners=new Map();
  function element(){
    return {style:{},dataset:{},attributes:{},children:[],value:'4',disabled:false,
      naturalWidth:600,naturalHeight:1000,clientWidth:600,clientHeight:1000,
      classList:{toggle(){},add(){},remove(){}},
      setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},
      append(node){this.children.push(node);},replaceChildren(){this.children=[];},
      addEventListener(){},focus(){},closest(){return null;},
      setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){},
      getBoundingClientRect(){return {left:0,top:0,right:600,bottom:1000,width:600,height:1000};},
      click(){if(!this.disabled)this.onclick?.();}};
  }
  const colors=['yellow','red','blue','green'].map(color=>Object.assign(element(),{dataset:{color}}));
  const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},
    querySelectorAll(){return colors;},createElementNS:element,createElement:element,body:element(),
    addEventListener(type,callback){listeners.set(type,callback);}};
  const window={addEventListener(){}};window.parent=window;
  const context=vm.createContext({document,window,crypto:{randomUUID},console,
    App:class{},OpenAIExtensions:class{},ResizeObserver:class{observe(){}},setTimeout,clearTimeout});
  vm.runInContext(viewer,context);
  vm.runInContext("source='test';setMode('fence');",context);
  const viewport=nodes.get('#viewport');
  return {nodes,colors,read:expression=>JSON.parse(vm.runInContext(`JSON.stringify(${expression})`,context)),
    click(x,y){const event={button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}};viewport.onpointerdown(event);viewport.onpointerup(event);},
    key(key,ctrlKey=false){listeners.get('keydown')({key,ctrlKey,target:viewport,preventDefault(){}});}};
}

test('fence closes on the first point and fills using the currently selected color',()=>{
  const ui=setup();
  ui.click(100,100);ui.click(300,100);ui.click(300,300);
  assert.equal(ui.read('strokes.length'),0);
  ui.colors[2].onclick();ui.click(103,103);
  assert.equal(ui.read('fencePoints.length'),0);
  assert.equal(ui.read('strokes.length'),1);
  assert.equal(ui.read('strokes[0].kind'),'fence');
  assert.equal(ui.read('strokes[0].color'),'blue');
  assert.equal(ui.read('strokes[0].points.length'),3);
  assert.equal(ui.nodes.get('#marks').children[0].attributes.fill,'#479dff');
});

for(const [label,key,ctrl] of [['Escape','Escape',false],['Ctrl-Z','z',true]]){
  test(`${label} cancels the unfinished fence without undoing completed highlights`,()=>{
    const ui=setup();
    ui.click(100,100);ui.click(300,100);ui.click(300,300);ui.click(100,100);
    ui.click(400,400);ui.click(500,400);ui.key(key,ctrl);
    assert.equal(ui.read('fencePoints.length'),0);
    assert.equal(ui.read('strokes.length'),1);
    assert.equal(ui.nodes.get('#marks').children.length,1);
  });
}

test('an unfinished fence cannot close with fewer than three points or be submitted',()=>{
  const ui=setup();
  ui.click(100,100);ui.click(300,100);ui.click(100,100);
  assert.equal(ui.read('fencePoints.length'),2);
  assert.equal(ui.read('strokes.length'),0);
  assert.equal(ui.nodes.get('#submit').disabled,true);
});
