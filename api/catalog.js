// Apple Search catalog metadata: discovery and store links only, NOT a music streaming service.
export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const q=String(req.query?.q||"").trim().slice(0,80);
  if(!q)return res.status(400).json({error:"Search term required"});
  const params=new URLSearchParams({term:q,media:"music",entity:"song",country:"IN",limit:"35"});
  try{
    const upstream=await fetch("https://itunes.apple.com/search?"+params,{
      headers:{"Accept":"application/json","User-Agent":"SonoraRetroPlayer/1.0"},signal:AbortSignal.timeout(7500)});
    if(!upstream.ok)throw Error("Catalog upstream unavailable");
    const data=await upstream.json();
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json((data.results||[]).map(s=>({
      trackId:s.trackId,trackName:s.trackName,artistName:s.artistName,
      collectionName:s.collectionName,artworkUrl100:s.artworkUrl100,
      trackViewUrl:s.trackViewUrl
    })));
  }catch{return res.status(502).json({error:"Catalog unavailable. Try again soon."});}
}
