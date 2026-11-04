// Radio Browser proxy: public directory metadata, no credentials or private endpoints.
export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  const q=String(req.query?.q||"lofi").trim().slice(0,80);
  if(!q)return res.status(400).json({error:"Search term required"});
  const params=new URLSearchParams({name:q,hidebroken:"true",order:"votes",reverse:"true",limit:"50"});
  res.setHeader("Cache-Control","public, s-maxage=180, stale-while-revalidate=900");
  const endpoints=["https://de1.api.radio-browser.info","https://at1.api.radio-browser.info","https://nl1.api.radio-browser.info"];
  for(const root of endpoints){
    try{
      const response=await fetch(root+"/json/stations/search?"+params,{headers:{"User-Agent":"SonoraRetroPlayer/1.0 (public GitHub project)","Accept":"application/json"},signal:AbortSignal.timeout(5000)});
      if(!response.ok)continue;
      const data=await response.json();if(!Array.isArray(data))continue;
      const filtered=data.filter(s=>{
        try{
          const url=new URL(s.url_resolved||s.url);
          return url.protocol==="https:"&&!/\.(m3u8?|pls|asx)$/i.test(url.pathname)&&(s.lastcheckok===1||s.lastcheckok===true||s.lastcheckok==="1");
        }catch{return false;}
      }).slice(0,40);
      return res.status(200).json(filtered.map(s=>({
        stationuuid:s.stationuuid,name:s.name,country:s.country,tags:s.tags,
        favicon:s.favicon,url_resolved:s.url_resolved||s.url,lastcheckok:s.lastcheckok
      })));
    }catch{/* Try another public mirror. */}
  }
  return res.status(502).json({error:"Radio directory unavailable. Try again soon."});
}
