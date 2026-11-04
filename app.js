import { DEVICE_INFO,SKINS,PLACEHOLDER,safeImage,safeAudio,normalizeRadio,normalizeCatalog,normalizeAudius,parseEmbedUrl,formatTime,uniqueTracks,readStore } from "./logic.mjs";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const htmlSafe = (value) => String(value??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const audio = new Audio();
audio.preload="none"; audio.volume=.75;
const state = {
  device: DEVICE_INFO[readStore("sonora:device","ipod")] ? readStore("sonora:device","ipod"):"ipod",
  skin: SKINS[readStore("sonora:skin","pearl")] ? readStore("sonora:skin","pearl"):"pearl",
  view:"discover",tab:"audius",results:[],queue:[],current:null,currentIndex:-1,
  local:[],recent:readStore("sonora:recent",[]).filter(t=>t&&["radio","audius"].includes(t.kind)&&safeAudio(t.stream)).slice(0,25),
  favorites:readStore("sonora:favorites",[]).filter(t=>t&&["radio","audius","catalog"].includes(t.kind)&&((["radio","audius"].includes(t.kind)&&safeAudio(t.stream))||(t.kind==="catalog"&&t.link))).slice(0,100),
  query:"", loading:false,shuffle:false,repeat:"off",ipodMenu:false,menuIndex:0,limit:12
};
let searchToken=0, toastTimeout=null, pointerAngle=null, turnSum=0;
const persist = (key,value) => { try{localStorage.setItem("sonora:"+key,JSON.stringify(value));}catch{} };
function toast(message){
  const el=$("#toast");el.textContent=message;el.classList.add("visible");
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove("visible"),3600);
}
function setDevice(device){
  if(!DEVICE_INFO[device])return;
  state.device=device;document.body.dataset.device=device;persist("device",device);
  $("#deviceYear").textContent="EST. "+DEVICE_INFO[device].year;
  $("#deviceDescription").textContent=DEVICE_INFO[device].description;
  $("#showcaseCaption").textContent=DEVICE_INFO[device].name.toUpperCase()+" / PERSONAL EDITION";
  $$("[data-set-device]").forEach(el=>{el.classList.toggle("selected",el.dataset.setDevice===device);el.setAttribute("aria-pressed",String(el.dataset.setDevice===device));});
}
function setSkin(skin){
  if(!SKINS[skin])return;
  state.skin=skin;document.body.dataset.skin=skin;persist("skin",skin);
  $$(".swatch").forEach(el=>{el.classList.toggle("active",el.dataset.setSkin===skin);el.setAttribute("aria-pressed",String(el.dataset.setSkin===skin));});
  $("#skinLabel").textContent=SKINS[skin]+" / "+String(Object.keys(SKINS).indexOf(skin)+1).padStart(2,"0");
}
function getVisibleTracks(){
  if(state.view==="library")return uniqueTracks([...state.local,...state.recent]);
  if(state.view==="favorites")return state.favorites;
  if(state.view==="queue")return state.queue;
  if(state.tab==="files")return state.local;
  if(state.tab==="embeds")return [];
  return state.results;
}
function setView(view){
  if(!["discover","library","favorites","queue"].includes(view))return;
  state.view=view;$("#breadcrumbView").textContent=view.toUpperCase();
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("#discoverControls").hidden=view!=="discover";
  const titles={discover:"A world of music awaits",library:"Your personal collection",favorites:"The ones you love",queue:"Your listening queue"};
  $("#browseTitle").textContent=titles[view];const dot=document.createElement("span");dot.className="accent-dot";dot.textContent=".";$("#browseTitle").append(dot);
  renderResults();
  if(view!=="discover")$("#browseSection").scrollIntoView({behavior:"smooth",block:"start"});
}
function setTab(tab){
  if(!["audius","radio","catalog","files","embeds"].includes(tab))return;
  state.tab=tab;state.view="discover";
  $$(".source-tab").forEach(b=>{const selected=b.dataset.tab===tab;b.classList.toggle("active",selected);b.setAttribute("aria-selected",String(selected));});
  $("#searchControls").hidden=tab==="files"||tab==="embeds";
  $("#trendingSearch").hidden=tab!=="audius"&&tab!=="radio"&&tab!=="catalog";
  $("#filesPanel").hidden=tab!=="files";$("#embedsPanel").hidden=tab!=="embeds";
  $("#musicSearch").placeholder=tab==="catalog"?"Search artists, songs, albums...":tab==="audius"?"Search full songs, artists, genres...":"Search stations, genres, moods...";
  const suggestions={
    audius:'<span>TRY:</span><button type="button" data-quick-search="lofi">lofi beats</button><button type="button" data-quick-search="indie">indie artists</button><button type="button" data-quick-search="electronic">electronic</button><button type="button" data-quick-search="chill">chill</button>',
    radio:'<span>TRY:</span><button type="button" data-quick-search="lofi">lofi beats</button><button type="button" data-quick-search="jazz">late night jazz</button><button type="button" data-quick-search="80s">80s classics</button><button type="button" data-quick-search="bollywood">bollywood</button>',
    catalog:'<span>TRY:</span><button type="button" data-quick-search="A R Rahman">A R Rahman</button><button type="button" data-quick-search="Daft Punk">Daft Punk</button><button type="button" data-quick-search="The Weeknd">The Weeknd</button>'
  };
  $("#trendingSearch").innerHTML=suggestions[tab]||"";
  state.results=[];state.limit=12;
  setView("discover");
  if(tab==="audius") searchMusic($("#musicSearch").value.trim()||"lofi");
  if(tab==="radio") searchMusic($("#musicSearch").value.trim()||"lofi");
  if(tab==="catalog") searchMusic($("#musicSearch").value.trim()||"A R Rahman");
  if(tab==="files"||tab==="embeds")renderResults();
}
async function fetchApi(url,fallback){
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if(!r.ok)throw Error("Service returned "+r.status);
    return await r.json();
  }catch(firstError){
    if(!fallback)throw firstError;
    try{
      const r=await fetch(fallback,{signal:controller.signal,headers:{Accept:"application/json"}});
      if(!r.ok)throw Error("Source temporarily unavailable");
      return await r.json();
    }catch{throw firstError;}
  }finally{clearTimeout(timer);}
}
async function searchMusic(term){
  if(!term)return;
  const source=state.tab;
  if(!["radio","catalog","audius"].includes(source))return;
  const token=++searchToken;
  state.query=term;state.loading=true;state.results=[];state.limit=12;
  $("#musicSearch").value=term;renderResults();
  try{
    const q=encodeURIComponent(term.slice(0,80));
    let data;
    if(source==="radio"){
      data=await fetchApi("/api/radio?q="+q,"https://de1.api.radio-browser.info/json/stations/search?name="+q+"&hidebroken=true&order=votes&reverse=true&limit=40");
      if(token!==searchToken)return;
      state.results=uniqueTracks((Array.isArray(data)?data:[]).map(normalizeRadio).filter(Boolean)).slice(0,35);
    }else if(source==="catalog"){
      data=await fetchApi("/api/catalog?q="+q,"https://itunes.apple.com/search?term="+q+"&country=IN&media=music&entity=song&limit=32");
      if(token!==searchToken)return;
      state.results=uniqueTracks((Array.isArray(data)?data:(data.results||[])).map(normalizeCatalog).filter(Boolean)).slice(0,35);
    }else if(source==="audius"){
      data=await fetchApi("/api/audius?q="+q,"https://api.audius.co/v1/tracks/search?query="+q+"&app_name=SonoraVintagePlayer&limit=35");
      if(token!==searchToken)return;
      state.results=uniqueTracks((Array.isArray(data)?data:(data.data||[])).map(normalizeAudius).filter(Boolean)).slice(0,35);
    }
  }catch(error){
    if(token!==searchToken)return;
    toast("Search is temporarily unavailable. Try again in a moment.");
    state.results=[];
  }finally{
    if(token===searchToken){state.loading=false;renderResults();}
  }
}
function displayStatus(){
  const current=state.current;
  const playing=!audio.paused && Boolean(current);
  document.body.classList.toggle("is-playing",playing);
  $("#mainPlay").textContent=playing?"Ⅱ":"▶";
  $("#mainPlay").setAttribute("aria-label",playing?"Pause":"Play");
  $("#screenState").textContent=playing?"▶":"♫";
  $$('[data-action="toggle"]').forEach(b=>b.setAttribute("aria-label",playing?"Pause":"Play"));
  if(!current)return;
  $$(".track-title-sync").forEach(el=>el.textContent=current.title);
  $$(".track-artist-sync").forEach(el=>el.textContent=current.artist);
  $("#nowTitle").textContent=current.title;
  $("#nowArtist").textContent=current.artist;
  $("#nowSource").textContent=current.source||"YOUR MUSIC";
  $("#nowArtwork").src=safeImage(current.artwork);
  $("#ipodArt").src=safeImage(current.artwork);
  const favorited=state.favorites.some(t=>t.id===current.id);
  $("#nowFavorite").classList.toggle("active",favorited);
  $("#nowFavorite").textContent=favorited?"♥":"♡";
  $("#nowFavorite").setAttribute("aria-label",favorited?"Remove from favorites":"Add to favorites");
  $("#discmanCounter").textContent=current.live?"LIVE":formatTime(audio.currentTime);
  if("mediaSession" in navigator){
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:current.title,artist:current.artist,album:current.live?"Live Radio":"Your Music",
        artwork:current.artwork&&current.artwork!==PLACEHOLDER?[{src:current.artwork,sizes:"300x300"}]:[]
      });
      navigator.mediaSession.playbackState=playing?"playing":"paused";
    }catch{}
  }
}
function updateTime(){
  const live=state.current?.live;
  const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
  const elapsed=Number.isFinite(audio.currentTime)?audio.currentTime:0;
  $$(".time-current").forEach(el=>el.textContent=live?"LIVE":formatTime(elapsed));
  $$(".time-duration").forEach(el=>el.textContent=live?"◉":formatTime(duration));
  $("#seekbar").disabled=!!live||!duration;
  const percent=duration?Math.min(100,100*elapsed/duration):0;
  $("#seekbar").value=String(percent);$("#screenProgress").style.width=percent+"%";
  $("#discmanCounter").textContent=live?"LIVE":formatTime(elapsed);
}
function saveRecent(track){
  if(!["radio","audius"].includes(track.kind))return;
  state.recent=[track,...state.recent.filter(t=>t.id!==track.id)].slice(0,25);
  persist("recent",state.recent);
}
function setQueueItem(track,{play=true}={}){
  if(!track||!["radio","audius","file"].includes(track.kind))return;
  let index=state.queue.findIndex(t=>t.id===track.id);
  if(index<0){state.queue.push(track);index=state.queue.length-1;}
  updateCounts();renderQueuePreview();
  if(play)playAt(index);
  else toast("Added to your queue");
}
async function playAt(index){
  const track=state.queue[index];if(!track)return;
  if(!["file","radio","audius"].includes(track.kind))return;
  const src=safeAudio(track.stream);if(!src){toast("This audio stream is not supported.");return;}
  state.current=track;state.currentIndex=index;
  audio.pause();audio.src=src;audio.load();
  saveRecent(track);displayStatus();updateTime();renderQueuePreview();renderResults();renderIpodMenu();
  try{await audio.play();displayStatus();}
  catch{displayStatus();toast("Could not start this stream. Try another station or audio file.");}
}
async function toggle(){
  if(!state.current){
    if(!state.queue.length){toast("Pick a full song, radio station or local file first.");return;}
    await playAt(0);return;
  }
  if(audio.paused){try{await audio.play();}catch{toast("This stream cannot be played in your browser.");}}
  else audio.pause();
  displayStatus();
}
function nextTrack(direction=1,fromEnded=false){
  if(!state.queue.length){toast("Your queue is empty.");return;}
  if(state.repeat==="one"&&fromEnded){audio.currentTime=0;audio.play().catch(()=>{});return;}
  let index=state.currentIndex;
  if(state.shuffle&&state.queue.length>1&&direction>0){
    const indices=state.queue.map((_,i)=>i).filter(i=>i!==index);
    index=indices[Math.floor(Math.random()*indices.length)];
  }else{index+=direction;}
  if(index>=state.queue.length){
    if(state.repeat==="all")index=0;
    else{audio.pause();audio.currentTime=0;displayStatus();return;}
  }
  if(index<0)index=state.repeat==="all"?state.queue.length-1:0;
  playAt(index);
}
function removeQueue(index){
  if(index<0||index>=state.queue.length)return;
  const wasCurrent=index===state.currentIndex;
  state.queue.splice(index,1);
  if(wasCurrent){audio.pause();audio.removeAttribute("src");audio.load();state.current=null;state.currentIndex=-1;resetNow();}
  else if(index<state.currentIndex)state.currentIndex--;
  updateCounts();renderQueuePreview();renderResults();renderIpodMenu();
}
function clearQueue(){
  audio.pause();audio.removeAttribute("src");audio.load();state.queue=[];state.current=null;state.currentIndex=-1;resetNow();updateCounts();renderQueuePreview();renderResults();renderIpodMenu();toast("Queue cleared.");
}
function resetNow(){
  document.body.classList.remove("is-playing");
  $("#nowTitle").textContent="Press play on a memory.";
  $("#nowArtist").textContent="Find a radio station or add music from your computer.";
  $("#nowSource").textContent="READY WHEN YOU ARE";
  $("#nowArtwork").src=PLACEHOLDER;$("#ipodArt").src=PLACEHOLDER;
  $$(".track-title-sync").forEach(el=>el.textContent="Your next favorite song");
  $$(".track-artist-sync").forEach(el=>el.textContent="A world of music awaits");
  $("#nowFavorite").textContent="♡";$("#nowFavorite").classList.remove("active");
  updateTime();displayStatus();
}
function toggleFavorite(track){
  if(!track){toast("Play or choose something first.");return;}
  if(track.kind==="file"){toast("Local files stay private; add them again next visit.");return;}
  const index=state.favorites.findIndex(t=>t.id===track.id);
  if(index>=0)state.favorites.splice(index,1);
  else state.favorites.unshift(track);
  state.favorites=state.favorites.slice(0,100);
  persist("favorites",state.favorites);updateCounts();renderResults();displayStatus();
  toast(index>=0?"Removed from favorites":"Saved to favorites ♡");
}
function updateCounts(){
  $("#favoriteCount").textContent=state.favorites.length;
  $("#libraryCount").textContent=state.local.length+state.recent.length;
  $("#queueCount").textContent=state.queue.length;
}
function rowMarkup(track,index){
  const art=htmlSafe(safeImage(track.artwork));
  const chosen=state.current?.id===track.id;
  const fav=state.favorites.some(t=>t.id===track.id);
  const catalog=track.kind==="catalog";
  const queueView=state.view==="queue";
  const label=catalog?"CATALOG":track.live?"LIVE":track.kind==="file"?"YOUR FILE":track.kind==="audius"?"FULL SONG":"RADIO";
  const primary=catalog?
    '<a class="row-link" href="'+htmlSafe(track.link)+'" target="_blank" rel="noopener noreferrer" title="Open in Apple Music">APPLE ↗</a>':
    '<button type="button" class="row-play" data-row-action="play" data-track-id="'+htmlSafe(track.id)+'" aria-label="Play '+htmlSafe(track.title)+'">'+(chosen&&!audio.paused?"Ⅱ":"▶")+'</button>';
  const favorite='<button type="button" class="row-fav'+(fav?" active":"")+'" data-row-action="favorite" data-track-id="'+htmlSafe(track.id)+'" aria-label="'+(fav?"Remove from":"Add to")+' favorites">'+(fav?"♥":"♡")+'</button>';
  const add=catalog?'':queueView?
    '<button type="button" data-row-action="remove" data-index="'+index+'" aria-label="Remove from queue">✕</button>':
    '<button type="button" data-row-action="add" data-track-id="'+htmlSafe(track.id)+'" aria-label="Add to queue">＋</button>';
  return '<div class="result-row'+(chosen?" selected-result":"")+'"><span class="result-number">'+String(index+1).padStart(2,"0")+'</span><img class="result-art" loading="lazy" src="'+art+'" alt="" data-fallback><div class="result-desc"><strong>'+htmlSafe(track.title)+'</strong><small>'+htmlSafe(track.artist||track.album)+'</small></div><span class="result-label">'+label+'</span><div class="result-actions">'+primary+favorite+add+'</div></div>';
}
function renderResults(){
  const target=$("#results");
  if(state.loading&&state.view==="discover"){target.innerHTML='<div class="empty-results">Searching the airwaves… ✳</div>';$("#resultsCount").textContent="TUNING IN";$("#loadMoreWrap").hidden=true;return;}
  if(state.view==="discover"&&state.tab==="embeds"){target.innerHTML="";$("#resultsCount").textContent="OFFICIAL PLAYERS";$("#loadMoreWrap").hidden=true;return;}
  const tracks=getVisibleTracks();
  if(state.view==="discover"&&state.tab==="files"&&tracks.length===0){
    target.innerHTML='<div class="empty-results">Add a few audio files above to create your personal mixtape.</div>';
  }else if(!tracks.length){
    const message=state.view==="favorites"?"No favorites yet. Heart a station to keep it here.":state.view==="queue"?"Queue is empty. Add something you love.":state.view==="library"?"Your library will fill up as you listen or add music.":"Nothing found. Try another search or genre.";
    target.innerHTML='<div class="empty-results">'+message+'</div>';
  }else{target.innerHTML=tracks.slice(0,state.limit).map(rowMarkup).join("");}
  $("#resultsCount").textContent=tracks.length+" "+(tracks.length===1?"ITEM":"ITEMS");
  $("#loadMoreWrap").hidden=tracks.length<=state.limit;
}
function renderQueuePreview(){
  const el=$("#queuePreview");
  if(!state.queue.length){el.innerHTML='<div class="empty-mini">Your mixtape is waiting to happen.</div>';return;}
  const tracks=state.queue.slice(Math.max(0,state.currentIndex),Math.max(0,state.currentIndex)+4);
  el.innerHTML=tracks.map(track=>{
    const index=state.queue.findIndex(t=>t.id===track.id);
    return '<div class="queue-row"><button type="button" data-queue-play="'+index+'" aria-label="Play '+htmlSafe(track.title)+'"><img src="'+htmlSafe(safeImage(track.artwork))+'" alt="" data-fallback><span class="queue-text"><strong>'+htmlSafe(track.title)+'</strong><small>'+htmlSafe(track.artist)+'</small></span></button><button type="button" class="queue-remove" aria-label="Remove from queue" data-queue-remove="'+index+'">×</button></div>';
  }).join("");
}
function renderIpodMenu(){
  const items=state.queue.length?state.queue:[];
  if(!state.ipodMenu)return;
  const el=$("#ipodMenuItems");state.menuIndex=Math.max(0,Math.min(state.menuIndex,items.length-1));
  if(!items.length){el.innerHTML='<div class="screen-menu-row active">Queue is empty</div>';return;}
  const start=Math.max(0,Math.min(state.menuIndex-1,items.length-4));
  el.innerHTML=items.slice(start,start+4).map((track,i)=>'<div class="screen-menu-row'+(start+i===state.menuIndex?" active":"")+'"><span>'+htmlSafe(track.title.slice(0,19))+'</span><span>›</span></div>').join("");
}
function setIpodMenu(show){
  state.ipodMenu=show;$("#ipodMenuScreen").hidden=!show;$("#ipodNowScreen").hidden=show;renderIpodMenu();
}
function wheelMove(step){
  if(state.ipodMenu){
    if(!state.queue.length)return;
    state.menuIndex=Math.max(0,Math.min(state.queue.length-1,state.menuIndex+step));renderIpodMenu();
  }else if(!state.current?.live&&state.current&&Number.isFinite(audio.duration)&&audio.duration>0){
    audio.currentTime=Math.max(0,Math.min(audio.duration,audio.currentTime+step*3));
  }else{
    audio.volume=Math.max(0,Math.min(1,audio.volume+step*.05));$("#volumeControl").value=String(Math.round(audio.volume*100));
  }
}
function getAngle(e,el){const r=el.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI;}
function initializeWheel(){
  const wheel=$("#clickWheel");
  wheel.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;pointerAngle=getAngle(e,wheel);turnSum=0;wheel.setPointerCapture(e.pointerId);});
  wheel.addEventListener("pointermove",e=>{
    if(pointerAngle===null)return;
    const angle=getAngle(e,wheel);let diff=angle-pointerAngle;
    if(diff>180)diff-=360;if(diff< -180)diff+=360;
    turnSum+=diff;pointerAngle=angle;
    while(Math.abs(turnSum)>24){const step=turnSum>0?1:-1;wheelMove(step);turnSum-=step*24;}
  });
  wheel.addEventListener("pointerup",()=>pointerAngle=null);
  wheel.addEventListener("pointercancel",()=>pointerAngle=null);
  wheel.addEventListener("wheel",e=>{e.preventDefault();wheelMove(e.deltaY>0?1:-1);},{passive:false});
  $("#wheelMenu").addEventListener("click",()=>setIpodMenu(!state.ipodMenu));
  $("#wheelSelect").addEventListener("click",()=>{if(state.ipodMenu){if(state.queue.length){playAt(state.menuIndex);setIpodMenu(false);}}else toggle();});
  $("#wheelPrevious").addEventListener("click",()=>state.ipodMenu?wheelMove(-1):nextTrack(-1));
  $("#wheelNext").addEventListener("click",()=>state.ipodMenu?wheelMove(1):nextTrack(1));
  $("#wheelPlay").addEventListener("click",()=>toggle());
}
function handleFiles(fileList){
  const files=[...fileList].filter(file=>file.type.startsWith("audio/")||/\.(mp3|m4a|wav|flac|ogg|aac)$/i.test(file.name));
  if(!files.length){toast("Choose an audio file such as MP3, WAV or M4A.");return;}
  const tracks=files.map((file,index)=>({
    id:"file:"+Date.now()+":"+index+":"+file.name,kind:"file",
    title:file.name.replace(/\.[^.]+$/,""),artist:"From your device",artwork:PLACEHOLDER,
    stream:URL.createObjectURL(file),source:"LOCAL AUDIO",live:false
  }));
  state.local=uniqueTracks([...state.local,...tracks]);state.tab="files";
  updateCounts();setView("discover");renderResults();toast("Added "+tracks.length+" song"+(tracks.length===1?"":"s")+" to your library.");
  $("#localFiles").value="";
}
function openEmbed(){
  const parsed=parseEmbedUrl($("#externalUrl").value);
  if(!parsed){toast("Use a valid Spotify, YouTube, or SoundCloud link.");return;}
  const frame=document.createElement("iframe");
  frame.title=parsed.provider+" official embedded player";
  frame.src=parsed.src;frame.loading="lazy";frame.allow="autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen";frame.referrerPolicy="strict-origin-when-cross-origin";
  frame.style.height=parsed.height+"px";
  $("#embedFrame").replaceChildren(frame);
  toast(parsed.provider+" player opened. Use its own playback controls.");
}
function setupEvents(){
  $$(".device-choice").forEach(b=>b.addEventListener("click",()=>setDevice(b.dataset.setDevice)));
  $$(".swatch").forEach(b=>b.addEventListener("click",()=>setSkin(b.dataset.setSkin)));
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  $$(".source-tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
  $("#searchButton").addEventListener("click",()=>searchMusic($("#musicSearch").value.trim()));
  $("#musicSearch").addEventListener("keydown",e=>{if(e.key==="Enter")searchMusic(e.target.value.trim());});
  $("#trendingSearch").addEventListener("click",e=>{const target=e.target.closest("[data-quick-search]");if(target)searchMusic(target.dataset.quickSearch);});
  $("#results").addEventListener("click",e=>{
    const target=e.target.closest("[data-row-action]");if(!target)return;
    const action=target.dataset.rowAction;
    if(action==="remove"){removeQueue(Number(target.dataset.index));return;}
    const track=getVisibleTracks().find(t=>t.id===target.dataset.trackId);
    if(!track)return;
    if(action==="play"){if(state.current?.id===track.id)toggle();else setQueueItem(track);}
    if(action==="add")setQueueItem(track,{play:false});
    if(action==="favorite")toggleFavorite(track);
  });
  $("#queuePreview").addEventListener("click",e=>{
    const play=e.target.closest("[data-queue-play]");const remove=e.target.closest("[data-queue-remove]");
    if(play)playAt(Number(play.dataset.queuePlay));
    if(remove)removeQueue(Number(remove.dataset.queueRemove));
  });
  $("#clearQueue").addEventListener("click",clearQueue);
  $$('[data-action="toggle"]').forEach(b=>b.addEventListener("click",toggle));
  $$('[data-action="next"]').forEach(b=>b.addEventListener("click",()=>nextTrack(1)));
  $$('[data-action="previous"]').forEach(b=>b.addEventListener("click",()=>nextTrack(-1)));
  $("#shuffleButton").addEventListener("click",()=>{
    state.shuffle=!state.shuffle;$("#shuffleButton").classList.toggle("active",state.shuffle);
    $("#shuffleButton").setAttribute("aria-pressed",String(state.shuffle));toast(state.shuffle?"Shuffle on":"Shuffle off");
  });
  $("#repeatButton").addEventListener("click",()=>{
    state.repeat=state.repeat==="off"?"all":state.repeat==="all"?"one":"off";
    $("#repeatButton").classList.toggle("active",state.repeat!=="off");
    $("#repeatButton").textContent=state.repeat==="one"?"↻₁":"↻";
    $("#repeatButton").title="Repeat: "+state.repeat;toast("Repeat "+state.repeat);
  });
  $("#seekbar").addEventListener("input",e=>{
    if(!state.current?.live&&Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=audio.duration*Number(e.target.value)/100;
  });
  $("#volumeControl").addEventListener("input",e=>audio.volume=Number(e.target.value)/100);
  $("#nowFavorite").addEventListener("click",()=>toggleFavorite(state.current));
  $("#localFiles").addEventListener("change",e=>handleFiles(e.target.files));
  $("#embedButton").addEventListener("click",openEmbed);
  $("#externalUrl").addEventListener("keydown",e=>{if(e.key==="Enter")openEmbed();});
  $("#infoButton").addEventListener("click",()=>$("#sourceDialog").showModal());
  $("#loadMore").addEventListener("click",()=>{state.limit+=12;renderResults();});
  $$("img[data-fallback],#nowArtwork,#ipodArt").forEach(img=>img.addEventListener("error",()=>{if(!img.src.endsWith("placeholder.svg"))img.src=PLACEHOLDER;}));
  document.addEventListener("error",e=>{if(e.target?.matches?.("img[data-fallback]"))e.target.src=PLACEHOLDER;},true);
  document.addEventListener("keydown",e=>{
    if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)||$("#sourceDialog").open)return;
    if(e.code==="Space"){e.preventDefault();toggle();}
    if(e.key==="ArrowRight")nextTrack(1);
    if(e.key==="ArrowLeft")nextTrack(-1);
    if(e.key.toLowerCase()==="m")setIpodMenu(!state.ipodMenu);
    if(e.key==="/" ){e.preventDefault();setView("discover");$("#musicSearch").focus();}
  });
  window.addEventListener("pagehide",()=>state.local.forEach(t=>URL.revokeObjectURL(t.stream)));
  audio.addEventListener("play",displayStatus);audio.addEventListener("pause",displayStatus);
  audio.addEventListener("timeupdate",updateTime);audio.addEventListener("loadedmetadata",updateTime);
  audio.addEventListener("durationchange",updateTime);
  audio.addEventListener("ended",()=>nextTrack(1,true));
  audio.addEventListener("error",()=>{if(!state.current)return;displayStatus();toast("Station unavailable or audio format unsupported. Try another.");});
  if("mediaSession" in navigator){
    const actions={play:()=>toggle(),pause:()=>toggle(),nexttrack:()=>nextTrack(1),previoustrack:()=>nextTrack(-1)};
    for(const [action,handler] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
  }
  initializeWheel();
}
function init(){
  setDevice(state.device);setSkin(state.skin);setupEvents();updateCounts();resetNow();
  const setClock=()=>{$("#localClock").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});};setClock();setInterval(setClock,60000);
  searchMusic("lofi");
}
init();
