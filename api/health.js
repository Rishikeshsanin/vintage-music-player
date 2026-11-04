export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({ok:true,app:"sonora",version:"1.0.0",sources:["audius","radio-browser","itunes-catalog","local-files","official-embeds"]});
}
