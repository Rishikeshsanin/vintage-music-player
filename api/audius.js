// Full-track music search via Audius's official public read API (no credentials required).
export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const q=String(req.query?.q||"lofi").trim().slice(0,80);
  const endpoint=new URL("https://api.audius.co/v1/tracks/"+(q?"search":"trending"));
  if(q)endpoint.searchParams.set("query",q);
  endpoint.searchParams.set("app_name","SonoraVintagePlayer");
  endpoint.searchParams.set("limit","40");
  if(q)endpoint.searchParams.set("sort_method","relevant");
  try{
    const response=await fetch(endpoint,{headers:{"Accept":"application/json","User-Agent":"SonoraVintagePlayer/1.0"},signal:AbortSignal.timeout(9500)});
    if(!response.ok)throw Error("Audius upstream unavailable");
    const data=await response.json();
    if(!Array.isArray(data.data))throw Error("Unexpected catalog response");
    res.setHeader("Cache-Control","public, s-maxage=120, stale-while-revalidate=600");
    return res.status(200).json(data.data.filter(t=>t?.id&&t?.title&&t.is_streamable!==false).slice(0,35).map(t=>({
      id:t.id,title:t.title,user:{name:t.user?.name,handle:t.user?.handle},
      artwork:t.artwork,genre:t.genre,mood:t.mood,is_streamable:t.is_streamable,permalink:t.permalink
    })));
  }catch{return res.status(502).json({error:"Audius is temporarily unavailable."});}
}
