/*! Copyright (c) 2026 Joseph M Wilcox. SPDX-License-Identifier: MIT */
import { App } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions, OpenAIFileEntrypointInputSchema } from '@openai/mcp-extensions/app';

const $ = selector => document.querySelector(selector);
const palette = { red:'#ff5656', yellow:'#ffd34f', blue:'#479dff', green:'#4cda80' };
const viewport = $('#viewport'), stage = $('#stage'), image = $('#image'), marks = $('#marks');
const beforeImage = $('#before-image'), comparisonSlider = $('#comparison-slider');
let comparisonSource = null;
let strokes = [], color = 'yellow', mode = 'draw', scale = 1, x = 0, y = 0;
let fencePoints = [], fenceCursor = null;
let source = null, name = '', drawing = null, drag = null, space = false, busy = false;
let requestId = crypto.randomUUID(), waiting = null, pollTimer = null, connected = false, inlineHandoff = false;
const app = new App({ name:'gpt-image-markup', version:'0.1.5' });
const extensions = new OpenAIExtensions(app);
const say = message => $('#status').textContent = message;
$('#download').onclick = event => { if(!source)event.preventDefault(); };
function controls() {
  $('#submit').disabled = busy || !source || !strokes.length || fencePoints.length>0 || !$('#prompt').value.trim();
  $('#undo').disabled = $('#clear').disabled = busy || (!strokes.length && !fencePoints.length);
  $('#brush').disabled = busy || mode!=='draw';
  $('#prompt').disabled = $('#open').disabled = busy;
  for (const button of document.querySelectorAll('[data-color]')) button.disabled = busy;
  viewport.classList.toggle('busy', busy);
  viewport.classList.toggle('panning', mode === 'pan' || space);
  $('#summary').textContent = strokes.length ? Object.keys(palette).map(c => {
    const n = strokes.filter(s => s.color === c).length; return n ? `${c}: ${n}` : '';
  }).filter(Boolean).join(' · ') : 'Highlights define the edit boundary.';
}
function transform() {
  stage.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  $('#zoom').textContent = `${Math.round(scale*100)}%`;
  if(fencePoints.length)paint();
}
function fit() {
  if (!source) return;
  scale = Math.min((viewport.clientWidth-32)/image.naturalWidth,(viewport.clientHeight-32)/image.naturalHeight,1);
  x=(viewport.clientWidth-image.naturalWidth*scale)/2; y=(viewport.clientHeight-image.naturalHeight*scale)/2; transform();
}
function zoom(next, px=viewport.clientWidth/2, py=viewport.clientHeight/2) {
  next=Math.max(.02,Math.min(8,next)); const ratio=next/scale;
  x=px-(px-x)*ratio; y=py-(py-y)*ratio; scale=next; transform();
}
function paint() {
  marks.replaceChildren();
  for (const stroke of strokes) {
    const width=stroke.width*image.naturalHeight;
    const node=document.createElementNS('http://www.w3.org/2000/svg',stroke.kind==='fence'?'polygon':stroke.points.length===1?'circle':'polyline');
    node.setAttribute('opacity','.38');
    if(stroke.kind==='fence'){
      node.setAttribute('points',stroke.points.map(([px,py])=>`${px*image.naturalWidth},${py*image.naturalHeight}`).join(' '));
      node.setAttribute('fill',palette[stroke.color]);node.setAttribute('fill-rule','evenodd');
    } else if(stroke.points.length===1) {
      node.setAttribute('cx',stroke.points[0][0]*image.naturalWidth); node.setAttribute('cy',stroke.points[0][1]*image.naturalHeight);
      node.setAttribute('r',width/2); node.setAttribute('fill',palette[stroke.color]);
    } else {
      node.setAttribute('points',stroke.points.map(([px,py])=>`${px*image.naturalWidth},${py*image.naturalHeight}`).join(' '));
      node.setAttribute('stroke',palette[stroke.color]);node.setAttribute('stroke-width',width);node.setAttribute('fill','none');
      node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');
    }
    marks.append(node);
  }
  if(fencePoints.length){
    const outline=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    const preview=fenceCursor?[...fencePoints,fenceCursor]:fencePoints;
    outline.setAttribute('points',preview.map(([px,py])=>`${px*image.naturalWidth},${py*image.naturalHeight}`).join(' '));
    outline.setAttribute('fill','none');outline.setAttribute('stroke',palette[color]);
    outline.setAttribute('stroke-width',2/scale);outline.setAttribute('stroke-dasharray',`${5/scale} ${4/scale}`);
    marks.append(outline);
    fencePoints.forEach(([px,py],index)=>{
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',px*image.naturalWidth);dot.setAttribute('cy',py*image.naturalHeight);
      dot.setAttribute('r',(index===0?7:4)/scale);dot.setAttribute('fill',palette[color]);
      dot.setAttribute('stroke','#141719');dot.setAttribute('stroke-width',2/scale);
      marks.append(dot);
    });
  }
  controls();
}
function compare(value) {
  const amount = comparisonSource ? Number(value) : 100;
  comparisonSlider.value = String(amount);
  image.style.clipPath = `inset(0 ${100-amount}% 0 0)`;
  $('#comparison-divider').style.left = `${amount}%`;
  $('#comparison-divider').hidden = !comparisonSource || amount === 0 || amount === 100;
  $('#comparison-value').textContent = `${amount}% edited image`;
  comparisonSlider.setAttribute('aria-valuetext', amount === 0 ? 'Before last edit' : amount === 100 ? 'After edit' : `${amount}% edited image revealed from the left`);
}
comparisonSlider.oninput = () => compare(comparisonSlider.value);
async function load(data, filename, before = null) {
  const candidate=new Image(); candidate.src=data; await candidate.decode();
  if(candidate.naturalWidth*candidate.naturalHeight>24_000_000) throw new Error('Use an image with at most 24 million pixels.');
  source=data; name=filename; image.src=data; await image.decode();
  const download = $('#download');
  const extension = /^data:image\/jpeg;/.test(data) ? 'jpg' : /^data:image\/webp;/.test(data) ? 'webp' : 'png';
  download.href = data;
  download.download = `${filename.split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/[<>:"|?*]/g,'_') || 'image'}.${extension}`;
  download.setAttribute('aria-disabled','false'); download.removeAttribute('tabindex');
  comparisonSource = null;
  if(before) {
    beforeImage.src = before; await beforeImage.decode();
    if(beforeImage.naturalWidth === image.naturalWidth && beforeImage.naturalHeight === image.naturalHeight) comparisonSource = before;
  }
  beforeImage.hidden = !comparisonSource; $('#comparison').hidden = !comparisonSource;
  compare(100);
  strokes=[]; drawing=null; fencePoints=[];fenceCursor=null; $('#prompt').value=''; requestId=crypto.randomUUID();
  $('#filename').textContent=`${name} · ${image.naturalWidth} × ${image.naturalHeight}`;
  stage.style.width=`${image.naturalWidth}px`;stage.style.height=`${image.naturalHeight}px`;
  marks.setAttribute('viewBox',`0 0 ${image.naturalWidth} ${image.naturalHeight}`);
  stage.style.display='block';$('#empty').style.display='none';paint();fit();
}
async function fileData(file) {
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size>28_000_000) throw new Error('Use an image smaller than 28 MB.');
  return new Promise((resolve,reject)=>{ const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file); });
}
async function importFile(file) {
  if(!file)return;
  if(busy){say('Wait for the current edit to finish before replacing the image.');return;}
  busy=true;controls();
  try {
    await load(await fileData(file),file.name);
    drag=null;space=false;$('#handoff').hidden=true;setMode('draw');
    say('Highlight the areas you want to change.');
  } catch(e){say(e.message);} finally {busy=false;controls();}
}
$('#open').addEventListener('change',async event=>{
  try { await importFile(event.target.files[0]); } finally {event.target.value='';}
});
// Handle file drops across the viewer, including SVG marks, without browser navigation.
let fileDragDepth=0;
const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
document.addEventListener('dragenter',event=>{
  if(!hasFiles(event))return;
  event.preventDefault();fileDragDepth++;viewport.classList.add('file-drag');
});
document.addEventListener('dragover',event=>{
  if(!hasFiles(event))return;
  event.preventDefault();event.dataTransfer.dropEffect=busy?'none':'copy';
});
document.addEventListener('dragleave',event=>{
  if(!hasFiles(event))return;
  fileDragDepth=Math.max(0,fileDragDepth-1);
  if(!fileDragDepth)viewport.classList.remove('file-drag');
});
document.addEventListener('drop',async event=>{
  if(!hasFiles(event))return;
  event.preventDefault();fileDragDepth=0;viewport.classList.remove('file-drag');
  const files=Array.from(event.dataTransfer.files);
  if(files.length!==1){say('Drop one PNG, JPEG, or WebP image at a time.');return;}
  await importFile(files[0]);
});
window.addEventListener('dragend',()=>{fileDragDepth=0;viewport.classList.remove('file-drag');});
for(const button of document.querySelectorAll('[data-color]'))button.onclick=()=>{
  color=button.dataset.color;for(const b of document.querySelectorAll('[data-color]'))b.setAttribute('aria-pressed',String(b===button));
  paint();
};
$('#brush').oninput=()=>$('#brush-value').textContent=`${$('#brush').value}%`;
function cancelFence(){fencePoints=[];fenceCursor=null;paint();say('Fence cancelled.');}
function setMode(value){
  if(value!==mode && fencePoints.length)cancelFence();
  mode=value;for(const [id,value] of [['draw','draw'],['fence','fence'],['pan','pan']])$('#'+id).setAttribute('aria-pressed',String(mode===value));
  controls();if(mode==='fence')say('Click points, then click the first point to fill the fence. Ctrl-Z or Esc cancels.');
}
$('#draw').onclick=()=>setMode('draw');$('#fence').onclick=()=>setMode('fence');$('#pan').onclick=()=>setMode('pan');
function editChanged(){requestId=crypto.randomUUID();$('#handoff').hidden=true;paint();}
$('#undo').onclick=()=>{if(fencePoints.length){cancelFence();return;}strokes.pop();editChanged();};$('#clear').onclick=()=>{fencePoints=[];fenceCursor=null;strokes=[];editChanged();};
$('#prompt').oninput=()=>{requestId=crypto.randomUUID();controls();};
$('#plus').onclick=()=>zoom(scale*1.25);$('#minus').onclick=()=>zoom(scale/1.25);$('#fit').onclick=fit;$('#actual').onclick=()=>zoom(1);
viewport.onwheel=event=>{if(!source)return;event.preventDefault();const box=viewport.getBoundingClientRect();zoom(scale*Math.exp(-event.deltaY*.001),event.clientX-box.left,event.clientY-box.top);};
function point(event) {
  const box=marks.getBoundingClientRect();
  return [Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))];
}
viewport.onpointerdown=event=>{
  if(!source || (event.button!==0 && event.button!==1) || drawing || drag)return;
  if(busy && mode!=='pan' && !space && event.button!==1)return;
  event.preventDefault(); viewport.focus();viewport.setPointerCapture(event.pointerId);
  if(mode==='pan'||space||event.button===1)drag={id:event.pointerId,px:event.clientX,py:event.clientY,x,y};
  else {
    const box=marks.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)return;
    if(strokes.length>=100){say('Submit these highlights before adding more.');return;}
    compare(100); // Always paint on the current edit, even after inspecting the previous image.
    if(mode==='fence'){
      const next=point(event),first=fencePoints[0];
      const close=first && Math.hypot((next[0]-first[0])*box.width,(next[1]-first[1])*box.height)<=10;
      if(close && fencePoints.length>=3){
        strokes.push({kind:'fence',color,width:.001,points:fencePoints});
        fencePoints=[];fenceCursor=null;editChanged();say('Fence filled.');
      }else if(close){say('Add at least three points before closing the fence.');}
      else if(fencePoints.length<4000){fencePoints.push(next);fenceCursor=null;paint();}
      return;
    }
    drawing={color,width:Number($('#brush').value)/100,points:[point(event)],pointerId:event.pointerId};
    strokes.push(drawing);editChanged();
  }
};
viewport.onpointermove=event=>{
  if(drag?.id===event.pointerId){x=drag.x+event.clientX-drag.px;y=drag.y+event.clientY-drag.py;transform();}
  if(drawing?.pointerId===event.pointerId && drawing.points.length<4000){drawing.points.push(point(event));paint();}
  if(mode==='fence' && fencePoints.length && !drag && !space){fenceCursor=point(event);paint();}
};
function finishPointer(event){if(drawing?.pointerId===event.pointerId)drawing=null;if(drag?.id===event.pointerId)drag=null;if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);}
viewport.onpointerup=viewport.onpointercancel=finishPointer;
document.addEventListener('keydown',event=>{
  if(fencePoints.length && (event.key==='Escape'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'))){event.preventDefault();cancelFence();return;}
  if(event.target.closest('textarea,input'))return;
  if(event.code==='Space'){event.preventDefault();space=true;controls();}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!busy){event.preventDefault();$('#undo').click();}
});
document.addEventListener('keyup',event=>{if(event.code==='Space'){space=false;controls();}});
window.addEventListener('blur',()=>{space=false;drawing=null;drag=null;controls();});
new ResizeObserver(()=>{if(source)fit();}).observe(viewport);
async function tool(name,args){
  const response=await app.callServerTool({name,arguments:args});
  if(response.isError)throw new Error(response.content?.find(c=>c.type==='text')?.text||'The request failed.');return response;
}
async function local(url,body){
  const response=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed.');return result;
}
function instruction(request){
  const presentation=inlineHandoff
    ? 'After finish_markup_edit succeeds, call open_image_markup with sourcePath set to its returned resultPath to open a fresh inline editor at the current point in the chat with before/after comparison. The old inline editor collapses on completion.'
    : 'The existing viewer automatically displays the edited image.';
  return `Apply image markup request ${request.id} in this session. Call get_markup_request with requestId "${request.id}" and inspect source.png and marked-reference.png in ${request.directory}. Instructions: ${request.prompt}\nColors are annotations, not artwork. Edit the source using the image editing tool. Only highlighted areas are authorized, including the filled interiors of completed fences; preserve everything else. Generate an aligned ${request.width} × ${request.height} candidate. Call finish_markup_edit with this requestId and the candidatePath inside GPT_IMAGE_ROOT. That step preserves all unselected pixels and marks completion. ${presentation} Do not mark completion before finishing.`;
}
$('#submit').onclick=async()=>{
  busy=true;controls();say('Saving the image and highlights…');
  try{
    if(fencePoints.length)throw new Error('Finish or cancel the fence before submitting.');
    const payload={requestId,name,source,prompt:$('#prompt').value,strokes:strokes.map(({kind,color,width,points})=>({...(kind?{kind}:{}),color,width,points}))};
    const request=connected?(await tool('save_markup_request',payload)).structuredContent:await local('/api/requests',payload);
    waiting=request;inlineHandoff=connected && app.getHostContext()?.displayMode==='inline';const text=instruction(request);
    if(connected){
      say('Sending to this chat…');
      const content=[{type:'text',text}];
      // Include exact server-rendered source and marked reference in the chat handoff.
      const references=await tool('get_markup_request',{requestId:request.id});
      content.push(...references.content.filter(c=>c.type==='image'));
      const response=extensions.message?await extensions.message.send({role:'user',content}):await app.sendMessage({role:'user',content});
      if(response?.isError)throw new Error('The host did not deliver the edit to the chat. Your request is saved; retry submission.');
      say(inlineHandoff?'Sent to this chat. A new editor will open below when the edit is ready.':'Sent to this chat. The edited image will appear here when it is ready.');
    } else {
      $('#handoff-text').value=text;$('#handoff').hidden=false;
      say('Saved. Copy the instruction into this chat to start the edit.');
    }
    startPolling();
  }catch(e){busy=false;controls();say(e.message);}
};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#handoff-text').value);say('Copied. Paste into the image’s chat.');}catch{say('Select the instruction and copy it manually.');}};
function startPolling(){clearTimeout(pollTimer);pollTimer=setTimeout(poll,2500);}
async function poll(){
  if(!waiting)return;
  try{
    const response=connected?await tool('get_markup_status',{requestId:waiting.id}):null;
    const request=response?.structuredContent||await local(`/api/requests/${waiting.id}`);
    const data=response?._meta?.source||request.source;
    if(request.status==='completed' && data){
      if(inlineHandoff){
        waiting=null;clearTimeout(pollTimer);
        document.querySelector('main').hidden=true;
        const completed=document.createElement('p');
        completed.textContent='Edit complete. Continue in the new editor below.';
        completed.style.cssText='margin:0;padding:12px;color:var(--muted);font-size:12px';
        document.body.append(completed);
        source=null;comparisonSource=null;strokes=[];
        image.removeAttribute('src');beforeImage.removeAttribute('src');
        return;
      }
      const references = connected ? await tool('get_markup_request',{requestId:waiting.id}) : null;
      const original = references?.content.find(c=>c.type==='image');
      const before = original ? `data:${original.mimeType};base64,${original.data}` : source;
      await load(data,request.name,before);waiting=null;busy=false;$('#handoff').hidden=true;
      say('Edit complete. Highlight another area to keep editing.');controls();return;
    }
  }catch(e){say(`Waiting for the edit. ${e.message}`);}
  startPolling();
}
let pendingInput=null;
async function loadSavedImage(data,filename){
  // Restore the original snapshot on either image-opening path.
  const savedResult=/(?:^|[\\/])data[\\/]requests[\\/]([0-9a-f-]{36})[\\/]result-[^\\/]+\.png$/i.exec(filename);
  let before=null;
  if(savedResult){
    const references=await tool('get_markup_request',{requestId:savedResult[1]});
    const original=references.content.find(c=>c.type==='image');
    if(original)before=`data:${original.mimeType};base64,${original.data}`;
  }
  await load(data,filename,before);
}
async function openHostFile(args){
  if(typeof args?.sourcePath==='string' && args.sourcePath){
    if(!connected){pendingInput=args;return;}
    try{
      say('Loading image…');
      const response=await tool('open_image_markup',{sourcePath:args.sourcePath});
      const block=response.content?.find(c=>c.type==='image');
      const data=response._meta?.source||(block?`data:${block.mimeType};base64,${block.data}`:null);
      if(!data)throw new Error('The server returned no image data. Use Open image.');
      await loadSavedImage(data,args.sourcePath);
      say('Highlight the areas you want to change.');
    }catch(e){say(e.message);}
    return;
  }
  const parsed=OpenAIFileEntrypointInputSchema.safeParse(args);
  if(!parsed.success)return;
  if(!connected){pendingInput=args;return;}
  if(!extensions.resources){say('This host does not expose file resources. Use Open image.');return;}
  try{
    const resource=await extensions.resources.read({uri:parsed.data.file.resourceUri,representation:'blob'});
    const blob=resource.contents.find(c=>'blob' in c);
    if(!blob)throw new Error('The host did not return image bytes. Use Open image.');
    await load(`data:${blob.mimeType};base64,${blob.blob}`,parsed.data.file.name);
  }catch(e){say(e.message);}
}
app.ontoolinput=({arguments:args})=>openHostFile(args);
app.ontoolresult=async result=>{
  if(result._meta?.source && !busy)try{
    const filename = result.structuredContent?.name || 'Image';
    await loadSavedImage(result._meta.source,filename);
  }catch(e){say(e.message);}
};
async function initialize(){
  if(window.parent!==window){
    try{
      await app.connect();connected=true;
      const context=app.getHostContext();
      if(context?.displayMode!=='fullscreen' && context?.availableDisplayModes?.includes('fullscreen')){
        try{await app.requestDisplayMode({mode:'fullscreen'});}catch(e){console.warn('Could not request sidebar display:',e.message);}
      }
      if(pendingInput)await openHostFile(pendingInput);
      say('Highlight the areas you want to change.');
    }
    catch(e){say(`Could not connect to the chat: ${e.message}`);}
  }
}
void initialize();
controls();
