import test from "node:test";
import assert from "node:assert/strict";
import {DEVICE_INFO,SKINS,formatTime,parseEmbedUrl,normalizeRadio,normalizeCatalog,normalizeAudius,safeAudio,safeImage,uniqueTracks} from "../logic.mjs";

test("five player choices and five colorways",()=>{
  assert.deepEqual(Object.keys(DEVICE_INFO),["ipod","walkman","discman","vinyl","boombox"]);
  assert.equal(Object.keys(SKINS).length,5);
});
test("time formatting handles invalid and large durations",()=>{
  assert.equal(formatTime(NaN),"0:00");
  assert.equal(formatTime(-1),"0:00");
  assert.equal(formatTime(0),"0:00");
  assert.equal(formatTime(75.9),"1:15");
  assert.equal(formatTime(3600),"60:00");
});
test("radio streams require HTTPS and reject playlist transports",()=>{
  assert.equal(safeAudio("http://radio.example/stream"),"");
  assert.equal(safeAudio("javascript:alert(1)"),"");
  assert.equal(safeAudio("https://radio.example/live.m3u8"),"");
  assert.equal(safeAudio("https://radio.example/live.mp3"),"https://radio.example/live.mp3");
  assert.ok(safeAudio("blob:https://sonora.example/123"));
});
test("radio normalization rejects unhealthy and insecure stations",()=>{
  const base={stationuuid:"123",name:"Good FM",url_resolved:"https://example.org/live.mp3",lastcheckok:1};
  assert.equal(normalizeRadio(base).title,"Good FM");
  assert.equal(normalizeRadio({...base,lastcheckok:0}),null);
  assert.equal(normalizeRadio({...base,url_resolved:"http://example.org/mp3"}),null);
  assert.equal(normalizeRadio({...base,name:""}),null);
  assert.equal(normalizeRadio({...base,favicon:"javascript:bad"}).artwork,"/placeholder.svg");
});
test("catalog provides only official store link and metadata",()=>{
  const track=normalizeCatalog({trackId:12,trackName:"The Song",artistName:"The Artist",collectionName:"Album",trackViewUrl:"https://music.apple.com/us/song/foo/12",artworkUrl100:"https://example.com/art100x100bb.jpg",previewUrl:"https://example.com/preview"});
  assert.equal(track.kind,"catalog");assert.equal(track.link,"https://music.apple.com/us/song/foo/12");
  assert.equal("stream" in track,false);
  assert.equal("previewUrl" in track,false);
  assert.equal(track.artwork,"https://example.com/art300x300bb.jpg");
  assert.equal(normalizeCatalog({trackName:"Nope",artistName:"X",trackViewUrl:"http://example.com"}),null);
});
test("Spotify official embedding handles international links",()=>{
  assert.equal(parseEmbedUrl("https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ")?.src,"https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ");
  assert.ok(parseEmbedUrl("https://open.spotify.com/intl-en/album/0Lr4kGOYn9l83EjuK6cZFQ")?.src.includes("/album/"));
});
test("YouTube video and playlist URLs resolve to restricted embeds",()=>{
  assert.equal(parseEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=12")?.src,"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(parseEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.provider,"YouTube");
  assert.ok(parseEmbedUrl("https://www.youtube.com/playlist?list=PLabcdefghijklmnopq").src.includes("videoseries"));
});
test("SoundCloud uses official widget, not arbitrary iframe URLs",()=>{
  assert.ok(parseEmbedUrl("https://soundcloud.com/artist/track").src.startsWith("https://w.soundcloud.com/player/?"));
  for(const unsafe of ["javascript:alert(1)","http://soundcloud.com/user/song","https://evil.example/song","https://open.spotify.com.evil.example/track/0Lr4kGOYn9l83EjuK6cZFQ","https://youtube.com/watch?v=bad"]){
    assert.equal(parseEmbedUrl(unsafe),null,unsafe);
  }
});
test("dedupe keeps original order",()=>{
  assert.deepEqual(uniqueTracks([{id:"a"},{id:"b"},{id:"a"},null]).map(x=>x.id),["a","b"]);
  assert.equal(safeImage("data:image/svg+xml,evil"),"/placeholder.svg");
});

test("Audius supports licensed full-song streams without previews",()=>{
  const t=normalizeAudius({id:"ABcd123",title:"Daydream",user:{name:"Indie Star"},is_streamable:true,artwork:{"480x480":"https://cdn.example.com/art.jpg"}});
  assert.equal(t.kind,"audius");
  assert.equal(t.live,false);
  assert.equal(t.title,"Daydream");
  assert.ok(t.stream.includes("/tracks/ABcd123/stream?app_name=SonoraVintagePlayer"));
  assert.equal(normalizeAudius({id:"bad/id",title:"Unsafe"}),null);
  assert.equal(normalizeAudius({id:"ABcd123",title:"Unavailable",is_streamable:false}),null);
});
