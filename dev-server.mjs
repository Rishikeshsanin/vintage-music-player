// Zero-dependency local preview: npm run dev (Node.js >=20).
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname} from "node:path";
import radio from "./api/radio.js";
import catalog from "./api/catalog.js";
import health from "./api/health.js";
import audius from "./api/audius.js";
const root=process.cwd(),port=Number(process.env.PORT||4173);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".json":"application/json"};
const handlers={"/api/radio":radio,"/api/catalog":catalog,"/api/health":health,"/api/audius":audius};
createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  if(handlers[url.pathname]){
    req.query=Object.fromEntries(url.searchParams);
    res.status=n=>{res.statusCode=n;return res;};
    res.json=data=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));return res;};
    try{await handlers[url.pathname](req,res);}catch{res.status(500).json({error:"Unexpected server error"});}
    return;
  }
  const file=resolve(root,"."+decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname));
  if(!file.startsWith(root+"/")||/\/(?:\.git|node_modules|api|tests)\//.test(file)){res.writeHead(404);res.end("Not found");return;}
  try{const body=await readFile(file);res.setHeader("Content-Type",types[extname(file)]||"application/octet-stream");res.end(body);}
  catch{res.writeHead(404);res.end("Not found");}
}).listen(port,()=>console.log("Sonora local preview at http://localhost:"+port));
