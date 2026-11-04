export const DEVICE_INFO = {
  ipod:{name:"iPod Classic",year:"2001",description:"THE ONE THAT STARTED IT ALL"},
  walkman:{name:"Cassette Walkman",year:"1979",description:"PRESS PLAY. FLIP SIDE A."},
  discman:{name:"CD Discman",year:"1984",description:"SKIP-FREE NOSTALGIA"},
  vinyl:{name:"Vinyl Turntable",year:"1970",description:"THE WARMTH OF ANALOG"},
  boombox:{name:"Retro Boombox",year:"1986",description:"LOUDER THAN YOUR MEMORIES"}
};
export const SKINS = {pearl:"PEARL WHITE",midnight:"MIDNIGHT NAVY",blush:"BLUSH PINK",mint:"VINTAGE MINT",orange:"SUNSET ORANGE"};
export const PLACEHOLDER = "/placeholder.svg";
export function isHttpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
export function safeImage(value){return isHttpsUrl(value)?value:PLACEHOLDER;}
export function safeAudio(value) {
  if(typeof value!=="string")return "";
  try{
    const parsed=new URL(value);
    if(parsed.protocol!=="https:"&&parsed.protocol!=="blob:")return "";
    if(parsed.protocol==="https:"&&/\.(m3u8?|pls|asx)(\?|$)/i.test(parsed.pathname))return "";
    return value;
  }catch{return "";}
}
export function normalizeRadio(station){
  if(!station||typeof station!=="object")return null;
  const stream=safeAudio(station.url_resolved||station.url);
  if(!stream||!station.name)return null;
  if(station.lastcheckok===0||station.lastcheckok==="0")return null;
  return {
    id:"radio:"+String(station.stationuuid||station.url_resolved||station.url).slice(0,250),
    kind:"radio",title:String(station.name).trim().slice(0,110),
    artist:[station.country,station.tags?.split(",").slice(0,1)[0]].filter(Boolean).join(" · ").slice(0,110)||"Live worldwide radio",
    artwork:safeImage(station.favicon),stream,source:"LIVE RADIO",live:true
  };
}
export function normalizeCatalog(song){
  if(!song||!song.trackName||!song.artistName||!isHttpsUrl(song.trackViewUrl))return null;
  return {id:"catalog:"+String(song.trackId||song.trackViewUrl),kind:"catalog",
    title:String(song.trackName).slice(0,120),artist:String(song.artistName).slice(0,120),
    album:String(song.collectionName||"").slice(0,110),
    artwork:safeImage(song.artworkUrl100?.replace(/100x100bb/, "300x300bb")),
    link:song.trackViewUrl,source:"APPLE MUSIC CATALOG",live:false};
}
export function formatTime(value){
  if(!Number.isFinite(value)||value<0)return "0:00";
  const seconds=Math.floor(value),mins=Math.floor(seconds/60);
  return String(mins)+":"+String(seconds%60).padStart(2,"0");
}
export function parseEmbedUrl(value){
  if(typeof value!=="string")return null;
  let url;
  try{url=new URL(value.trim());}catch{return null;}
  if(url.protocol!=="https:")return null;
  const host=url.hostname.toLowerCase();
  const segments=url.pathname.split("/").filter(Boolean);
  if(host==="open.spotify.com"){
    const type=segments[0]==="intl-en"||segments[0]?.startsWith("intl-")?segments[1]:segments[0];
    const id=segments[0]?.startsWith("intl-")?segments[2]:segments[1];
    if(!["track","album","playlist","episode","show"].includes(type)||!id||!/^[a-zA-Z0-9]{10,30}$/.test(id))return null;
    return {provider:"Spotify",src:"https://open.spotify.com/embed/"+type+"/"+id,height:352};
  }
  if(host==="youtube.com"||host==="www.youtube.com"||host==="music.youtube.com"||host==="m.youtube.com"||host==="youtu.be"){
    const id=host==="youtu.be"?segments[0]:(segments[0]==="shorts"||segments[0]==="embed"||segments[0]==="live")?segments[1]:url.searchParams.get("v");
    if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return {provider:"YouTube",src:"https://www.youtube-nocookie.com/embed/"+id,height:315};
    const list=url.searchParams.get("list");
    if(list&&/^[a-zA-Z0-9_-]{10,80}$/.test(list))return {provider:"YouTube",src:"https://www.youtube-nocookie.com/embed/videoseries?list="+encodeURIComponent(list),height:315};
  }
  if(host==="soundcloud.com"||host==="www.soundcloud.com"){
    if(segments.length<2)return null;
    const original="https://soundcloud.com/"+segments.map(encodeURIComponent).join("/");
    return {provider:"SoundCloud",src:"https://w.soundcloud.com/player/?url="+encodeURIComponent(original)+"&color=%23ec9176&auto_play=false&hide_related=true",height:300};
  }
  return null;
}
export function uniqueTracks(tracks){
  const seen=new Set();
  return tracks.filter(t=>t&&typeof t.id==="string"&&!seen.has(t.id)&&seen.add(t.id));
}
export function readStore(key,fallback){
  try{const v=JSON.parse(localStorage.getItem(key));return v??fallback;}catch{return fallback;}
}

export function normalizeAudius(track){
  if(!track||typeof track!=="object"||!track.id||!track.title)return null;
  if(track.is_streamable===false||track.isStreamable===false||track.is_streamable==="false")return null;
  const id=String(track.id);
  if(!/^[a-zA-Z0-9_-]{1,90}$/.test(id))return null;
  const artist=track.user?.name||track.user?.handle||"Independent artist";
  const artwork=track.artwork||{};
  const image=artwork["480x480"]||artwork["1000x1000"]||artwork["150x150"]||"";
  return {
    id:"audius:"+id,kind:"audius",title:String(track.title).slice(0,120),
    artist:String(artist).slice(0,120),artwork:safeImage(image),
    album:String(track.genre||track.mood||"Open music").slice(0,70),
    stream:"https://api.audius.co/v1/tracks/"+encodeURIComponent(id)+"/stream?app_name=SonoraVintagePlayer",
    link:isHttpsUrl(track.permalink)?track.permalink:"",
    source:"AUDIUS · FULL SONG",live:false
  };
}
