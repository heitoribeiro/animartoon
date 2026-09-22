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
let analysisVideoFile=null;
let analysisObjectUrl=null;
let analysisAbort=false;
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
function imagePrompt(s){return 'Create a consistent stylized 3D animated keyframe for scene '+s.id+': '+s.title+'. Characters: '+(s.characters.join(', ')||'none')+'. Location: '+(s.location||'unspecified')+'. Preserve character identity, costume, proportions, biblical-era continuity, cinematic family-animation lighting and composition. '+(s.dialogue?'This scene will later include dialogue: "'+s.dialogue+'".':'No spoken dialogue is required in the image.')}
function animationPrompt(s){const d=sceneDuration(s).toFixed(1);return 'Create a '+d+'-second animation from the supplied image for scene '+s.id+': '+s.title+'. '+(s.type==='Diálogo'?'Include natural synchronized spoken dialogue'+(s.dialogue?' exactly as follows: "'+s.dialogue+'".':' based on the supplied scene audio/script.')+' Add natural facial acting, lip synchronization and subtle scene ambience.':'Do not add spoken dialogue. Animate character/environment movement and scene ambience naturally.')+' Preserve the exact characters, costume, setting and visual continuity. Camera movement should remain coherent with the source scene.'}
function markNext(){const p=project(),s=nextScene(p);if(!s)return;if(s.image!=='done'){s.image='done';s.imageVersion=(s.imageVersion||0)+1}else if(s.animation!=='done'){s.animation='done';s.animationVersion=(s.animationVersion||0)+1}else s.approved=true;save();render()}
function setStorage(m){project().storage=m;save();configureAutoSync();render()}
function selectProject(id){state.activeProjectId=id;state.page='Próxima ação';save();render()}
function deleteProject(id){if(state.projects.length===1)return toast('Mantenha ao menos um projeto');state.projects=state.projects.filter(p=>p.id!==id);if(state.activeProjectId===id)state.activeProjectId=state.projects[0].id;save();render()}
function projectCard(p){return '<article class="card project-card '+(p.id===state.activeProjectId?'selected':'')+'"><div class="top"><div><p class="eyebrow">'+p.kind.toUpperCase()+'</p><h2>'+esc(p.name)+'</h2></div><span class="percent">'+progress(p)+'%</span></div><p class="muted">'+(p.sourceType==='youtube'?'YouTube':p.sourceType==='upload'?'Arquivo local':'Projeto')+(p.duration?' • '+fmt(p.duration):'')+'</p><div class="progress"><div style="width:'+progress(p)+'%"></div></div><div class="actions"><button class="btn primary" onclick="selectProject(\''+p.id+'\')">Abrir</button><button class="btn" onclick="deleteProject(\''+p.id+'\')">Excluir</button></div></article>'}
function projectsView(){return '<div class="grid"><section class="card span2"><div class="section-title"><div><p class="eyebrow">NOVO PROJETO</p><h2>Criar projeto</h2></div></div><form class="form-grid" onsubmit="createProject(event)"><label>Nome<input id="newName" required placeholder="Nome do projeto"></label><label>Origem<select id="newKind"><option value="adaptacao">Adaptar vídeo existente</option><option value="original" disabled>Projeto original — futuro</option><option value="inspirado" disabled>Inspirado em referência — futuro</option></select></label><label>Fonte<select id="newSource"><option value="youtube">YouTube</option><option value="upload">Arquivo local</option></select></label><label>URL do YouTube<input id="newUrl" placeholder="https://youtu.be/..."></label><div class="form-actions"><button class="btn primary" type="submit">Criar projeto</button></div></form></section>'+state.projects.map(projectCard).join('')+'</div>'}
function createProject(e){e.preventDefault();const name=document.getElementById('newName').value.trim(),sourceType=document.getElementById('newSource').value,url=document.getElementById('newUrl').value.trim(),id=slug(name)+'-'+Date.now().toString(36);const p={id,name,kind:'adaptacao',sourceType,sourceUrl:url,sourceName:'',duration:0,storage:'Controle manual',characters:[],locations:[],scenes:[]};state.projects.push(p);state.activeProjectId=id;state.page='Importação';save();render()}
function importView(){
 const p=project(),candidate=p.analysisCandidateScenes||[],stats=p.analysisStats||null;
 const sourceBlock=p.sourceType==='youtube'
 ? '<label class="field">URL<input id="sourceUrl" value="'+esc(p.sourceUrl||'')+'" placeholder="https://youtu.be/..."></label><div class="actions"><button class="btn primary" onclick="saveSourceUrl()">Salvar URL</button><a class="btn linkbtn" href="'+esc(p.sourceUrl||'#')+'" target="_blank">Abrir vídeo ↗</a></div><p class="muted note">O YouTube continua como referência do projeto. Para decupagem automática, selecione abaixo uma cópia local do vídeo; ela é analisada somente no navegador.</p>'
 : '<div class="drop"><input id="videoFile" type="file" accept="video/*" onchange="readLocalVideo(event)"><strong>Selecionar vídeo local como fonte</strong><small>A duração é lida no navegador. O arquivo não é enviado.</small></div>';
 return '<div class="grid"><section class="card span2"><p class="eyebrow">FONTE</p><h2>Importação do projeto</h2><div class="sourcebox"><div><span class="label">Tipo</span><strong>'+(p.sourceType==='youtube'?'YouTube':'Arquivo local')+'</strong></div><div><span class="label">Duração</span><strong>'+(p.duration?fmt(p.duration):'Ainda não informada')+'</strong></div></div>'+sourceBlock+'</section>'+
 '<section class="card span2"><div class="section-title"><div><p class="eyebrow">DECUPAGEM AUTOMÁTICA — EXPERIMENTAL</p><h2>Analisar cortes visuais no navegador</h2></div><span class="badge">'+(p.analysisFileName?esc(p.analysisFileName):'sem arquivo')+'</span></div><p class="muted">A análise compara quadros reduzidos para localizar mudanças visuais. O vídeo permanece no seu computador. O resultado é preliminar e deve ser revisado antes da produção.</p><div class="drop"><input id="analysisFile" type="file" accept="video/*" onchange="attachAnalysisVideo(event)"><strong>Selecionar arquivo para análise</strong><small>'+(analysisVideoFile?esc(analysisVideoFile.name):'Selecione a cópia local do vídeo de referência')+'</small></div><div class="analysis-controls"><label>Precisão<select id="analysisStep"><option value="2">Rápida — 2 s</option><option value="1" selected>Equilibrada — 1 s</option><option value="0.5">Precisa — 0,5 s</option></select></label><label>Sensibilidade<select id="analysisThreshold"><option value="0.30">Baixa</option><option value="0.22" selected>Média</option><option value="0.16">Alta</option></select></label><label class="checkline"><input id="splitLongScenes" type="checkbox" checked> Dividir cenas acima do limite do gerador</label></div><div class="analysis-progress"><div class="mini"><div id="analysisProgressBar" style="width:0%"></div></div><span id="analysisProgressText" class="muted">Pronto para analisar</span></div><div class="actions"><button class="btn primary" onclick="analyzeSelectedVideo()">Detectar cenas</button><button class="btn" onclick="cancelVideoAnalysis()">Cancelar</button></div></section>'+
 (candidate.length?'<section class="card span2"><div class="section-title"><div><p class="eyebrow">RESULTADO PRELIMINAR</p><h2>'+candidate.length+' segmentos detectados</h2></div><button class="btn primary" onclick="applyDetectedScenes()">Aplicar à decupagem</button></div>'+(stats?'<div class="audit compact-audit"><div class="panel"><span class="muted">Amostragem</span><strong>'+stats.step+' s</strong></div><div class="panel"><span class="muted">Sensibilidade</span><strong>'+stats.thresholdLabel+'</strong></div><div class="panel"><span class="muted">Cortes visuais</span><strong>'+stats.visualCuts+'</strong></div><div class="panel"><span class="muted">Subcenas técnicas</span><strong>'+stats.technicalSplits+'</strong></div></div>':'')+'<div class="detected-list">'+candidate.slice(0,20).map(s=>'<div><strong>'+s.id+'</strong><span>'+fmt(s.start)+' → '+fmt(s.end)+'</span><span>'+sceneDuration(s).toFixed(1)+' s</span></div>').join('')+(candidate.length>20?'<p class="muted note">Mostrando as 20 primeiras. A lista completa será aplicada em Cenas.</p>':'')+'</div></section>':'')+
 '<section class="card"><p class="eyebrow">DECUPAGEM</p><h2>Cenas</h2><strong class="big">'+p.scenes.length+'</strong><p class="muted">cenas cadastradas</p><button class="btn" onclick="setPage(\'Cenas\')">Revisar cenas</button></section><section class="card"><p class="eyebrow">IMPORTAR DADOS</p><h2>JSON de cenas</h2><textarea id="jsonScenes" rows="7" placeholder=\'[{"start":0,"end":8.2,"title":"Cena inicial","type":"Diálogo"}]\'></textarea><button class="btn" onclick="importScenesJson()">Importar cenas</button></section></div>'
}
function saveSourceUrl(){project().sourceUrl=document.getElementById('sourceUrl').value.trim();save();toast('Fonte salva')}
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
 v.onloadedmetadata=()=>{const p=project();p.analysisFileName=f.name;p.analysisDuration=v.duration;if(!p.duration)p.duration=v.duration;save();render();toast('Vídeo pronto para análise')};
 v.src=analysisObjectUrl
}
function cancelVideoAnalysis(){analysisAbort=true;const t=document.getElementById('analysisProgressText');if(t)t.textContent='Cancelamento solicitado...'}
function waitSeek(video,time){return new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve()},fail=()=>{cleanup();reject(video.error||new Error('seek'))},cleanup=()=>{video.removeEventListener('seeked',done);video.removeEventListener('error',fail)};video.addEventListener('seeked',done,{once:true});video.addEventListener('error',fail,{once:true});video.currentTime=Math.min(Math.max(0,time),Math.max(0,video.duration-0.02));if(Math.abs(video.currentTime-time)<0.02&&!video.seeking){cleanup();resolve()}})}
function frameVector(video,canvas,ctx){
 ctx.drawImage(video,0,0,canvas.width,canvas.height);
 const d=ctx.getImageData(0,0,canvas.width,canvas.height).data,out=new Uint8Array(canvas.width*canvas.height*3);
 for(let i=0,j=0;i<d.length;i+=4){out[j++]=d[i];out[j++]=d[i+1];out[j++]=d[i+2]}
 return out
}
function frameDifference(a,b){if(!a||!b||a.length!==b.length)return 0;let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/(a.length*255)}
function generatorLimit(){const ts=(state.tools||defaultTools).filter(t=>t.category==='animation'&&t.max);const pref=ts.find(t=>t.preferred);return Number((pref||ts[0]||{max:10}).max||10)}
function buildDetectedScenes(cuts,duration,splitLong){
 const max=generatorLimit(),result=[];let visual=0,technical=0;
 for(let i=0;i<cuts.length;i++){
  const start=cuts[i],end=i+1<cuts.length?cuts[i+1]:duration;
  if(end-start<0.35)continue;
  visual++;
  const count=splitLong?Math.ceil((end-start)/max):1;
  for(let part=0;part<count;part++){
   const a=start+(end-start)*part/count,b=start+(end-start)*(part+1)/count,base='C'+String(visual).padStart(3,'0'),suffix=count>1?String.fromCharCode(65+part):'';
   if(count>1)technical++;
   result.push({id:base+suffix,start:Number(a.toFixed(3)),end:Number(b.toFixed(3)),title:'Cena detectada '+String(visual).padStart(3,'0')+(count>1?' • parte '+suffix:''),type:'A revisar',characters:[],location:'',dialogue:'',image:'pending',animation:'pending',approved:false,detected:true,sourceGroup:base})
  }
 }
 return {scenes:result,visualCuts:Math.max(0,visual-1),technicalSplits:technical}
}
async function analyzeSelectedVideo(){
 if(!analysisVideoFile||!analysisObjectUrl)return toast('Selecione primeiro um arquivo local');
 const step=Number(document.getElementById('analysisStep')?.value||1),threshold=Number(document.getElementById('analysisThreshold')?.value||0.22),splitLong=!!document.getElementById('splitLongScenes')?.checked;
 const labels={0.30:'Baixa',0.22:'Média',0.16:'Alta'},video=document.createElement('video'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 canvas.width=48;canvas.height=27;video.muted=true;video.preload='auto';video.src=analysisObjectUrl;analysisAbort=false;
 await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject});
 const duration=video.duration,total=Math.ceil(duration/step),cuts=[0];let prev=null,lastCut=0;
 try{
  for(let i=0,t=0;t<duration;t+=step,i++){
   if(analysisAbort){toast('Análise cancelada');return}
   await waitSeek(video,t);
   const vec=frameVector(video,canvas,ctx),diff=frameDifference(prev,vec);
   if(prev&&diff>=threshold&&t-lastCut>=Math.max(0.8,step*0.8)){cuts.push(Number(t.toFixed(3)));lastCut=t}
   prev=vec;
   if(i%5===0){const pct=Math.min(100,Math.round((i+1)/total*100)),bar=document.getElementById('analysisProgressBar'),txt=document.getElementById('analysisProgressText');if(bar)bar.style.width=pct+'%';if(txt)txt.textContent='Analisando '+pct+'% • '+fmt(t)+' / '+fmt(duration);await new Promise(r=>setTimeout(r,0))}
  }
  const built=buildDetectedScenes(cuts,duration,splitLong),p=project();
  p.analysisCandidateScenes=built.scenes;p.analysisStats={step,threshold,thresholdLabel:labels[threshold]||String(threshold),visualCuts:built.visualCuts,technicalSplits:built.technicalSplits,analyzedAt:Date.now()};save();render();toast(built.scenes.length+' segmentos detectados')
 }catch(e){console.error(e);toast('Falha durante a análise do vídeo')}
}
function applyDetectedScenes(){
 const p=project(),candidate=p.analysisCandidateScenes||[];
 if(!candidate.length)return toast('Nenhuma análise disponível');
 if(p.scenes.length&&!confirm('Substituir a decupagem atual pelas cenas detectadas?'))return;
 p.scenes=candidate.map(s=>({...s}));delete p.analysisCandidateScenes;save();state.page='Cenas';render();toast('Decupagem automática aplicada')
}
function importScenesJson(){try{const arr=JSON.parse(document.getElementById('jsonScenes').value);if(!Array.isArray(arr))throw 0;const p=project(),base=p.scenes.length;p.scenes.push(...arr.map((x,i)=>({id:x.id||'C'+String(base+i+1).padStart(3,'0'),start:Number(x.start||0),end:Number(x.end||0),title:x.title||'Cena '+(base+i+1),type:x.type||'Ambiente/Narração',characters:x.characters||[],location:x.location||'',dialogue:x.dialogue||'',image:'pending',animation:'pending',approved:false})));save();render();toast('Cenas importadas')}catch{toast('JSON inválido')}}
function nextView(){const p=project(),s=nextScene(p);if(!s)return '<section class="card empty"><h2>Nenhuma cena cadastrada</h2><p class="muted">Importe ou crie a primeira cena para iniciar a produção.</p><button class="btn primary" onclick="setPage(\'Cenas\')">Ir para Cenas</button></section>';const image=s.image!=='done',kind=image?'Gerar imagem':s.animation!=='done'?'Gerar animação':'Aprovar cena',file=image?expectedFile(s,'image'):expectedFile(s,'animation'),prompt=image?imagePrompt(s):animationPrompt(s),tt=(state.tools||defaultTools).filter(t=>t.category===(image?'image':'animation')),dur=sceneDuration(s),max=Math.min(...tt.map(t=>t.max||999));
return '<div class="grid"><section class="card span2"><div class="top"><div><p class="eyebrow">PROJETO ATIVO</p><h2>'+esc(p.name)+'</h2></div><div class="percent">'+progress(p)+'%</div></div><div class="progress"><div style="width:'+progress(p)+'%"></div></div></section><section class="card span2"><div class="section-title"><div><p class="eyebrow">PRÓXIMA AÇÃO</p><h2>'+s.id+' — '+kind+'</h2><p class="muted">'+esc(s.title)+'</p></div><span class="badge accent">'+s.type+'</span></div><div class="scene-meta"><div><small>Intervalo</small><strong>'+fmt(s.start)+' → '+fmt(s.end)+'</strong></div><div><small>Duração</small><strong>'+dur.toFixed(1)+' s</strong></div><div><small>Personagens</small><strong>'+esc(s.characters.join(', ')||'—')+'</strong></div><div><small>Cenário</small><strong>'+esc(s.location||'—')+'</strong></div></div>'+(dur>max?'<div class="warning">Esta cena tem '+dur.toFixed(1)+' s. O perfil atual dos geradores indica até '+max+' s; considere dividir em duas partes.</div>':'')+'<div class="two"><div><span class="label">Nome sugerido</span><div class="panel copybox"><code>'+file+'</code><button class="btn" onclick="copy(\''+file+'\')">Copiar</button></div></div><div><span class="label">Prompt</span><div class="panel"><p class="prompt">'+esc(prompt)+'</p><button class="btn" onclick="copy('+JSON.stringify(prompt)+')">Copiar prompt</button></div></div></div><div class="tools">'+tt.map(t=>'<a class="'+(t.preferred?'preferred':'')+'" href="'+t.url+'" target="_blank">↗ '+t.name+(t.preferred?' • preferida':'')+'</a>').join('')+'</div><button class="btn primary" onclick="markNext()">✓ Marcar etapa como concluída</button></section></div>'}
function production(){const p=project();return '<section class="card"><div class="section-title"><div><p class="eyebrow">PIPELINE</p><h2>Produção por cena</h2></div><span class="badge">'+p.scenes.length+' cenas</span></div><div class="table">'+p.scenes.map(s=>'<div class="row"><strong>'+s.id+'</strong><span>'+esc(s.title)+'<small>'+sceneDuration(s).toFixed(1)+' s</small></span><button class="statusbtn '+(s.image==='done'?'ok':'warn')+'" onclick="toggleStatus(\''+s.id+'\',\'image\')">'+(s.image==='done'?'✓':'○')+' Imagem</button><button class="statusbtn '+(s.animation==='done'?'ok':'warn')+'" onclick="toggleStatus(\''+s.id+'\',\'animation\')">'+(s.animation==='done'?'✓':'○')+' Animação</button><button class="statusbtn '+(s.approved?'ok':'warn')+'" onclick="toggleStatus(\''+s.id+'\',\'approved\')">'+(s.approved?'✓':'○')+' Final</button></div>').join('')+'</div></section>'}
function toggleStatus(id,key){const s=project().scenes.find(x=>x.id===id);if(!s)return;if(key==='approved')s.approved=!s.approved;else s[key]=s[key]==='done'?'pending':'done';save();render()}
function scenesView(){const p=project();return '<div class="grid"><section class="card span2"><div class="section-title"><div><p class="eyebrow">CENAS</p><h2>Decupagem</h2></div><button class="btn primary" onclick="addScene()">+ Nova cena</button></div><div class="table scene-table">'+p.scenes.map((s,i)=>'<div class="scene-edit"><div><strong>'+s.id+'</strong><small>'+fmt(s.start)+' → '+fmt(s.end)+' • '+sceneDuration(s).toFixed(1)+' s</small></div><input value="'+esc(s.title)+'" onchange="editScene('+i+',\'title\',this.value)"><select onchange="editScene('+i+',\'type\',this.value)"><option '+(s.type==='A revisar'?'selected':'')+'>A revisar</option><option '+(s.type==='Diálogo'?'selected':'')+'>Diálogo</option><option '+(s.type==='Ambiente/Narração'?'selected':'')+'>Ambiente/Narração</option></select><input placeholder="Personagens: ID, ID" value="'+esc(s.characters.join(', '))+'" onchange="editScene('+i+',\'characters\',this.value)"><input placeholder="Cenário" value="'+esc(s.location)+'" onchange="editScene('+i+',\'location\',this.value)"><button class="btn" onclick="editTimes('+i+')">Tempo</button><button class="btn danger" onclick="removeScene('+i+')">×</button></div>').join('')+'</div></section></div>'}
function addScene(){const p=project(),last=p.scenes[p.scenes.length-1],n=p.scenes.length+1,start=last?Number(last.end):0;p.scenes.push({id:'C'+String(n).padStart(3,'0'),start,end:start+8,title:'Nova cena',type:'Ambiente/Narração',characters:[],location:'',dialogue:'',image:'pending',animation:'pending',approved:false});save();render()}
function editScene(i,key,val){const s=project().scenes[i];if(key==='characters')s.characters=val.split(',').map(x=>x.trim()).filter(Boolean);else s[key]=val;save()}
function editTimes(i){const s=project().scenes[i],a=prompt('Início em segundos',s.start),b=prompt('Fim em segundos',s.end);if(a!==null&&b!==null){s.start=Number(a);s.end=Number(b);save();render()}}
function removeScene(i){project().scenes.splice(i,1);save();render()}
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
async function connectDriveOnline(){
 const p=project();
 if(!p.driveClientId)return toast('Informe o OAuth Client ID do Google');
 if(!p.driveFolderId)return toast('Informe a pasta do Google Drive');
 try{
  await loadScript('https://accounts.google.com/gsi/client','google-gsi');
  driveTokenClient=google.accounts.oauth2.initTokenClient({
   client_id:p.driveClientId,
   scope:'https://www.googleapis.com/auth/drive.metadata.readonly',
   callback:(resp)=>{
    if(resp.error)return toast('Falha na autorização do Google Drive');
    driveToken=resp.access_token;
    p.driveConnectedAt=Date.now();
    save();render();toast('Google Drive conectado');
   }
  });
  driveTokenClient.requestAccessToken({prompt:'consent'});
 }catch(e){toast('Não foi possível carregar a autorização Google')}
}
function disconnectDriveOnline(){driveToken=null;project().driveConnectedAt=null;save();render();toast('Google Drive desconectado')}
async function driveListChildren(folderId,path='',out=[]){
 let pageToken='';
 do{
  const q=encodeURIComponent("'"+folderId+"' in parents and trashed=false");
  const fields=encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,size)');
  const url='https://www.googleapis.com/drive/v3/files?q='+q+'&fields='+fields+'&pageSize=1000'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
  const r=await fetch(url,{headers:{Authorization:'Bearer '+driveToken}});
  if(r.status===401){driveToken=null;throw new Error('TOKEN_EXPIRED')}
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
 const connected=!!driveToken;
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">GOOGLE DRIVE ONLINE</p><h2>'+(connected?'Conectado nesta sessão':'Configurar monitoramento')+'</h2></div><span class="badge '+(connected?'ok':'warn')+'">'+(connected?'conectado':'desconectado')+'</span></div><p class="muted">A integração usa OAuth no navegador e escopo somente de metadados. O Client ID é um identificador público do aplicativo Google, não uma chave secreta de IA.</p><div class="form-grid"><label>OAuth Client ID<input id="driveClientId" value="'+esc(p.driveClientId||'')+'" placeholder="...apps.googleusercontent.com"></label><label>Pasta do projeto no Drive<input id="driveFolderId" value="'+esc(p.driveFolderId||'')+'" placeholder="Cole o link da pasta ou o ID"></label></div><div class="actions"><button class="btn" onclick="saveDriveConfig()">Salvar configuração</button><button class="btn primary" onclick="connectDriveOnline()">Conectar Google Drive</button><button class="btn" onclick="syncDriveOnline()">↻ Sincronizar agora</button>'+(connected?'<button class="btn danger" onclick="disconnectDriveOnline()">Desconectar</button>':'')+'</div>'+(p.lastSync?'<p class="muted note">Última sincronização: '+new Date(p.lastSync).toLocaleString('pt-BR')+'</p>':'')+'</section>'
}
function autoSyncControls(p){
 const opts=[['manual','Manual'],['30s','30 segundos'],['1m','1 minuto'],['5m','5 minutos']];
 return '<section class="card span2"><div class="section-title"><div><p class="eyebrow">SINCRONIZAÇÃO AUTOMÁTICA</p><h2>Frequência</h2></div><span class="badge">'+(p.autoSync&&p.autoSync!=='manual'?'ativa':'manual')+'</span></div><div class="sync-options">'+opts.map(([v,l])=>'<button class="mode '+((p.autoSync||'manual')===v?'selected':'')+'" onclick="setAutoSync(\''+v+'\')"><strong>'+l+'</strong></button>').join('')+'</div><p class="muted note">A sincronização automática funciona enquanto a página estiver aberta. No modo local, a permissão da pasta precisa continuar válida; no Drive Online, a sessão OAuth precisa estar conectada.</p></section>'
}
const folderLayout=['00_REFERENCIAS','01_PERSONAGENS','02_CENARIOS','03_IMAGENS_CENAS','04_ANIMACOES','06_AUDIO','07_CENAS_FINAIS','08_EPISODIO_FINAL'];
const dbName='animartoon-fs',storeName='handles';
function openFsDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(storeName))req.result.createObjectStore(storeName)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
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
function audit(){const p=project(),summary=fileSummary(p),mi=p.scenes.filter(s=>s.image!=='done').length,ma=p.scenes.filter(s=>s.animation!=='done').length,long=p.scenes.filter(s=>sceneDuration(s)>10),pending=p.scenes.filter(s=>s.image!=='done'||s.animation!=='done'||!s.approved),missingChars=p.characters.filter(id=>!summary.characters[id]),missingScenarios=p.locations.filter(id=>!summary.scenarios[id]);return '<div class="grid"><section class="card span2"><p class="eyebrow">AUDITORIA</p><h2>Verificação do projeto</h2><div class="audit"><div class="panel"><span class="muted">Cenas</span><strong>'+p.scenes.length+'</strong></div><div class="panel"><span class="muted">Imagens faltando</span><strong>'+mi+'</strong></div><div class="panel"><span class="muted">Animações faltando</span><strong>'+ma+'</strong></div><div class="panel"><span class="muted">Fora do padrão</span><strong>'+summary.unrecognized.length+'</strong></div></div></section>'+(pending.length?'<section class="card span2"><p class="eyebrow">PENDÊNCIAS</p><h2>Próximas lacunas</h2><div class="pending">'+pending.slice(0,20).map(s=>'<div><strong>'+s.id+'</strong><span>'+esc(s.title)+'</span><span class="warn">'+(s.image!=='done'?'imagem':s.animation!=='done'?'animação':'aprovação')+'</span></div>').join('')+'</div></section>':'')+(long.length?'<section class="card"><p class="eyebrow">DURAÇÃO</p><h2>Cenas acima de 10 s</h2><div class="pending">'+long.map(s=>'<div><strong>'+s.id+'</strong><span>'+esc(s.title)+'</span><span class="warn">'+sceneDuration(s).toFixed(1)+' s</span></div>').join('')+'</div></section>':'')+(summary.duplicates.length?'<section class="card"><p class="eyebrow">VERSÕES</p><h2>Múltiplas versões</h2><div class="pending">'+summary.duplicates.slice(0,20).map(x=>'<div><strong>'+x.key+'</strong><span>'+x.count+' arquivos</span><span class="ok">v'+String(x.latest.version).padStart(2,'0')+'</span></div>').join('')+'</div></section>':'')+'</div>'}
function settings(){const p=project(),modes=['Google Drive Online','Google Drive no computador','Controle manual'],ts=state.tools||defaultTools;return '<div class="grid"><section class="card span2"><p class="eyebrow">ARMAZENAMENTO</p><h2>Modo do projeto</h2><div class="modes">'+modes.map(m=>'<button class="mode '+(p.storage===m?'selected':'')+'" onclick="setStorage(\''+m+'\')"><strong>'+m+'</strong></button>').join('')+'</div></section>'+(p.storage==='Google Drive no computador'?localFolderControls(p):p.storage==='Google Drive Online'?onlineDriveControls(p):'')+((p.storage==='Google Drive no computador'||p.storage==='Google Drive Online')?autoSyncControls(p):'')+'<section class="card span2"><p class="eyebrow">FERRAMENTAS</p><h2>Geradores cadastrados</h2><div class="settings-list">'+ts.map((t,i)=>'<div><div class="meta"><strong>'+t.name+'</strong><small class="muted">'+(t.category==='image'?'Imagem':'Animação')+(t.preferred?' • preferida':'')+'</small></div><div class="chips">'+(t.max?'<span class="chip">'+t.max+'s</span>':'')+(t.dialogue?'<span class="chip">fala</span>':'')+(t.ambience?'<span class="chip">ambiente</span>':'')+'</div><button class="btn" onclick="setPreferred('+i+')">'+(t.preferred?'★':'☆')+'</button><a href="'+t.url+'" target="_blank">Abrir ↗</a></div>').join('')+'</div></section></div>'}
function setPreferred(i){const ts=state.tools||defaultTools,cat=ts[i].category;ts.forEach((t,j)=>{if(t.category===cat)t.preferred=j===i});state.tools=ts;save();render()}
function render(){const p=project();nav();document.getElementById('pageTitle').textContent=state.page;document.getElementById('storagePill').textContent=p?.storage||'—';const mini=document.querySelector('.project-mini');if(mini)mini.innerHTML='<span>Projeto ativo</span><strong>'+esc(p?.name||'Nenhum')+'</strong><small>Sprint 1.5 • MVP 0.6</small>';const views={'Próxima ação':nextView,'Projetos':projectsView,'Importação':importView,'Produção':production,'Personagens':()=>assetsView('Personagens'),'Cenários':()=>assetsView('Cenários'),'Cenas':scenesView,'Mapa de arquivos':filemap,'Auditoria':audit,'Configurações':settings};document.getElementById('content').innerHTML=views[state.page]();configureAutoSync()}
render();