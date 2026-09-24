const defaultTools=[
{name:'Gemini',url:'https://gemini.google.com/',category:'image',preferred:true},
{name:'SnapGen',url:'https://snapgen.ai/',category:'animation',max:10,dialogue:true,ambience:true},
{name:'Meta AI',url:'https://www.meta.ai/',category:'animation',max:10,dialogue:true,ambience:true},
{name:'Vibes',url:'https://vibes.ai/',category:'animation',preferred:true,max:10,dialogue:true,ambience:true},
{name:'Grok',url:'https://grok.com/',category:'animation',max:10,dialogue:true,ambience:true}
];
const demoProject={
 id:'abraao-isaque-3d',name:'Abraão e Isaque — 3D',kind:'adaptacao',sourceType:'youtube',
 sourceUrl:'https://youtu.be/S_bUZ1BJ-Xg',sourceName:'Abraão e Isaque',duration:1505.1,storage:'Google Drive Online',
 characters:['ABRAHAM_01','SARAH_01','ISAAC_01','CHILD_GROUP_01'],
 locations:['CAMP_OASIS_01','TENT_INTERIOR_01','RIVERBANK_01','FOREST_GLADE_01'],
 scenes:[
  {id:'C002',start:19.853,end:27.361,title:'Abraão ensina as crianças',type:'Diálogo',characters:['ABRAHAM_01','CHILD_GROUP_01'],location:'CAMP_OASIS_01',dialogue:'',image:'done',animation:'done',approved:true},
  {id:'C003',start:27.361,end:29.696,title:'Sarah no interior da tenda',type:'Ambiente/Narração',characters:['SARAH_01'],location:'TENT_INTERIOR_01',dialogue:'',image:'done',animation:'pending',approved:false},
  {id:'C004',start:29.696,end:34.868,title:'Abraão ensina as crianças',type:'Diálogo',characters:['ABRAHAM_01','CHILD_GROUP_01'],location:'CAMP_OASIS_01',dialogue:'',image:'pending',animation:'pending',approved:false},
  {id:'C006',start:38.705,end:47.214,title:'Close de Abraão',type:'Diálogo',characters:['ABRAHAM_01'],location:'CAMP_OASIS_01',dialogue:'',image:'pending',animation:'pending',approved:false}
 ]
};
function loadState(){
 const raw=JSON.parse(localStorage.getItem('animartoon-state')||'null');
 if(raw&&raw.projects) return raw;
 return {page:'Próxima ação',activeProjectId:demoProject.id,projects:[demoProject],tools:defaultTools};
}
let state=loadState();
let autoSyncTimer=null;
let driveToken=null;
let driveTokenClient=null;
let driveTokenExpiresAt=0;
try{
 const savedToken=sessionStorage.getItem('animartoon-drive-token')||'';
 const savedExpiry=Number(sessionStorage.getItem('animartoon-drive-expiry')||0);
 if(savedToken&&savedExpiry>Date.now()+30000){driveToken=savedToken;driveTokenExpiresAt=savedExpiry}
 else{sessionStorage.removeItem('animartoon-drive-token');sessionStorage.removeItem('animartoon-drive-expiry')}
}catch(e){}
let analysisVideoFile=null;
let analysisObjectUrl=null;
let analysisAbort=false;
let selectedSceneIndex=null;
let sceneSelection=new Set();
let sceneFilter='all';
const DEFAULT_ANALYZER_URL='https://analyzer-v2-production.up.railway.app';
const pages=['Próxima ação','Projetos','Importação','Produção','Personagens','Cenários','Cenas','Mapa de arquivos','Auditoria','Configurações'];
function save(){localStorage.setItem('animartoon-state',JSON.stringify(state))}
function project(){return state.projects.find(p=>p.id===state.activeProjectId)||state.projects[0]}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function fmt(sec){sec=Number(sec||0);let h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=(sec%60).toFixed(3).padStart(6,'0');return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+s}
function slug(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'projeto'}
function nav(){const n=document.getElementById('nav');n.innerHTML=pages.map(p=>'<button class="'+(state.page===p?'active':'')+'" data-p="'+p+'">'+p+'</button>').join('');n.querySelectorAll('button').forEach(b=>b.onclick=()=>{state.page=b.dataset.p;save();render()})}
function setPage(p){state.page=p;save();render()}
function toast(t){let e=document.getElementById('toast')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'toast',className:'toast'}));e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1300)}
function copy(t){navigator.clipboard.writeText(t).then(()=>toast('Copiado')).catch(()=>toast('Não foi possível copiar'))}
function sceneDuration(s){return Math.max(0,Number(s.end)-Number(s.start))}
function progress(p=project()){if(!p||!p.scenes.length)return 0;let n=p.scenes.reduce((a,s)=>a+(s.image==='done')+(s.animation==='done')+(s.approved?1:0),0);return Math.round(n/(p.scenes.length*3)*100)}
function nextScene(p=project()){return p.scenes.find(s=>s.image!=='done'||s.animation!=='done'||!s.approved)||p.scenes[0]}
function nextVersion(s,type){const key=type==='image'?'imageVersion':'animationVersion';return String((s[key]||0)+1).padStart(2,'0')}
function expectedFile(s,type){return type==='image'?s.id+'_IMG_v'+nextVersion(s,'image')+'.png':s.id+'_ANIM_v'+nextVersion(s,'animation')+'.mp4'}
function imagePrompt(s){return 'Create a consistent stylized 3D animated keyframe for scene '+s.id+': '+s.title+'. Characters: '+(s.characters.join(', ')||'none')+'. Location: '+(s.location||'unspecified')+'. '+(s.speaker?'Speaking character: '+s.speaker+'. ':'')+(s.action?'Action: '+s.action+'. ':'')+(s.camera?'Camera/framing: '+s.camera+'. ':'')+'Preserve character identity, costume, proportions, biblical-era continuity, cinematic family-animation lighting and composition. '+(s.dialogue?'This scene will later include dialogue: "'+s.dialogue+'".':'No spoken dialogue is required in the image.')}
function animationPrompt(s){const d=sceneDuration(s).toFixed(1);return 'Create a '+d+'-second animation from the supplied image for scene '+s.id+': '+s.title+'. '+(s.action?'Action: '+s.action+'. ':'')+(s.type==='Diálogo'?'Include natural synchronized spoken dialogue'+(s.speaker?' spoken by '+s.speaker:'')+(s.dialogue?' exactly as follows: "'+s.dialogue+'".':' based on the supplied scene audio/script.')+' Add natural facial acting and lip synchronization only to the speaking character.':'Do not add spoken dialogue. Animate character/environment movement naturally.')+(s.ambience?' Scene sound: '+s.ambience+'. ':' Add subtle natural scene ambience. ')+(s.camera?'Camera direction: '+s.camera+'. ':'')+(s.continuityNote?' Continuity: '+s.continuityNote+'. ':'')+'Preserve the exact characters, costume, setting and visual continuity.'}
function markNext(){const p=project(),s=nextScene(p);if(!s)return;if(s.image!=='done'){s.image='done';s.imageVersion=(s.imageVersion||0)+1}else if(s.animation!=='done'){s.animation='done';s.animationVersion=(s.animationVersion||0)+1}else s.approved=true;save();render()}
function setStorage(m){project().storage=m;save();configureAutoSync();render()}
function selectProject(id){state.activeProjectId=id;state.page='Próxima ação';save();render()}
function deleteProject(id){if(state.projects.length===1)return toast('Mantenha ao menos um projeto');state.projects=state.projects.filter(p=>p.id!==id);if(state.activeProjectId===id)state.activeProjectId=state.projects[0].id;save();render()}
function projectCard(p){return '<article class="card project-card '+(p.id===state.activeProjectId?'selected':'')+'"><div class="top"><div><p class="eyebrow">'+p.kind.toUpperCase()+'</p><h2>'+esc(p.name)+'</h2></div><span class="percent">'+progress(p)+'%</span></div><p class="muted">'+(p.sourceType==='youtube'?'YouTube':p.sourceType==='upload'?'Arquivo local':'Projeto')+(p.duration?' • '+fmt(p.duration):'')+'</p><div class="progress"><div style="width:'+progress(p)+'%"></div></div><div class="actions"><button class="btn primary" onclick="selectProject(\''+p.id+'\')">Abrir</button><button class="btn" onclick="deleteProject(\''+p.id+'\')">Excluir</button></div></article>'}
function projectsView(){return '<div class="grid"><section class="card span2"><div class="section-title"><div><p class="eyebrow">NOVO PROJETO</p><h2>Criar projeto</h2></div></div><form class="form-grid" onsubmit="createProject(event)"><label>Nome<input id="newName" required placeholder="Nome do projeto"></label><label>Origem<select id="newKind"><option value="adaptacao">Adaptar vídeo existente</option><option value="original" disabled>Projeto original — futuro</option><option value="inspirado" disabled>Inspirado em referência — futuro</option></select></label><label>Fonte<select id="newSource"><option value="youtube">YouTube</option><option value="upload">Arquivo local</option></select></label><label>URL do YouTube<input id="newUrl" placeholder="https://youtu.be/..."></label><div class="form-actions"><button class="btn primary" type="submit">Criar projeto</button></div></form></section>'+state.projects.map(projectCard).join('')+'</div>'}
function createProject(e){e.preventDefault();const name=document.getElementById('newName').value.trim(),sourceType=document.getElementById('newSource').value,url=document.getElementById('newUrl').value.trim(),id=slug(name)+'-'+Date.now().toString(36);const p={id,name,kind:'adaptacao',sourceType,sourceUrl:url,sourceName:'',duration:0,storage:'Controle manual',characters:[],locations:[],scenes:[]};state.projects.push(p);state.activeProjectId=id;state.page='Importação';save();render()}
function analyzerUrl(){return (project().analyzerUrl||DEFAULT_ANALYZER_URL).replace(/\/$/,'')}
async function testAnalyzer(){
 const p=project(),url=(document.getElementById('analyzerUrl')?.value||p.analyzerUrl||DEFAULT_ANALYZER_URL).trim().replace(/\/$/,'');
 p.analyzerUrl=url;save();
 try{
  const r=await fetch(url+'/health',{cache:'no-store'});
  const data=await r.json();
  p.analyzerStatus={ok:r.ok&&data.ok,checkedAt:Date.now(),message:r.ok?'Online':'Falha '+r.status};
  save();render();toast(p.analyzerStatus.ok?'Analisador online':'Analisador indisponível')
 }catch(e){p.analyzerStatus={ok:false,checkedAt:Date.now(),message:e?.message||'Falha de conexão'};save();render();toast('Analisador indisponível')}
}
function analyzeWithServer(){
 if(!analysisVideoFile)return toast('Selecione primeiro o arquivo local');
 const p=project(),url=analyzerUrl(),thresholdMap={0.03:0.42,0.05:0.35,0.08:0.28},uiSensitivity=Number(document.getElementById('analysisThreshold')?.value||0.05),threshold=thresholdMap[uiSensitivity]||0.35,split=!!document.getElementById('splitLongScenes')?.checked,max=generatorLimit();
 const form=new FormData();form.append('file',analysisVideoFile,analysisVideoFile.name);form.append('threshold',String(threshold));form.append('max_duration',String(max));form.append('split_long',String(split));
 const bar=document.getElementById('analysisProgressBar'),txt=document.getElementById('analysisProgressText');
 if(txt)txt.textContent='Enviando vídeo ao analisador FFmpeg...';if(bar)bar.style.width='2%';
 const xhr=new XMLHttpRequest();xhr.open('POST',url+'/analyze-upload',true);
 xhr.upload.onprogress=e=>{if(e.lengthComputable){const pct=Math.max(2,Math.min(85,Math.round(e.loaded/e.total*85)));if(bar)bar.style.width=pct+'%';if(txt)txt.textContent='Enviando '+pct+'% • análise começa após o upload'}};
 xhr.onload=()=>{try{
   const data=JSON.parse(xhr.responseText||'{}');
   if(xhr.status<200||xhr.status>=300||!data.ok)throw new Error(data.detail||'HTTP '+xhr.status);
   p.analysisCandidateScenes=(data.scenes||[]).map(s=>({...s}));
   p.analysisStats={step:'FFmpeg',threshold:data.threshold,thresholdLabel:(data.threshold===0.35?'Média':data.threshold<0.35?'Alta':'Baixa')+' • FFmpeg',visualCuts:data.visualCuts||0,technicalSplits:data.technicalSplits||0,cutoff:data.threshold,maxDiff:0,server:true,analyzedAt:Date.now()};
   p.analysisDuration=data.duration||p.analysisDuration||p.duration;p.lastAnalyzerResult={sceneCount:data.sceneCount,visualCuts:data.visualCuts,technicalSplits:data.technicalSplits,threshold:data.threshold};
   save();render();toast((data.sceneCount||0)+' segmentos detectados por FFmpeg')
  }catch(e){if(txt)txt.textContent='Falha no analisador: '+(e?.message||'erro');toast('Falha no analisador FFmpeg')}
 };
 xhr.onerror=()=>{if(txt)txt.textContent='Falha de rede ao enviar para o analisador';toast('Falha de rede com o analisador')};
 xhr.send(form)
}
function analyzerPanel(p){
 const s=p.analyzerStatus||{};
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">ANALISADOR FFmpeg — SERVIÇO</p><h2>Processamento robusto fora do navegador</h2></div><span class="badge '+(s.ok?'ok':'warn')+'">'+(s.ok?'online':'não testado')+'</span></div><p class="muted">Modo recomendado. O vídeo local é enviado temporariamente ao serviço, analisado com FFmpeg e descartado após a resposta. A sensibilidade Média usa limiar 0,35 — calibrado com o vídeo Abraão e Isaque, no qual o FFmpeg encontrou 153 cortes visuais.</p><div class="form-grid"><label>URL do analisador<input id="analyzerUrl" value="'+esc(p.analyzerUrl||DEFAULT_ANALYZER_URL)+'"></label><div class="actions analyzer-actions"><button class="btn" onclick="testAnalyzer()">Testar serviço</button><button class="btn primary" onclick="analyzeWithServer()">Analisar arquivo com FFmpeg</button><span class="badge ok">recomendado</span></div></div>'+(s.message?'<p class="muted note">Status: '+esc(s.message)+'</p>':'')+'</section>'
}
function driveVideoFiles(){
 const files=project().fileIndex||[];
 return files.filter(f=>f.driveId&&(String(f.type||'').startsWith('video/')||/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name||'')))
}
async function refreshDriveForAnalysis(){
 if(!driveToken)return toast('Conecte ao Google Drive primeiro');
 const p=project();
 if(!p.driveFolderId)return toast('Informe a pasta do projeto no Google Drive');
 try{
  toast('Carregando vídeos do Drive...');
  const files=(await driveListChildren(p.driveFolderId)).map(classifyFile);
  p.fileIndex=files;p.lastSync=Date.now();save();render();toast(driveVideoFiles().length+' vídeo(s) encontrado(s)')
 }catch(e){toast('Falha ao listar vídeos do Google Drive')}
}
function analyzeDriveFile(fileId){
 if(!driveToken)return toast('Conecte novamente ao Google Drive');
 const p=project(),file=(p.fileIndex||[]).find(f=>f.driveId===fileId);
 if(!file)return toast('Arquivo do Drive não encontrado');
 const thresholdMap={0.03:0.42,0.05:0.35,0.08:0.28},uiSensitivity=Number(document.getElementById('analysisThreshold')?.value||0.05),threshold=thresholdMap[uiSensitivity]||0.35,split=!!document.getElementById('splitLongScenes')?.checked,max=generatorLimit(),form=new FormData();
 form.append('file_id',fileId);form.append('access_token',driveToken);form.append('threshold',String(threshold));form.append('max_duration',String(max));form.append('split_long',String(split));
 const txt=document.getElementById('analysisProgressText'),bar=document.getElementById('analysisProgressBar');
 if(txt)txt.textContent='Google Drive → analisador FFmpeg...';if(bar)bar.style.width='8%';
 fetch(analyzerUrl()+'/analyze-drive',{method:'POST',body:form}).then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.detail||('HTTP '+r.status));return data}).then(data=>{
   p.analysisCandidateScenes=(data.scenes||[]).map(s=>({...s}));
   p.analysisStats={step:'FFmpeg',threshold:data.threshold,thresholdLabel:(data.threshold===0.35?'Média':data.threshold<0.35?'Alta':'Baixa')+' • FFmpeg',visualCuts:data.visualCuts||0,technicalSplits:data.technicalSplits||0,cutoff:data.threshold,maxDiff:0,server:true,source:'Google Drive',analyzedAt:Date.now()};
   p.analysisDuration=data.duration||p.analysisDuration||p.duration;p.lastAnalyzerResult={sceneCount:data.sceneCount,visualCuts:data.visualCuts,technicalSplits:data.technicalSplits,threshold:data.threshold,source:'Google Drive',filename:data.filename};
   save();render();toast((data.sceneCount||0)+' segmentos detectados do Google Drive')
 }).catch(e=>{if(txt)txt.textContent='Falha no Drive/FFmpeg: '+(e?.message||'erro');toast('Falha ao analisar arquivo do Google Drive')})
}

async function processDriveMedia(fileId){
 if(!driveToken)return toast('Conecte novamente ao Google Drive');
 const p=project(),file=(p.fileIndex||[]).find(f=>f.driveId===fileId);
 if(!file)return toast('Arquivo do Drive não encontrado');
 if(!p.scenes?.length)return toast('Aplique a decupagem antes de gerar miniaturas e transcrição');
 if(p.mediaJob?.status==='running'||p.mediaJob?.status==='queued')return toast('Já existe um processamento em andamento');
 const form=new FormData();
 form.append('file_id',fileId);
 form.append('access_token',driveToken);
 form.append('scenes_json',JSON.stringify(p.scenes.map(s=>({id:s.id,start:s.start,end:s.end}))));
 p.mediaJob={status:'starting',progress:1,message:'Enviando tarefa ao analisador',fileId,startedAt:Date.now()};
 save();render();
 try{
  const r=await fetch(analyzerUrl()+'/process-drive-media',{method:'POST',body:form});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok)throw new Error(data.detail||('HTTP '+r.status));
  p.mediaJob={status:'queued',progress:2,message:'Processamento iniciado',fileId,jobId:data.jobId,startedAt:Date.now()};
  save();render();
  pollMediaJob(data.jobId);
 }catch(e){
  p.mediaJob={status:'error',progress:100,message:e?.message||'Falha ao iniciar processamento',fileId,failedAt:Date.now()};
  save();render();toast('Falha ao iniciar miniaturas/transcrição');
 }
}
async function pollMediaJob(jobId){
 const p=project();
 if(!jobId)return;
 try{
  const r=await fetch(analyzerUrl()+'/media-job/'+encodeURIComponent(jobId));
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.detail||('HTTP '+r.status));
  p.mediaJob={...(p.mediaJob||{}),jobId,status:data.status||'running',progress:Number(data.progress||0),message:data.message||'Processando'};
  save();
  const textEl=document.getElementById('driveMediaJobText'),bar=document.getElementById('driveMediaJobBar');
  if(textEl)textEl.textContent=p.mediaJob.message+' • '+p.mediaJob.progress+'%';
  if(bar)bar.style.width=p.mediaJob.progress+'%';
  if(data.status==='done'&&data.result){
   const result=data.result,thumbs=result.thumbnails||[];
   for(const item of thumbs){if(item.image)await saveSceneThumbnail(p.id,item.sceneId,item.image)}
   const cues=(result.cues||[]).map(c=>({start:Number(c.start),end:Number(c.end),text:String(c.text||'')}));
   p.transcriptFileName='Transcrição automática • '+(result.filename||'Google Drive');
   p.transcriptCueCount=cues.length;
   p.mediaEnrichment={thumbnailCount:result.thumbnailCount||0,cueCount:result.cueCount||cues.length,elapsedSeconds:result.elapsedSeconds||0,finishedAt:Date.now()};
   p.mediaJob={...(p.mediaJob||{}),status:'done',progress:100,message:'Miniaturas e transcrição concluídas',finishedAt:Date.now()};
   save();
   if(cues.length)applyTranscriptCues(cues,false);else{render();toast('Miniaturas geradas; nenhuma fala detectada')}
   return;
  }
  if(data.status==='error'){
   p.mediaJob={...(p.mediaJob||{}),status:'error',progress:100,message:data.message||'Falha no processamento',failedAt:Date.now()};
   save();render();toast('Falha no processamento de mídia');return;
  }
  setTimeout(()=>pollMediaJob(jobId),3000);
 }catch(e){
  p.mediaJob={...(p.mediaJob||{}),status:'paused',message:'Consulta interrompida: '+(e?.message||'erro')};
  save();render();toast('Não foi possível consultar o processamento');
 }
}
function resumeMediaJob(){const p=project();if(!p.mediaJob?.jobId)return toast('Nenhum processamento para retomar');p.mediaJob.status='running';save();render();pollMediaJob(p.mediaJob.jobId)}
function driveAnalysisPanel(p){
 if(p.storage!=='Google Drive Online')return '';
 const videos=driveVideoFiles(),job=p.mediaJob||null,enriched=p.mediaEnrichment||null;
 const jobBlock=job?'<div class="drive-job panel"><div class="section-title"><div><strong>Processamento de mídia</strong><small id="driveMediaJobText" class="muted">'+esc(job.message||job.status)+' • '+Number(job.progress||0)+'%</small></div><span class="badge '+(job.status==='done'?'ok':job.status==='error'?'warn':'')+'">'+esc(job.status||'')+'</span></div><div class="mini"><div id="driveMediaJobBar" style="width:'+Number(job.progress||0)+'%"></div></div>'+(job.status==='paused'?'<button class="btn" onclick="resumeMediaJob()">Retomar acompanhamento</button>':'')+'</div>':'';
 const enrichedBlock=enriched?'<p class="muted note">Último processamento: '+Number(enriched.thumbnailCount||0)+' miniaturas • '+Number(enriched.cueCount||0)+' trechos de fala'+(enriched.elapsedSeconds?' • '+Number(enriched.elapsedSeconds).toFixed(0)+' s':'')+'.</p>':'';
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">ANALISAR ARQUIVO DO GOOGLE DRIVE</p><h2>Vídeo direto da pasta do projeto</h2></div><span class="badge '+(driveToken?'ok':'warn')+'">'+(driveToken?'Drive conectado':'Drive desconectado')+'</span></div><p class="muted">Use o FFmpeg para a decupagem e, depois de aplicar as cenas, gere miniaturas reais e transcrição automática do mesmo vídeo. As miniaturas ficam armazenadas localmente no navegador; a transcrição é associada às cenas pelo tempo.</p><div class="actions"><button class="btn" onclick="refreshDriveForAnalysis()">Atualizar lista de vídeos</button></div>'+jobBlock+enrichedBlock+'<div class="drive-video-list">'+(videos.length?videos.map(f=>'<div class="panel drive-video-item"><div><strong>'+esc(f.name)+'</strong><small class="muted">'+esc(f.path||'')+(f.size?' • '+(f.size/1024/1024).toFixed(1)+' MB':'')+'</small></div><div class="actions"><button class="btn" onclick="analyzeDriveFile(\''+f.driveId+'\')">Analisar cortes</button><button class="btn primary" '+(!p.scenes?.length?'disabled':'')+' onclick="processDriveMedia(\''+f.driveId+'\')">Miniaturas + transcrição</button></div></div>').join(''):'<p class="muted note">Nenhum vídeo listado ainda. Conecte o Drive e clique em Atualizar lista de vídeos.</p>')+'</div></section>'
}
function parseYouTubeId(value){
 const s=String(value||'').trim();
 try{
  const u=new URL(s);
  if(u.hostname==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||'';
  if(u.hostname.includes('youtube.com')){
   if(u.pathname==='/watch')return u.searchParams.get('v')||'';
   const m=u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
   if(m)return m[1]
  }
 }catch(e){}
 const m=s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{6,})/);
 return m?m[1]:''
}
async function testYouTubeLink(){
 const input=document.getElementById('sourceUrl'),url=(input?.value||project().sourceUrl||'').trim(),id=parseYouTubeId(url),p=project();
 if(!id){p.youtubeTest={ok:false,message:'Link do YouTube inválido'};save();render();return toast('Link do YouTube inválido')}
 p.sourceUrl=url;p.youtubeVideoId=id;p.youtubeTest={ok:true,checkedAt:Date.now(),message:'Link reconhecido'};
 try{
  const r=await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(url)+'&format=json');
  if(r.ok){
   const data=await r.json();
   p.youtubeTitle=data.title||p.sourceName||'';
   p.youtubeAuthor=data.author_name||'';
   p.youtubeThumbnail=data.thumbnail_url||'';
  }
 }catch(e){}
 save();render();toast('Link do YouTube validado')
}
function youtubeTestPanel(p){
 const t=p.youtubeTest,id=p.youtubeVideoId||parseYouTubeId(p.sourceUrl||'');
 if(!t&&!id)return '';
 const valid=!!id;
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">TESTE DO YOUTUBE</p><h2>'+(valid?'Link reconhecido':'Link inválido')+'</h2></div><span class="badge '+(valid?'ok':'warn')+'">'+(valid?'válido':'erro')+'</span></div>'+
 (valid?'<div class="youtube-test-grid"><div class="youtube-preview"><iframe src="https://www.youtube.com/embed/'+id+'" title="Prévia do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><div class="panel"><span class="label">Vídeo</span><strong>'+esc(p.youtubeTitle||p.sourceName||id)+'</strong>'+(p.youtubeAuthor?'<p class="muted">'+esc(p.youtubeAuthor)+'</p>':'')+'<p class="muted">O link foi validado e pode ser usado como referência do projeto.</p><div class="warning">A análise automática de pixels não pode ser feita diretamente dentro do player do YouTube em uma página estática por restrições de origem do navegador. Para detectar cortes a partir do link, a Animartoon precisará de um serviço de análise separado.</div></div></div>':'<div class="warning">Revise a URL informada.</div>')+'</section>'
}
function importView(){
 const p=project(),candidate=p.analysisCandidateScenes||[],stats=p.analysisStats||null;
 const sourceBlock=p.sourceType==='youtube'
 ? '<label class="field">URL<input id="sourceUrl" value="'+esc(p.sourceUrl||'')+'" placeholder="https://youtu.be/..."></label><div class="actions"><button class="btn primary" onclick="saveSourceUrl()">Salvar URL</button><button class="btn" onclick="testYouTubeLink()">Testar link do YouTube</button><a class="btn linkbtn" href="'+esc(p.sourceUrl||'#')+'" target="_blank">Abrir vídeo ↗</a></div><p class="muted note">O YouTube continua como referência do projeto. Para decupagem automática, selecione abaixo uma cópia local do vídeo; ela é analisada somente no navegador.</p>'
 : '<div class="drop"><input id="videoFile" type="file" accept="video/*" onchange="readLocalVideo(event)"><strong>Selecionar vídeo local como fonte</strong><small>A duração é lida no navegador. O arquivo não é enviado.</small></div>';
 return '<div class="grid"><section class="card span2"><p class="eyebrow">FONTE</p><h2>Importação do projeto</h2><div class="sourcebox"><div><span class="label">Tipo</span><strong>'+(p.sourceType==='youtube'?'YouTube':'Arquivo local')+'</strong></div><div><span class="label">Duração</span><strong>'+(p.duration?fmt(p.duration):'Ainda não informada')+'</strong></div></div>'+sourceBlock+'</section>'+youtubeTestPanel(p)+analyzerPanel(p)+driveAnalysisPanel(p)+
 '<section class="card span2"><div class="section-title"><div><p class="eyebrow">DECUPAGEM LOCAL — ALTERNATIVA</p><h2>Analisar cortes visuais no navegador</h2></div><span class="badge">'+(p.analysisFileName?esc(p.analysisFileName):'sem arquivo')+'</span></div><p class="muted">A análise compara quadros reduzidos para localizar mudanças visuais. O vídeo permanece no seu computador. O resultado é preliminar e deve ser revisado antes da produção.</p><div class="drop"><input id="analysisFile" type="file" accept="video/*" onchange="attachAnalysisVideo(event)"><strong>Selecionar arquivo para análise</strong><small>'+(analysisVideoFile?esc(analysisVideoFile.name):'Selecione a cópia local do vídeo de referência')+'</small></div><div class="analysis-controls"><label>Precisão<select id="analysisStep"><option value="2">Rápida — 2 s</option><option value="1" selected>Equilibrada — 1 s</option><option value="0.5">Precisa — 0,5 s</option></select></label><label>Sensibilidade<select id="analysisThreshold"><option value="0.03">Baixa</option><option value="0.05" selected>Média</option><option value="0.08">Alta</option></select></label><label class="checkline"><input id="splitLongScenes" type="checkbox" checked> Dividir cenas acima do limite do gerador</label></div><div class="analysis-progress"><div class="mini"><div id="analysisProgressBar" style="width:0%"></div></div><span id="analysisProgressText" class="muted">Pronto para analisar</span></div><div class="actions"><button class="btn primary" onclick="analyzeSelectedVideo()">Detectar cenas</button><button class="btn" onclick="cancelVideoAnalysis()">Cancelar</button></div></section>'+
 (stats&&stats.failed?'<section class="card span2"><p class="eyebrow">DIAGNÓSTICO</p><h2>Não foi possível extrair quadros diferentes</h2><div class="warning">O navegador percorreu o vídeo, mas os quadros capturados ficaram idênticos. A Animartoon não criou cortes artificiais desta vez. Tente o mesmo arquivo em MP4/H.264 ou outro navegador Chromium.</div><div class="audit"><div class="panel"><span class="muted">Maior diferença</span><strong>'+Number(stats.maxDiff||0).toFixed(4)+'</strong></div><div class="panel"><span class="muted">Quadros válidos</span><strong>'+Number(stats.diagnosticFrames||0)+'</strong></div><div class="panel"><span class="muted">Variância máxima</span><strong>'+Number(stats.diagnosticVariance||0).toFixed(1)+'</strong></div></div></section>':'')+(candidate.length?'<section class="card span2"><div class="section-title"><div><p class="eyebrow">RESULTADO PRELIMINAR</p><h2>'+candidate.length+' segmentos detectados</h2></div><div class="actions"><button class="btn" onclick="generateAnalysisThumbs()">Gerar miniaturas</button><button class="btn primary" onclick="applyDetectedScenes()">Aplicar à decupagem</button></div></div>'+(stats?(stats.server?'<div class="audit compact-audit"><div class="panel"><span class="muted">Método</span><strong>FFmpeg</strong></div><div class="panel"><span class="muted">Sensibilidade</span><strong>'+stats.thresholdLabel+'</strong></div><div class="panel"><span class="muted">Cortes visuais</span><strong>'+stats.visualCuts+'</strong></div><div class="panel"><span class="muted">Cenas visuais</span><strong>'+((stats.visualCuts||0)+1)+'</strong></div><div class="panel"><span class="muted">Divisões adicionais</span><strong>'+Math.max(0,candidate.length-((stats.visualCuts||0)+1))+'</strong></div><div class="panel"><span class="muted">Segmentos de produção</span><strong>'+candidate.length+'</strong></div></div>':'<div class="audit compact-audit"><div class="panel"><span class="muted">Amostragem</span><strong>'+stats.step+' s</strong></div><div class="panel"><span class="muted">Sensibilidade</span><strong>'+stats.thresholdLabel+'</strong></div><div class="panel"><span class="muted">Cortes visuais</span><strong>'+stats.visualCuts+'</strong></div><div class="panel"><span class="muted">Subcenas técnicas</span><strong>'+stats.technicalSplits+'</strong></div><div class="panel"><span class="muted">Limiar calculado</span><strong>'+Number(stats.cutoff||0).toFixed(3)+'</strong></div><div class="panel"><span class="muted">Maior diferença</span><strong>'+Number(stats.maxDiff||0).toFixed(3)+'</strong></div></div>'):'')+'<div class="detected-grid">'+candidate.slice(0,20).map(s=>'<div class="detected-card">'+((s.thumbStart||s.thumbEnd)?'<div class="thumb-pair">'+(s.thumbStart?'<img src="'+s.thumbStart+'" alt="Início '+s.id+'">':'')+(s.thumbEnd?'<img src="'+s.thumbEnd+'" alt="Fim '+s.id+'">':'')+'</div>':'')+'<div class="detected-meta"><strong>'+s.id+'</strong><span>'+fmt(s.start)+' → '+fmt(s.end)+'</span><span>'+sceneDuration(s).toFixed(1)+' s</span></div></div>').join('')+(candidate.length>20?'<p class="muted note">Mostrando as 20 primeiras. A lista completa será aplicada em Cenas.</p>':'')+'</div></section>':'')+
 '<section class="card"><p class="eyebrow">DECUPAGEM</p><h2>Cenas</h2><strong class="big">'+p.scenes.length+'</strong><p class="muted">cenas cadastradas</p><button class="btn" onclick="setPage(\'Cenas\')">Revisar cenas</button></section><section class="card"><p class="eyebrow">FALAS / TRANSCRIÇÃO</p><h2>Importar SRT ou VTT</h2><p class="muted">A Animartoon associa as legendas às cenas pelo intervalo de tempo e preenche o campo de fala.</p><div class="drop compact-drop"><input id="subtitleFile" type="file" accept=".srt,.vtt,text/plain" onchange="importSubtitleFile(event)"><strong>Selecionar legenda</strong><small>'+(p.transcriptFileName?esc(p.transcriptFileName)+' • '+(p.transcriptCueCount||0)+' trechos':'SRT ou WebVTT')+'</small></div><label class="checkline transcript-option"><input id="replaceDialogue" type="checkbox"> Substituir falas já preenchidas</label>'+(p.transcriptAppliedAt?'<p class="muted note">'+(p.transcriptSceneCount||0)+' cenas receberam fala na última importação.</p>':'')+'</section><section class="card span2"><p class="eyebrow">IMPORTAR DADOS</p><h2>JSON de cenas</h2><textarea id="jsonScenes" rows="7" placeholder=\'[{"start":0,"end":8.2,"title":"Cena inicial","type":"Diálogo"}]\'></textarea><button class="btn" onclick="importScenesJson()">Importar cenas</button></section></div>'
}
function saveSourceUrl(){const p=project(),url=document.getElementById('sourceUrl').value.trim();if(url!==p.sourceUrl){delete p.youtubeTest;delete p.youtubeVideoId;delete p.youtubeTitle;delete p.youtubeAuthor;delete p.youtubeThumbnail}p.sourceUrl=url;save();toast('Fonte salva')}
function readLocalVideo(e){
 const f=e.target.files[0];if(!f)return;
 analysisVideoFile=f;
 if(analysisObjectUrl)URL.revokeObjectURL(analysisObjectUrl);
 analysisObjectUrl=URL.createObjectURL(f);
 const v=document.createElement('video');v.preload='metadata';
 v.onloadedmetadata=()=>{const p=project();p.sourceName=f.name;p.duration=v.duration;p.sourceType='upload';p.analysisFileName=f.name;save();render();toast('Metadados lidos')};
 v.src=analysisObjectUrl
}
function attachAnalysisVideo(e){
 const f=e.target.files[0];if(!f)return;
 analysisVideoFile=f;
 if(analysisObjectUrl)URL.revokeObjectURL(analysisObjectUrl);
 analysisObjectUrl=URL.createObjectURL(f);
 const v=document.createElement('video');v.preload='metadata';
 v.onloadedmetadata=()=>{const p=project();p.analysisFileName=f.name;p.analysisDuration=v.duration;if(!p.duration)p.duration=v.duration;delete p.analysisCandidateScenes;delete p.analysisStats;save();render();toast('Vídeo pronto para análise — clique em Detectar cenas')};
 v.src=analysisObjectUrl
}
function cancelVideoAnalysis(){analysisAbort=true;const t=document.getElementById('analysisProgressText');if(t)t.textContent='Cancelamento solicitado...'}
function waitMediaReady(video){return new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve();const ok=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(video.error||new Error('media'))},cleanup=()=>{video.removeEventListener('loadeddata',ok);video.removeEventListener('canplay',ok);video.removeEventListener('error',fail)};video.addEventListener('loadeddata',ok,{once:true});video.addEventListener('canplay',ok,{once:true});video.addEventListener('error',fail,{once:true});video.load()})}
function waitDecodedFrame(video){return new Promise(resolve=>{if('requestVideoFrameCallback' in video){let done=false;const fallback=setTimeout(()=>{if(!done){done=true;resolve()}},250);video.requestVideoFrameCallback(()=>{if(done)return;done=true;clearTimeout(fallback);resolve()})}else{requestAnimationFrame(()=>setTimeout(resolve,35))}})}
async function waitSeek(video,time){
 await waitMediaReady(video);
 const target=Math.min(Math.max(0,time),Math.max(0,video.duration-0.03));
 if(Math.abs(video.currentTime-target)<0.01&&!video.seeking){await waitDecodedFrame(video);return}
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail)};
  const finish=async()=>{if(settled)return;settled=true;cleanup();await waitDecodedFrame(video);resolve()};
  const done=()=>finish();
  const fail=()=>{if(settled)return;settled=true;cleanup();reject(video.error||new Error('seek'))};
  video.addEventListener('seeked',done);video.addEventListener('error',fail);
  timer=setTimeout(()=>{if(Math.abs(video.currentTime-target)<0.10)finish();else fail()},2200);
  video.currentTime=target;
 })
}
async function forceDecodedFrame(video,time){
 await waitSeek(video,time);
 try{
  const before=video.currentTime;
  await video.play();
  await new Promise(resolve=>{
   if('requestVideoFrameCallback' in video){
    let done=false;const fallback=setTimeout(()=>{if(!done){done=true;resolve()}},220);
    video.requestVideoFrameCallback(()=>{if(done)return;done=true;clearTimeout(fallback);resolve()})
   }else setTimeout(resolve,90)
  });
  video.pause();
  if(Math.abs(video.currentTime-before)>0.22)video.currentTime=before;
 }catch(e){await waitDecodedFrame(video)}
}
function frameVector(video,canvas,ctx){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(video,0,0,canvas.width,canvas.height);
 const d=ctx.getImageData(0,0,canvas.width,canvas.height).data,out=new Uint8Array(canvas.width*canvas.height),n=out.length;
 let sum=0,sumSq=0;
 for(let i=0,j=0;i<d.length;i+=4,j++){const y=Math.round(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]);out[j]=y;sum+=y;sumSq+=y*y}
 out._mean=sum/n;out._variance=Math.max(0,sumSq/n-(sum/n)*(sum/n));
 return out
}
function frameDifference(a,b){if(!a||!b||a.length!==b.length)return 0;let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/(a.length*255)}
function generatorLimit(){const ts=(state.tools||defaultTools).filter(t=>t.category==='animation'&&t.max);const pref=ts.find(t=>t.preferred);return Number((pref||ts[0]||{max:10}).max||10)}
function quantile(values,q){if(!values.length)return 0;const s=[...values].sort((a,b)=>a-b),pos=(s.length-1)*q,base=Math.floor(pos),rest=pos-base;return s[base+1]!==undefined?s[base]+rest*(s[base+1]-s[base]):s[base]}
function alphaSuffix(n){let s='';n++;while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function pickVisualCuts(samples,fraction,step){
 if(samples.length<3)return {cuts:[0],cutoff:0};
 const scores=samples.map(x=>x.diff).filter(Number.isFinite),cutoff=Math.max(0.012,quantile(scores,Math.max(0,1-fraction))),minGap=Math.max(0.7,step*1.2),cuts=[0];
 let last=0;
 for(let i=1;i<samples.length-1;i++){
  const cur=samples[i];
  if(cur.diff<cutoff)continue;
  if(cur.diff<samples[i-1].diff||cur.diff<samples[i+1].diff)continue;
  if(cur.time-last<minGap)continue;
  cuts.push(Number(cur.time.toFixed(3)));last=cur.time
 }
 return {cuts,cutoff}
}
function buildDetectedScenes(cuts,duration,splitLong){
 const max=generatorLimit(),result=[];let visual=0,technical=0;
 for(let i=0;i<cuts.length;i++){
  const start=cuts[i],end=i+1<cuts.length?cuts[i+1]:duration;
  if(end-start<0.35)continue;
  visual++;
  const count=splitLong?Math.ceil((end-start)/max):1;
  for(let part=0;part<count;part++){
   const a=start+(end-start)*part/count,b=start+(end-start)*(part+1)/count,base='C'+String(visual).padStart(3,'0'),suffix=count>1?alphaSuffix(part):'';
   if(count>1)technical++;
   result.push({id:base+suffix,start:Number(a.toFixed(3)),end:Number(b.toFixed(3)),title:'Cena detectada '+String(visual).padStart(3,'0')+(count>1?' • parte '+suffix:''),type:'A revisar',characters:[],location:'',dialogue:'',image:'pending',animation:'pending',approved:false,detected:true,sourceGroup:base})
  }
 }
 return {scenes:result,visualCuts:Math.max(0,visual-1),technicalSplits:technical}
}
async function analyzeSelectedVideo(){
 if(!analysisVideoFile||!analysisObjectUrl)return toast('Selecione primeiro um arquivo local');
 const progressText=document.getElementById('analysisProgressText'),progressBar=document.getElementById('analysisProgressBar');
 if(progressText)progressText.textContent='Preparando vídeo...';if(progressBar)progressBar.style.width='1%';
 const step=Number(document.getElementById('analysisStep')?.value||1),fraction=Number(document.getElementById('analysisThreshold')?.value||0.05),splitLong=!!document.getElementById('splitLongScenes')?.checked;
 const labels={0.03:'Baixa',0.05:'Média',0.08:'Alta'},video=document.createElement('video'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 canvas.width=96;canvas.height=54;video.muted=true;video.playsInline=true;video.preload='auto';video.style.position='fixed';video.style.left='-9999px';video.style.width='320px';video.style.height='180px';video.setAttribute('aria-hidden','true');document.body.appendChild(video);analysisAbort=false;
 try{
  video.src=analysisObjectUrl;
  await new Promise((resolve,reject)=>{if(video.readyState>=1)return resolve();video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',()=>reject(video.error||new Error('metadata')),{once:true});video.load()});
  await waitMediaReady(video);
  const duration=video.duration,total=Math.ceil(duration/step),samples=[];let prev=null;
  await forceDecodedFrame(video,0);
  let diagnosticFrames=0,diagnosticVariance=0;
  for(let i=0,t=0;t<duration;t+=step,i++){
   if(analysisAbort){toast('Análise cancelada');return}
   await forceDecodedFrame(video,t);
   const vec=frameVector(video,canvas,ctx),diff=prev?frameDifference(prev,vec):0;
   if((vec._variance||0)>1){diagnosticFrames++;diagnosticVariance=Math.max(diagnosticVariance,vec._variance||0)}
   samples.push({time:t,diff});prev=vec;
   if(i%5===0){const pct=Math.min(100,Math.round((i+1)/total*100)),bar=document.getElementById('analysisProgressBar'),txt=document.getElementById('analysisProgressText');if(bar)bar.style.width=pct+'%';if(txt)txt.textContent='Analisando '+pct+'% • '+fmt(t)+' / '+fmt(duration);await new Promise(r=>setTimeout(r,0))}
  }
  const maxDiff=Math.max(...samples.map(x=>x.diff)),p=project();
  if(maxDiff<0.001){
   delete p.analysisCandidateScenes;
   p.analysisStats={step,threshold:fraction,thresholdLabel:labels[fraction]||String(fraction),visualCuts:0,technicalSplits:0,cutoff:0,maxDiff:Number(maxDiff.toFixed(4)),diagnosticFrames,diagnosticVariance:Number(diagnosticVariance.toFixed(2)),failed:true,analyzedAt:Date.now()};
   save();render();toast('O navegador não entregou quadros diferentes do vídeo');return
  }
  const picked=pickVisualCuts(samples,fraction,step),built=buildDetectedScenes(picked.cuts,duration,splitLong);
  p.analysisCandidateScenes=built.scenes;
  p.analysisStats={step,threshold:fraction,thresholdLabel:labels[fraction]||String(fraction),visualCuts:built.visualCuts,technicalSplits:built.technicalSplits,cutoff:Number(picked.cutoff.toFixed(4)),maxDiff:Number(maxDiff.toFixed(4)),diagnosticFrames,diagnosticVariance:Number(diagnosticVariance.toFixed(2)),analyzedAt:Date.now()};
  save();render();toast(built.scenes.length+' segmentos detectados')
 }catch(e){console.error(e);const txt=document.getElementById('analysisProgressText');if(txt)txt.textContent='Falha na análise: '+(e?.message||'erro desconhecido');toast('Falha durante a análise do vídeo')}
 finally{try{video.pause();video.removeAttribute('src');video.load();video.remove()}catch(e){}}
}
async function captureThumb(video,time,width=160,height=90){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 canvas.width=width;canvas.height=height;
 await waitSeek(video,time);
 ctx.drawImage(video,0,0,width,height);
 return canvas.toDataURL('image/jpeg',0.58)
}
async function generateAnalysisThumbs(){
 const p=project(),scenes=p.analysisCandidateScenes||[];
 if(!analysisObjectUrl||!scenes.length)return toast('Selecione novamente o vídeo local');
 const video=document.createElement('video');video.muted=true;video.preload='auto';video.src=analysisObjectUrl;
 await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject});
 const max=Math.min(24,scenes.length);
 toast('Gerando miniaturas...');
 for(let i=0;i<max;i++){
  const s=scenes[i];
  try{
   s.thumbStart=await captureThumb(video,Math.min(s.start+0.05,video.duration-0.05));
   s.thumbEnd=await captureThumb(video,Math.max(s.start+0.05,Math.min(s.end-0.05,video.duration-0.05)));
  }catch(e){}
  if(i%3===0){const txt=document.getElementById('analysisProgressText');if(txt)txt.textContent='Miniaturas '+(i+1)+' / '+max;await new Promise(r=>setTimeout(r,0))}
 }
 save();render();toast('Miniaturas geradas')
}
function applyDetectedScenes(){
 const p=project(),candidate=p.analysisCandidateScenes||[];
 if(!candidate.length)return toast('Nenhuma análise disponível');
 if(p.scenes.length&&!confirm('Substituir a decupagem atual pelas cenas detectadas?'))return;
 p.scenes=candidate.map(s=>({...s}));delete p.analysisCandidateScenes;save();state.page='Cenas';render();toast('Decupagem automática aplicada')
}
function subtitleTimeToSeconds(raw){
 const s=String(raw||'').trim().replace(',', '.').split(':').map(Number);
 if(s.length===3)return s[0]*3600+s[1]*60+s[2];
 if(s.length===2)return s[0]*60+s[1];
 return Number(s[0]||0)
}
function parseSubtitleText(text){
 const normalized=String(text||'').replace(/^WEBVTT[^\n]*\n+/i,'').replace(/\r/g,'');
 const blocks=normalized.split(/\n{2,}/),cues=[];
 for(const block of blocks){
  const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
  const timeIndex=lines.findIndex(x=>x.includes('-->'));
  if(timeIndex<0)continue;
  const [a,bRaw]=lines[timeIndex].split('-->');
  const b=String(bRaw||'').trim().split(/\s+/)[0];
  const start=subtitleTimeToSeconds(a),end=subtitleTimeToSeconds(b);
  const cueText=lines.slice(timeIndex+1).join(' ').replace(/<[^>]+>/g,'').replace(/\{\\[^}]+\}/g,'').trim();
  if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&cueText)cues.push({start,end,text:cueText})
 }
 return cues
}
function sceneCueOverlap(scene,cue){return Math.max(0,Math.min(scene.end,cue.end)-Math.max(scene.start,cue.start))}

function normalizeSpeechText(text){return String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
function classifySceneSpeech(scene,text){
 const n=normalizeSpeechText(text),words=n?n.split(' ').filter(Boolean):[];
 if(!n){
  const weak=['dark','low_info','review'].includes(scene.thumbnailStatus);
  return {type:weak?'Sem fala':'Ambiente',speechType:'none',confidence:weak?0.78:0.94,reason:weak?'sem fala e quadro pouco informativo':'sem fala detectada'};
 }
 let dialog=0,narration=0;
 if(/[?!]/.test(text))dialog+=2;
 if(/[“”"—-]/.test(text))dialog+=1;
 const vocatives=['meu pai','meu filho','minha filha','senhor','mestre','irmao','irma','eis-me aqui','eis me aqui','pai','filho'];
 if(vocatives.some(v=>n.includes(v)))dialog+=2;
 const direct=['onde esta','nao temas','venha','venham','olhe','escute','diga-me','eu sou','eu vou','voce','voces','tu ','teu ','tua ','meu ','minha '];
 if(direct.some(v=>n.includes(v)))dialog+=2;
 if(words.length<=12)dialog+=1;

 const narrativeMarkers=['naquele tempo','certo dia','entao','depois','em seguida','logo depois','aconteceu que','e aconteceu','naquele dia','quando chegou','enquanto isso','assim','por isso'];
 if(narrativeMarkers.some(v=>n.includes(v)))narration+=2;
 const third=['ele ','ela ','eles ','abraao ','isaque ','sara ','deus ','o senhor ','o anjo ','o homem ','o menino '];
 if(third.filter(v=>n.includes(v)).length)narration+=1;
 const narrativeVerbs=['foi','foram','levou','tomou','colocou','subiu','seguiu','seguiram','continuou','continuaram','chegou','partiu','voltou','viu','chamou','ordenou','preparou'];
 if(narrativeVerbs.filter(v=>new RegExp('\\b'+v+'\\b').test(n)).length>=2)narration+=2;
 if(words.length>=18)narration+=1;
 if(/\b(disse|respondeu|perguntou|falou)\b/.test(n)&&!/[“”"]/.test(text)){narration+=1;dialog+=1}

 const delta=Math.abs(dialog-narration);
 if(delta<=1){
  return {type:'A revisar',speechType:'unknown',confidence:0.58,reason:'fala ambígua entre diálogo e narração'};
 }
 if(dialog>narration){
  return {type:'Diálogo',speechType:'character',confidence:Math.min(0.96,0.68+delta*0.08),reason:'padrões de fala direta'};
 }
 return {type:'Narração',speechType:'voice_over',confidence:Math.min(0.96,0.68+delta*0.08),reason:'padrões de locução narrativa'};
}
function applyAutoClassification(scene,text,force=false){
 const result=classifySceneSpeech(scene,text);
 scene.speechType=result.speechType;
 scene.classificationConfidence=result.confidence;
 scene.classificationReason=result.reason;
 scene.autoClassifiedAt=Date.now();
 if(force||!scene.manualType)scene.type=result.type;
 return result
}
function reclassifyExistingScenes(force=false){
 const p=project(),counts={'Diálogo':0,'Narração':0,'Ambiente':0,'Sem fala':0,'A revisar':0};
 for(const s of p.scenes){const r=applyAutoClassification(s,s.dialogue||'',force);counts[r.type]=(counts[r.type]||0)+1}
 p.classificationStats={...counts,updatedAt:Date.now()};save();render();toast('Classificação automática atualizada')
}
function applyTranscriptCues(cues,replace=false){
 const p=project();let count=0;const counts={'Diálogo':0,'Narração':0,'Ambiente':0,'Sem fala':0,'A revisar':0};
 for(const s of p.scenes){
  const hits=cues.filter(c=>sceneCueOverlap(s,c)>0.05).sort((a,b)=>a.start-b.start);
  const text=hits.length?[...new Set(hits.map(c=>c.text))].join(' ').replace(/\s+/g,' ').trim():'';
  s.transcriptSegments=hits.map(c=>({start:c.start,end:c.end,text:c.text}));
  if(text&&(replace||!String(s.dialogue||'').trim())){s.dialogue=text;count++}
  const effective=String(s.dialogue||text||'').trim();
  const result=applyAutoClassification(s,effective,false);
  counts[result.type]=(counts[result.type]||0)+1;
  if(result.type==='Diálogo'&&!s.speaker&&s.characters?.length===1)s.speaker=s.characters[0]
 }
 p.transcriptSceneCount=count;p.transcriptAppliedAt=Date.now();p.classificationStats={...counts,updatedAt:Date.now()};save();render();toast(count+' cenas receberam fala e foram classificadas')
}
function importSubtitleFile(e){
 const file=e.target.files[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{const cues=parseSubtitleText(reader.result),p=project();if(!cues.length)return toast('Nenhuma legenda válida encontrada');p.transcriptFileName=file.name;p.transcriptCueCount=cues.length;const replace=!!document.getElementById('replaceDialogue')?.checked;applyTranscriptCues(cues,replace)};
 reader.onerror=()=>toast('Falha ao ler a legenda');reader.readAsText(file,'UTF-8')
}
function importScenesJson(){try{const arr=JSON.parse(document.getElementById('jsonScenes').value);if(!Array.isArray(arr))throw 0;const p=project(),base=p.scenes.length;p.scenes.push(...arr.map((x,i)=>({id:x.id||'C'+String(base+i+1).padStart(3,'0'),start:Number(x.start||0),end:Number(x.end||0),title:x.title||'Cena '+(base+i+1),type:x.type||'Ambiente/Narração',characters:x.characters||[],location:x.location||'',dialogue:x.dialogue||'',image:'pending',animation:'pending',approved:false})));save();render();toast('Cenas importadas')}catch{toast('JSON inválido')}}
function nextView(){const p=project(),s=nextScene(p);if(!s)return '<section class="card empty"><h2>Nenhuma cena cadastrada</h2><p class="muted">Importe ou crie a primeira cena para iniciar a produção.</p><button class="btn primary" onclick="setPage(\'Cenas\')">Ir para Cenas</button></section>';const image=s.image!=='done',kind=image?'Gerar imagem':s.animation!=='done'?'Gerar animação':'Aprovar cena',file=image?expectedFile(s,'image'):expectedFile(s,'animation'),prompt=image?imagePrompt(s):animationPrompt(s),tt=(state.tools||defaultTools).filter(t=>t.category===(image?'image':'animation')),dur=sceneDuration(s),max=Math.min(...tt.map(t=>t.max||999));
return '<div class="grid"><section class="card span2"><div class="top"><div><p class="eyebrow">PROJETO ATIVO</p><h2>'+esc(p.name)+'</h2></div><div class="percent">'+progress(p)+'%</div></div><div class="progress"><div style="width:'+progress(p)+'%"></div></div></section><section class="card span2"><div class="section-title"><div><p class="eyebrow">PRÓXIMA AÇÃO</p><h2>'+s.id+' — '+kind+'</h2><p class="muted">'+esc(s.title)+'</p></div><span class="badge accent">'+s.type+'</span></div><div class="scene-meta"><div><small>Intervalo</small><strong>'+fmt(s.start)+' → '+fmt(s.end)+'</strong></div><div><small>Duração</small><strong>'+dur.toFixed(1)+' s</strong></div><div><small>Personagens</small><strong>'+esc(s.characters.join(', ')||'—')+'</strong></div><div><small>Cenário</small><strong>'+esc(s.location||'—')+'</strong></div></div>'+(dur>max?'<div class="warning">Esta cena tem '+dur.toFixed(1)+' s. O perfil atual dos geradores indica até '+max+' s; considere dividir em duas partes.</div>':'')+'<div class="two"><div><span class="label">Nome sugerido</span><div class="panel copybox"><code>'+file+'</code><button class="btn" onclick="copy(\''+file+'\')">Copiar</button></div></div><div><span class="label">Prompt</span><div class="panel"><p class="prompt">'+esc(prompt)+'</p><button class="btn" onclick="copy('+JSON.stringify(prompt)+')">Copiar prompt</button></div></div></div><div class="tools">'+tt.map(t=>'<a class="'+(t.preferred?'preferred':'')+'" href="'+t.url+'" target="_blank">↗ '+t.name+(t.preferred?' • preferida':'')+'</a>').join('')+'</div><button class="btn primary" onclick="markNext()">✓ Marcar etapa como concluída</button></section></div>'}
function production(){const p=project();return '<section class="card"><div class="section-title"><div><p class="eyebrow">PIPELINE</p><h2>Produção por cena</h2></div><span class="badge">'+p.scenes.length+' cenas</span></div><div class="table">'+p.scenes.map(s=>'<div class="row"><strong>'+s.id+'</strong><span>'+esc(s.title)+'<small>'+sceneDuration(s).toFixed(1)+' s</small></span><button class="statusbtn '+(s.image==='done'?'ok':'warn')+'" onclick="toggleStatus(\''+s.id+'\',\'image\')">'+(s.image==='done'?'✓':'○')+' Imagem</button><button class="statusbtn '+(s.animation==='done'?'ok':'warn')+'" onclick="toggleStatus(\''+s.id+'\',\'animation\')">'+(s.animation==='done'?'✓':'○')+' Animação</button><button class="statusbtn '+(s.approved?'ok':'warn')+'" onclick="toggleStatus(\''+s.id+'\',\'approved\')">'+(s.approved?'✓':'○')+' Final</button></div>').join('')+'</div></section>'}
function toggleStatus(id,key){const s=project().scenes.find(x=>x.id===id);if(!s)return;if(key==='approved')s.approved=!s.approved;else s[key]=s[key]==='done'?'pending':'done';save();render()}
function sceneMatchesFilter(s){
 if(sceneFilter==='review')return s.type==='A revisar';
 if(sceneFilter==='dialogue')return s.type==='Diálogo';
 if(sceneFilter==='narration')return s.type==='Narração';
 if(sceneFilter==='ambient')return s.type==='Ambiente';
 if(sceneFilter==='no-dialogue')return s.type==='Sem fala'||!String(s.dialogue||'').trim();
 if(sceneFilter==='pending')return s.image!=='done'||s.animation!=='done'||!s.approved;
 return true
}
function setSceneFilter(v){sceneFilter=v;sceneSelection.clear();render()}
function toggleSceneSelection(id,checked){if(checked)sceneSelection.add(id);else sceneSelection.delete(id);updateBulkCounter()}
function updateBulkCounter(){const e=document.getElementById('bulkCounter');if(e)e.textContent=sceneSelection.size+' selecionada(s)'}
function selectAllVisible(){
 const visible=project().scenes.filter(sceneMatchesFilter);
 const all=visible.length&&visible.every(s=>sceneSelection.has(s.id));
 visible.forEach(s=>all?sceneSelection.delete(s.id):sceneSelection.add(s.id));render()
}
function applyBulkEdit(){
 if(!sceneSelection.size)return toast('Selecione ao menos uma cena');
 const type=document.getElementById('bulkType')?.value||'',location=(document.getElementById('bulkLocation')?.value||'').trim(),characters=(document.getElementById('bulkCharacters')?.value||'').trim(),speaker=(document.getElementById('bulkSpeaker')?.value||'').trim(),ambience=(document.getElementById('bulkAmbience')?.value||'').trim();
 let changed=0;
 for(const s of project().scenes){
  if(!sceneSelection.has(s.id))continue;
  if(type){s.type=type;s.manualType=true;}
  if(location)s.location=location;
  if(characters)s.characters=characters.split(',').map(x=>x.trim()).filter(Boolean);
  if(speaker)s.speaker=speaker;
  if(ambience)s.ambience=ambience;
  changed++
 }
 save();render();toast(changed+' cenas atualizadas')
}
function clearBulkSelection(){sceneSelection.clear();render()}
function sourceGroupScenes(s,p=project()){const g=s.sourceGroup||String(s.id||'').match(/^(C\d{3})/)?.[1];return g?p.scenes.filter(x=>(x.sourceGroup||String(x.id||'').match(/^(C\d{3})/)?.[1])===g):[s]}
function propagateContinuityFromSelected(){
 if(selectedSceneIndex===null)return toast('Abra uma cena em Detalhes');
 const p=project(),source=p.scenes[selectedSceneIndex],group=sourceGroupScenes(source,p);
 if(group.length<2)return toast('Esta cena não possui subcenas vinculadas');
 let changed=0;
 for(const s of group){
  if(s===source)continue;
  ['characters','location','speaker','camera','ambience'].forEach(k=>{if(source[k])s[k]=Array.isArray(source[k])?[...source[k]]:source[k]});
  if(source.action&&!s.action)s.action=source.action;
  s.continuityNote='Continue directly from '+source.id+' with the same character appearance, positions, lighting, environment and camera logic';
  changed++
 }
 save();render();toast('Continuidade propagada para '+changed+' subcena(s)')
}
function scenesView(){
 const p=project(),selected=selectedSceneIndex!==null?p.scenes[selectedSceneIndex]:null,visible=p.scenes.filter(sceneMatchesFilter);
 return '<div class="grid"><section class="card span2"><div class="section-title"><div><p class="eyebrow">CENAS</p><h2>Decupagem</h2><p class="muted">'+visible.length+' de '+p.scenes.length+' cenas visíveis</p></div><button class="btn primary" onclick="addScene()">+ Nova cena</button></div><div class="scene-toolbar"><div class="filter-tabs">'+[['all','Todas'],['review','A revisar'],['dialogue','Diálogo'],['narration','Narração'],['ambient','Ambiente'],['no-dialogue','Sem fala'],['pending','Pendentes']].map(([v,l])=>'<button class="btn '+(sceneFilter===v?'active-filter':'')+'" onclick="setSceneFilter(\''+v+'\')">'+l+'</button>').join('')+'</div><div class="actions"><button class="btn" onclick="reclassifyExistingScenes(false)">Reclassificar automaticamente</button><button class="btn" onclick="selectAllVisible()">Selecionar visíveis</button><span id="bulkCounter" class="badge">'+sceneSelection.size+' selecionada(s)</span></div></div>'+
 (sceneSelection.size?'<div class="bulk-panel"><div class="bulk-grid"><label>Tipo<select id="bulkType"><option value="">Não alterar</option><option>A revisar</option><option>Diálogo</option><option>Narração</option><option>Ambiente</option><option>Sem fala</option></select></label><label>Cenário<input id="bulkLocation" placeholder="ex.: CAMP_OASIS_01"></label><label>Personagens<input id="bulkCharacters" placeholder="ABRAHAM_01, ISAAC_01"></label><label>Falante<input id="bulkSpeaker" placeholder="ex.: ABRAHAM_01"></label><label>Som ambiente<input id="bulkAmbience" placeholder="vento, passos, tecido..."></label></div><div class="actions"><button class="btn primary" onclick="applyBulkEdit()">Aplicar às selecionadas</button><button class="btn" onclick="clearBulkSelection()">Limpar seleção</button></div></div>':'')+
 '<div class="table scene-table">'+p.scenes.map((s,i)=>sceneMatchesFilter(s)?'<div class="scene-edit '+(selectedSceneIndex===i?'selected-scene':'')+'"><input class="scene-check" type="checkbox" '+(sceneSelection.has(s.id)?'checked':'')+' onchange="toggleSceneSelection(\''+s.id+'\',this.checked)"><div class="scene-thumb-wrap"><img class="scene-thumb" data-scene-thumb="'+s.id+'" alt="Miniatura '+s.id+'"></div><div><strong>'+s.id+'</strong><small>'+fmt(s.start)+' → '+fmt(s.end)+' • '+sceneDuration(s).toFixed(1)+' s'+(s.classificationConfidence?' • '+Math.round(s.classificationConfidence*100)+'%':'')+'</small></div><input value="'+esc(s.title)+'" onchange="editScene('+i+',\'title\',this.value)"><select onchange="editScene('+i+',\'type\',this.value)"><option '+(s.type==='A revisar'?'selected':'')+'>A revisar</option><option '+(s.type==='Diálogo'?'selected':'')+'>Diálogo</option><option '+(s.type==='Narração'?'selected':'')+'>Narração</option><option '+(s.type==='Ambiente'?'selected':'')+'>Ambiente</option><option '+(s.type==='Sem fala'?'selected':'')+'>Sem fala</option></select><input placeholder="Personagens: ID, ID" value="'+esc(s.characters.join(', '))+'" onchange="editScene('+i+',\'characters\',this.value)"><input placeholder="Cenário" value="'+esc(s.location)+'" onchange="editScene('+i+',\'location\',this.value)"><button class="btn" onclick="editTimes('+i+')">Tempo</button><button class="btn" onclick="selectSceneDetail('+i+')">Detalhes</button><button class="btn danger" onclick="removeScene('+i+')">×</button></div>':'').join('')+'</div></section>'+
 (selected?'<section class="card span2 scene-detail"><div class="section-title"><div><p class="eyebrow">DIREÇÃO DA CENA</p><h2>'+selected.id+' — '+esc(selected.title)+'</h2><p class="muted">'+(selected.sourceGroup?'Grupo '+esc(selected.sourceGroup)+' • ':'')+(selected.speaker?'Falante: '+esc(selected.speaker):'Falante não definido')+'</p></div><div class="actions">'+(sourceGroupScenes(selected,p).length>1?'<button class="btn" onclick="propagateContinuityFromSelected()">Propagar continuidade</button>':'')+'<button class="btn" onclick="closeSceneDetail()">Fechar</button></div></div><div class="scene-detail-thumb"><img class="scene-thumb-large" data-scene-thumb="'+selected.id+'" alt="Miniatura '+selected.id+'"></div><div class="detail-grid"><label>Personagem falante<input value="'+esc(selected.speaker||'')+'" onchange="editSceneDetail(\'speaker\',this.value)" placeholder="ex.: ABRAHAM_01"></label><label>Fala / diálogo<textarea rows="4" onchange="editSceneDetail(\'dialogue\',this.value)" placeholder="Texto falado na cena">'+esc(selected.dialogue||'')+'</textarea></label><label>Ação<textarea rows="4" onchange="editSceneDetail(\'action\',this.value)" placeholder="Movimentos e atuação dos personagens">'+esc(selected.action||'')+'</textarea></label><label>Câmera<textarea rows="4" onchange="editSceneDetail(\'camera\',this.value)" placeholder="Plano, movimento e enquadramento">'+esc(selected.camera||'')+'</textarea></label><label>Som ambiente<textarea rows="4" onchange="editSceneDetail(\'ambience\',this.value)" placeholder="Passos, vento, tecido, animais, ambiente">'+esc(selected.ambience||'')+'</textarea></label></div><div class="two"><div class="panel"><span class="label">Prompt de imagem</span><p class="prompt">'+esc(imagePrompt(selected))+'</p><button class="btn" onclick="copy('+JSON.stringify(imagePrompt(selected))+')">Copiar</button></div><div class="panel"><span class="label">Prompt de animação</span><p class="prompt">'+esc(animationPrompt(selected))+'</p><button class="btn" onclick="copy('+JSON.stringify(animationPrompt(selected))+')">Copiar</button></div></div></section>':'')+'</div>'
}
function selectSceneDetail(i){selectedSceneIndex=i;render()}
function closeSceneDetail(){selectedSceneIndex=null;render()}
function editSceneDetail(key,val){if(selectedSceneIndex===null)return;project().scenes[selectedSceneIndex][key]=val;save()}
function addScene(){const p=project(),last=p.scenes[p.scenes.length-1],n=p.scenes.length+1,start=last?Number(last.end):0;p.scenes.push({id:'C'+String(n).padStart(3,'0'),start,end:start+8,title:'Nova cena',type:'Ambiente/Narração',characters:[],location:'',dialogue:'',image:'pending',animation:'pending',approved:false});save();render()}
function editScene(i,key,val){const s=project().scenes[i];if(key==='characters')s.characters=val.split(',').map(x=>x.trim()).filter(Boolean);else s[key]=val;if(key==='type')s.manualType=true;save()}
function editTimes(i){const s=project().scenes[i],a=prompt('Início em segundos',s.start),b=prompt('Fim em segundos',s.end);if(a!==null&&b!==null){s.start=Number(a);s.end=Number(b);save();render()}}
function removeScene(i){project().scenes.splice(i,1);if(selectedSceneIndex===i)selectedSceneIndex=null;else if(selectedSceneIndex!==null&&selectedSceneIndex>i)selectedSceneIndex--;save();render()}
function assetsView(kind){
 const p=project(),arr=kind==='Personagens'?p.characters:p.locations,label=kind==='Personagens'?'ID do personagem':'ID do cenário',summary=fileSummary(p);
 const characterViews=['FRONT','3Q','SIDE','BACK'],scenarioViews=['BASE','WIDE','DETAIL'];
 return '<section class="card"><div class="section-title"><div><p class="eyebrow">'+kind.toUpperCase()+'</p><h2>'+kind+'</h2></div><button class="btn primary" onclick="addAsset(\''+kind+'\')">+ Adicionar</button></div><div class="asset-grid">'+arr.map(x=>{
   const found=kind==='Personagens'?(summary.characters[x]||{}):(summary.scenarios[x]||{});
   const views=kind==='Personagens'?characterViews:scenarioViews;
   return '<div class="panel asset"><strong>'+esc(x)+'</strong><div class="asset-status">'+views.map(v=>'<span class="'+(found[v]?'ok':'wait')+'">'+(found[v]?'✓ ':'○ ')+v+'</span>').join('')+'</div><small class="muted">'+(Object.keys(found).length?Object.keys(found).length+' referência(s) encontrada(s)':'sem arquivo detectado')+'</small><button class="btn danger" onclick="removeAsset(\''+kind+'\',\''+esc(x)+'\')">Remover</button></div>'
 }).join('')+'</div>'+(arr.length?'':'<p class="muted">Nenhum '+label.toLowerCase()+' cadastrado.</p>')+'</section>'
}
function addAsset(kind){const v=prompt(kind==='Personagens'?'ID do personagem, ex.: ABRAHAM_01':'ID do cenário, ex.: CAMP_OASIS_01');if(!v)return;const arr=kind==='Personagens'?project().characters:project().locations;if(!arr.includes(v.trim()))arr.push(v.trim());save();render()}
function removeAsset(kind,v){const key=kind==='Personagens'?'characters':'locations';project()[key]=project()[key].filter(x=>x!==v);save();render()}


function syncIntervalMs(p=project()){const v=p.autoSync||'manual';return v==='30s'?30000:v==='1m'?60000:v==='5m'?300000:0}
function configureAutoSync(){
 if(autoSyncTimer){clearInterval(autoSyncTimer);autoSyncTimer=null}
 const ms=syncIntervalMs();
 if(!ms)return;
 autoSyncTimer=setInterval(()=>{silentAutoSync()},ms);
}
async function silentAutoSync(){
 const p=project();
 try{
  if(p.storage==='Google Drive no computador'){
   const h=await loadDirectoryHandle(p.id);
   if(!h)return;
   if(await h.queryPermission({mode:'read'})!=='granted')return;
   await syncProjectFolder(true);
  }else if(p.storage==='Google Drive Online'&&driveToken&&p.driveFolderId){
   await syncDriveOnline(true);
  }
 }catch(e){}
}
function setAutoSync(v){project().autoSync=v;save();configureAutoSync();render()}
function parseDriveFolderId(value){
 const s=String(value||'').trim();
 const m=s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
 return m?m[1]:s;
}
function loadScript(src,id){
 return new Promise((resolve,reject)=>{
  if(document.getElementById(id))return resolve();
  const s=document.createElement('script');s.id=id;s.src=src;s.async=true;s.defer=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
 })
}
async function saveDriveConfig(){
 const p=project();
 p.driveClientId=(document.getElementById('driveClientId')?.value||'').trim();
 p.driveFolderId=parseDriveFolderId(document.getElementById('driveFolderId')?.value||'');
 save();render();toast('Configuração do Drive salva');
}
function saveDriveSessionToken(token,expiresIn){
 driveToken=token||null;
 driveTokenExpiresAt=Date.now()+Math.max(60,Number(expiresIn||3600))*1000;
 try{
  if(driveToken){sessionStorage.setItem('animartoon-drive-token',driveToken);sessionStorage.setItem('animartoon-drive-expiry',String(driveTokenExpiresAt))}
 }catch(e){}
}
function clearDriveSessionToken(){
 driveToken=null;driveTokenExpiresAt=0;
 try{sessionStorage.removeItem('animartoon-drive-token');sessionStorage.removeItem('animartoon-drive-expiry')}catch(e){}
}
async function connectDriveOnline(){
 const p=project();
 if(!p.driveClientId)return toast('Informe o OAuth Client ID do Google');
 if(!p.driveFolderId)return toast('Informe a pasta do Google Drive');
 try{
  await loadScript('https://accounts.google.com/gsi/client','google-gsi');
  driveTokenClient=google.accounts.oauth2.initTokenClient({
   client_id:p.driveClientId,
   scope:'https://www.googleapis.com/auth/drive.readonly',
   callback:(resp)=>{
    if(resp.error)return toast('Falha na autorização do Google Drive');
    saveDriveSessionToken(resp.access_token,resp.expires_in);
    p.driveConnectedAt=Date.now();
    save();render();toast('Google Drive conectado');
   }
  });
  driveTokenClient.requestAccessToken({prompt:p.driveConnectedAt?'':'consent'});
 }catch(e){toast('Não foi possível carregar a autorização Google')}
}
function disconnectDriveOnline(){clearDriveSessionToken();project().driveConnectedAt=null;save();render();toast('Google Drive desconectado')}
async function driveListChildren(folderId,path='',out=[]){
 let pageToken='';
 do{
  const q=encodeURIComponent("'"+folderId+"' in parents and trashed=false");
  const fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,size)');
  const url='https://www.googleapis.com/drive/v3/files?q='+q+'&fields='+fields+'&pageSize=1000'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
  const r=await fetch(url,{headers:{Authorization:'Bearer '+driveToken}});
  if(r.status===401){clearDriveSessionToken();throw new Error('TOKEN_EXPIRED')}
  if(!r.ok)throw new Error('DRIVE_'+r.status);
  const data=await r.json();
  for(const item of data.files||[]){
   const full=path?path+'/'+item.name:item.name;
   if(item.mimeType==='application/vnd.google-apps.folder')await driveListChildren(item.id,full,out);
   else out.push({name:item.name,path:full,size:Number(item.size||0),lastModified:item.modifiedTime?Date.parse(item.modifiedTime):0,type:item.mimeType||'',driveId:item.id});
  }
  pageToken=data.nextPageToken||'';
 }while(pageToken);
 return out;
}
async function syncDriveOnline(silent=false){
 const p=project();
 if(!driveToken){if(!silent)toast('Conecte novamente ao Google Drive');return}
 if(!p.driveFolderId){if(!silent)toast('Informe a pasta do Google Drive');return}
 try{
  if(!silent)toast('Consultando Google Drive...');
  const files=(await driveListChildren(p.driveFolderId)).map(classifyFile),summary=summarizeFiles(files);
  p.fileIndex=files;p.lastSync=Date.now();p.fileStats={recognized:summary.recognized.length,unrecognized:summary.unrecognized.length,duplicates:summary.duplicates.length,total:files.length};
  applyFileIndex(p,summary);save();render();if(!silent)toast('Google Drive sincronizado');
 }catch(e){
  if(e.message==='TOKEN_EXPIRED'){if(!silent)toast('Sessão do Google Drive expirou; conecte novamente')}
  else if(!silent)toast('Falha ao consultar Google Drive');
 }
}
function onlineDriveControls(p){
 const connected=!!driveToken,hasPrior=!!p.driveConnectedAt;
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">GOOGLE DRIVE ONLINE</p><h2>'+(connected?'Conectado nesta sessão':hasPrior?'Reconectar Google Drive':'Configurar monitoramento')+'</h2></div><span class="badge '+(connected?'ok':'warn')+'">'+(connected?'conectado':hasPrior?'reconectar':'desconectado')+'</span></div><p class="muted">A integração usa OAuth no navegador e escopo de leitura do Drive. O token temporário fica apenas na sessão desta aba: uma atualização da página mantém a conexão enquanto o token ainda for válido; ao fechar a aba ou quando o token expirar, basta reconectar.</p><div class="form-grid"><label>OAuth Client ID<input id="driveClientId" value="'+esc(p.driveClientId||'')+'" placeholder="...apps.googleusercontent.com"></label><label>Pasta do projeto no Drive<input id="driveFolderId" value="'+esc(p.driveFolderId||'')+'" placeholder="Cole o link da pasta ou o ID"></label></div><div class="actions"><button class="btn" onclick="saveDriveConfig()">Salvar configuração</button><button class="btn primary" onclick="connectDriveOnline()">'+(connected?'Google Drive conectado':hasPrior?'Reconectar Google Drive':'Conectar Google Drive')+'</button><button class="btn" onclick="syncDriveOnline()">↻ Sincronizar agora</button>'+(connected?'<button class="btn danger" onclick="disconnectDriveOnline()">Desconectar</button>':'')+'</div>'+(connected&&driveTokenExpiresAt?'<p class="muted note">Sessão OAuth válida aproximadamente até '+new Date(driveTokenExpiresAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'. Atualizar a página não exige nova conexão enquanto esta sessão estiver válida.</p>':'')+(p.lastSync?'<p class="muted note">Última sincronização: '+new Date(p.lastSync).toLocaleString('pt-BR')+'</p>':'')+'</section>'
}
function autoSyncControls(p){
 const opts=[['manual','Manual'],['30s','30 segundos'],['1m','1 minuto'],['5m','5 minutos']];
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">SINCRONIZAÇÃO AUTOMÁTICA</p><h2>Frequência</h2></div><span class="badge">'+(p.autoSync&&p.autoSync!=='manual'?'ativa':'manual')+'</span></div><div class="sync-options">'+opts.map(([v,l])=>'<button class="mode '+((p.autoSync||'manual')===v?'selected':'')+'" onclick="setAutoSync(\''+v+'\')"><strong>'+l+'</strong></button>').join('')+'</div><p class="muted note">A sincronização automática funciona enquanto a página estiver aberta. No modo local, a permissão da pasta precisa continuar válida; no Drive Online, a sessão OAuth precisa estar conectada.</p></section>'
}
const folderLayout=['00_REFERENCIAS','01_PERSONAGENS','02_CENARIOS','03_IMAGENS_CENAS','04_ANIMACOES','06_AUDIO','07_CENAS_FINAIS','08_EPISODIO_FINAL'];
const dbName='animartoon-fs',storeName='handles',thumbStoreName='scene-thumbs';
function openFsDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,2);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(storeName))req.result.createObjectStore(storeName);if(!req.result.objectStoreNames.contains(thumbStoreName))req.result.createObjectStore(thumbStoreName)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function saveSceneThumbnail(projectId,sceneId,image){if(!image)return;const db=await openFsDb();return new Promise((resolve,reject)=>{const tx=db.transaction(thumbStoreName,'readwrite');tx.objectStore(thumbStoreName).put(image,projectId+':'+sceneId);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function loadSceneThumbnail(projectId,sceneId){const db=await openFsDb();return new Promise((resolve,reject)=>{const req=db.transaction(thumbStoreName).objectStore(thumbStoreName).get(projectId+':'+sceneId);req.onsuccess=()=>resolve(req.result||'');req.onerror=()=>reject(req.error)})}
async function hydrateSceneThumbs(){
 const p=project(),nodes=[...document.querySelectorAll('[data-scene-thumb]')];
 for(const img of nodes){try{const src=await loadSceneThumbnail(p.id,img.dataset.sceneThumb);if(src)img.src=src}catch(e){}}
}
async function saveDirectoryHandle(projectId,handle){const db=await openFsDb();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).put(handle,projectId);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function loadDirectoryHandle(projectId){const db=await openFsDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName).objectStore(storeName).get(projectId);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}
async function ensurePermission(handle,write=false){const opts={mode:write?'readwrite':'read'};if(await handle.queryPermission(opts)==='granted')return true;return (await handle.requestPermission(opts))==='granted'}
function fsaSupported(){return 'showDirectoryPicker' in window}
async function chooseProjectFolder(){if(!fsaSupported())return toast('Use Chrome/Edge ou o modo manual.');try{const handle=await window.showDirectoryPicker({mode:'readwrite'});if(!(await ensurePermission(handle,true)))return toast('Permissão não concedida');await saveDirectoryHandle(project().id,handle);project().storage='Google Drive no computador';project().folderName=handle.name;save();render();toast('Pasta vinculada')}catch(e){if(e&&e.name!=='AbortError')toast('Não foi possível vincular a pasta')}}
async function getProjectHandle(write=false){const h=await loadDirectoryHandle(project().id);if(!h)return null;if(!(await ensurePermission(h,write)))return null;return h}
async function reconnectFolder(){const h=await getProjectHandle(false);if(!h)return toast('Selecione novamente a pasta');project().folderName=h.name;save();render();toast('Pasta reconectada')}
async function createFolderStructure(){const h=await getProjectHandle(true);if(!h)return toast('Vincule primeiro a pasta do projeto');for(const name of folderLayout)await h.getDirectoryHandle(name,{create:true});project().folderStructureCreated=true;save();render();toast('Estrutura criada')}
async function walkDirectory(handle,path='',out=[]){for await(const [name,entry] of handle.entries()){const full=path?path+'/'+name:name;if(entry.kind==='directory')await walkDirectory(entry,full,out);else{const f=await entry.getFile();out.push({name,path:full,size:f.size,lastModified:f.lastModified,type:f.type||''})}}return out}
function classifyFile(file){
 const scene=file.name.match(/^(C\d{3}[A-Z]?)_(IMG|ANIM|FINAL)_v(\d+)\.(png|jpe?g|webp|mp4|mov)$/i);
 if(scene)return {...file,recognized:true,assetType:'scene',sceneId:scene[1].toUpperCase(),kind:scene[2].toUpperCase(),version:Number(scene[3]),ext:scene[4].toLowerCase()};
 const character=file.name.match(/^([A-Z0-9]+(?:_[A-Z0-9]+)*)_(FRONT|3Q|SIDE|BACK)\.(png|jpe?g|webp)$/i);
 if(character)return {...file,recognized:true,assetType:'character',assetId:character[1].toUpperCase(),view:character[2].toUpperCase(),ext:character[3].toLowerCase()};
 const scenario=file.name.match(/^([A-Z0-9]+(?:_[A-Z0-9]+)*)_(BASE|WIDE|DETAIL)\.(png|jpe?g|webp)$/i);
 if(scenario)return {...file,recognized:true,assetType:'scenario',assetId:scenario[1].toUpperCase(),view:scenario[2].toUpperCase(),ext:scenario[3].toLowerCase()};
 return {...file,recognized:false}
}
function summarizeFiles(files){
 const recognized=files.filter(f=>f.recognized),unrecognized=files.filter(f=>!f.recognized),grouped={},characters={},scenarios={};
 for(const f of recognized){
  if(f.assetType==='scene'){
   const key=f.sceneId+'_'+f.kind;(grouped[key]||(grouped[key]=[])).push(f)
  }else if(f.assetType==='character'){
   (characters[f.assetId]||(characters[f.assetId]={}))[f.view]=f
  }else if(f.assetType==='scenario'){
   (scenarios[f.assetId]||(scenarios[f.assetId]={}))[f.view]=f
  }
 }
 const duplicates=Object.entries(grouped).filter(([,arr])=>arr.length>1).map(([key,arr])=>({key,count:arr.length,latest:arr.slice().sort((a,b)=>b.version-a.version)[0]}));
 return {recognized,unrecognized,grouped,duplicates,characters,scenarios}
}
function applyFileIndex(p,summary){for(const s of p.scenes){const imgs=summary.grouped[s.id+'_IMG']||[],anims=summary.grouped[s.id+'_ANIM']||[],finals=summary.grouped[s.id+'_FINAL']||[];if(imgs.length){s.image='done';s.imageVersion=Math.max(...imgs.map(f=>f.version))}if(anims.length){s.animation='done';s.animationVersion=Math.max(...anims.map(f=>f.version))}if(finals.length)s.approved=true}}
async function syncProjectFolder(){const h=await getProjectHandle(false);if(!h)return toast('Vincule ou reconecte a pasta do projeto');toast('Analisando arquivos...');const files=(await walkDirectory(h)).map(classifyFile),summary=summarizeFiles(files),p=project();p.fileIndex=files;p.lastSync=Date.now();p.folderName=h.name;p.fileStats={recognized:summary.recognized.length,unrecognized:summary.unrecognized.length,duplicates:summary.duplicates.length,total:files.length};applyFileIndex(p,summary);save();render();toast('Sincronização concluída')}
function fileSummary(p=project()){return summarizeFiles((p.fileIndex||[]).map(f=>f.recognized===undefined?classifyFile(f):f))}
function localFolderControls(p){const supported=fsaSupported();return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">PASTA LOCAL / GOOGLE DRIVE DESKTOP</p><h2>'+(p.folderName?esc(p.folderName):'Nenhuma pasta vinculada')+'</h2></div><span class="badge '+(supported?'ok':'warn')+'">'+(supported?'compatível':'não suportado')+'</span></div><p class="muted">Selecione a pasta do projeto dentro do Google Drive para computador. A Animartoon lê somente nomes e metadados autorizados; os arquivos não são enviados.</p><div class="actions"><button class="btn primary" onclick="chooseProjectFolder()">Selecionar pasta</button><button class="btn" onclick="reconnectFolder()">Reconectar</button><button class="btn" onclick="createFolderStructure()">Criar estrutura</button><button class="btn" onclick="syncProjectFolder()">↻ Sincronizar agora</button></div>'+(p.lastSync?'<p class="muted note">Última sincronização: '+new Date(p.lastSync).toLocaleString('pt-BR')+'</p>':'')+'</section>'}
function filemap(){
 const p=project(),summary=fileSummary(p),i=p.scenes.filter(s=>s.image==='done').length,a=p.scenes.filter(s=>s.animation==='done').length,f=p.scenes.filter(s=>s.approved).length;
 const charReady=p.characters.filter(id=>Object.keys(summary.characters[id]||{}).length>0).length,scenarioReady=p.locations.filter(id=>Object.keys(summary.scenarios[id]||{}).length>0).length;
 const b=[['Personagens',charReady,p.characters.length||1],['Cenários',scenarioReady,p.locations.length||1],['Imagens',i,p.scenes.length||1],['Animações',a,p.scenes.length||1],['Cenas finais',f,p.scenes.length||1]],physical=[['Arquivos totais',(p.fileIndex||[]).length],['Reconhecidos',summary.recognized.length],['Fora do padrão',summary.unrecognized.length],['Grupos com versões',summary.duplicates.length]];
 return '<div class="grid">'+(p.storage==='Google Drive no computador'?localFolderControls(p):p.storage==='Google Drive Online'?onlineDriveControls(p):'')+((p.storage==='Google Drive no computador'||p.storage==='Google Drive Online')?autoSyncControls(p):'')+
 '<section class="card span2"><p class="eyebrow">MAPA DA PRODUÇÃO</p><h2>Progresso por categoria</h2>'+b.map(x=>'<div class="mapline"><div class="topline"><strong>'+x[0]+'</strong><span>'+x[1]+' / '+x[2]+'</span></div><div class="mini"><div style="width:'+Math.min(100,x[1]/x[2]*100)+'%"></div></div></div>').join('')+'</section>'+
 '<section class="card span2"><p class="eyebrow">MAPA FÍSICO</p><h2>Arquivos encontrados</h2><div class="audit">'+physical.map(x=>'<div class="panel"><span class="muted">'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join('')+'</div></section>'+
 (summary.duplicates.length?'<section class="card"><p class="eyebrow">VERSÕES</p><h2>Arquivos versionados</h2><div class="pending">'+summary.duplicates.slice(0,12).map(x=>'<div><strong>'+x.key+'</strong><span>'+x.count+' versões</span><span class="ok">última v'+String(x.latest.version).padStart(2,'0')+'</span></div>').join('')+'</div></section>':'')+
 (summary.unrecognized.length?'<section class="card"><p class="eyebrow">NÃO RECONHECIDOS</p><h2>Fora do padrão</h2><div class="pending">'+summary.unrecognized.slice(0,12).map(x=>'<div><span>'+esc(x.name)+'</span><small class="muted">'+esc(x.path)+'</small></div>').join('')+'</div></section>':'')+
 '<section class="card span2"><p class="eyebrow">PADRÃO DE ARQUIVOS</p><h2>Nomenclatura esperada</h2><div class="folders"><div>01_PERSONAGENS/<strong>ABRAHAM_01_FRONT.png</strong></div><div>02_CENARIOS/<strong>CAMP_OASIS_01_BASE.png</strong></div><div>03_IMAGENS_CENAS/<strong>C001_IMG_v01.png</strong></div><div>04_ANIMACOES/<strong>C001_ANIM_v01.mp4</strong></div><div>07_CENAS_FINAIS/<strong>C001_FINAL_v01.mp4</strong></div></div></section></div>'
}
function audit(){const p=project(),summary=fileSummary(p),mi=p.scenes.filter(s=>s.image!=='done').length,ma=p.scenes.filter(s=>s.animation!=='done').length,long=p.scenes.filter(s=>sceneDuration(s)>10),pending=p.scenes.filter(s=>s.image!=='done'||s.animation!=='done'||!s.approved),missingChars=p.characters.filter(id=>!summary.characters[id]),missingScenarios=p.locations.filter(id=>!summary.scenarios[id]),missingSpeakers=p.scenes.filter(s=>s.type==='Diálogo'&&String(s.dialogue||'').trim()&&!String(s.speaker||'').trim());return '<div class="grid"><section class="card span2"><p class="eyebrow">AUDITORIA</p><h2>Verificação do projeto</h2><div class="audit"><div class="panel"><span class="muted">Cenas</span><strong>'+p.scenes.length+'</strong></div><div class="panel"><span class="muted">Imagens faltando</span><strong>'+mi+'</strong></div><div class="panel"><span class="muted">Animações faltando</span><strong>'+ma+'</strong></div><div class="panel"><span class="muted">Fora do padrão</span><strong>'+summary.unrecognized.length+'</strong></div></div></section>'+(pending.length?'<section class="card span2"><p class="eyebrow">PENDÊNCIAS</p><h2>Próximas lacunas</h2><div class="pending">'+pending.slice(0,20).map(s=>'<div><strong>'+s.id+'</strong><span>'+esc(s.title)+'</span><span class="warn">'+(s.image!=='done'?'imagem':s.animation!=='done'?'animação':'aprovação')+'</span></div>').join('')+'</div></section>':'')+(missingSpeakers.length?'<section class="card span2"><p class="eyebrow">FALANTES</p><h2>Diálogos sem personagem falante</h2><div class="pending">'+missingSpeakers.slice(0,20).map(s=>'<div><strong>'+s.id+'</strong><span>'+esc(s.dialogue||s.title)+'</span><span class="warn">definir falante</span></div>').join('')+'</div></section>':'')+(long.length?'<section class="card"><p class="eyebrow">DURAÇÃO</p><h2>Cenas acima de 10 s</h2><div class="pending">'+long.map(s=>'<div><strong>'+s.id+'</strong><span>'+esc(s.title)+'</span><span class="warn">'+sceneDuration(s).toFixed(1)+' s</span></div>').join('')+'</div></section>':'')+(summary.duplicates.length?'<section class="card"><p class="eyebrow">VERSÕES</p><h2>Múltiplas versões</h2><div class="pending">'+summary.duplicates.slice(0,20).map(x=>'<div><strong>'+x.key+'</strong><span>'+x.count+' arquivos</span><span class="ok">v'+String(x.latest.version).padStart(2,'0')+'</span></div>').join('')+'</div></section>':'')+'</div>'}
function settings(){const p=project(),modes=['Google Drive Online','Google Drive no computador','Controle manual'],ts=state.tools||defaultTools;return '<div class="grid"><section class="card span2"><p class="eyebrow">ARMAZENAMENTO</p><h2>Modo do projeto</h2><div class="modes">'+modes.map(m=>'<button class="mode '+(p.storage===m?'selected':'')+'" onclick="setStorage(\''+m+'\')"><strong>'+m+'</strong></button>').join('')+'</div></section>'+(p.storage==='Google Drive no computador'?localFolderControls(p):p.storage==='Google Drive Online'?onlineDriveControls(p):'')+((p.storage==='Google Drive no computador'||p.storage==='Google Drive Online')?autoSyncControls(p):'')+'<section class="card span2"><p class="eyebrow">FERRAMENTAS</p><h2>Geradores cadastrados</h2><div class="settings-list">'+ts.map((t,i)=>'<div><div class="meta"><strong>'+t.name+'</strong><small class="muted">'+(t.category==='image'?'Imagem':'Animação')+(t.preferred?' • preferida':'')+'</small></div><div class="chips">'+(t.max?'<span class="chip">'+t.max+'s</span>':'')+(t.dialogue?'<span class="chip">fala</span>':'')+(t.ambience?'<span class="chip">ambiente</span>':'')+'</div><button class="btn" onclick="setPreferred('+i+')">'+(t.preferred?'★':'☆')+'</button><a href="'+t.url+'" target="_blank">Abrir ↗</a></div>').join('')+'</div></section></div>'}
function setPreferred(i){const ts=state.tools||defaultTools,cat=ts[i].category;ts.forEach((t,j)=>{if(t.category===cat)t.preferred=j===i});state.tools=ts;save();render()}
function render(){const p=project();nav();document.getElementById('pageTitle').textContent=state.page;document.getElementById('storagePill').textContent=p?.storage||'—';const mini=document.querySelector('.project-mini');if(mini)mini.innerHTML='<span>Projeto ativo</span><strong>'+esc(p?.name||'Nenhum')+'</strong><small>Sprint 2.1 • MVP 1.2</small>';const views={'Próxima ação':nextView,'Projetos':projectsView,'Importação':importView,'Produção':production,'Personagens':()=>assetsView('Personagens'),'Cenários':()=>assetsView('Cenários'),'Cenas':scenesView,'Mapa de arquivos':filemap,'Auditoria':audit,'Configurações':settings};document.getElementById('content').innerHTML=views[state.page]();configureAutoSync();if(state.page==='Cenas')hydrateSceneThumbs()}
render();