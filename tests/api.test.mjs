import test from "node:test";
import assert from "node:assert/strict";
import radio from "../api/radio.js";
import catalog from "../api/catalog.js";
import health from "../api/health.js";
function mockRes(){
  return {statusCode:200,headers:{},payload:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(v){this.statusCode=v;return this;},
    json(v){this.payload=v;return this;}
  };
}
test("health endpoint exposes no secrets and reports supported sources",()=>{
  const res=mockRes();
  health({method:"GET"},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.ok,true);
  assert.deepEqual(res.payload.sources,["radio-browser","itunes-catalog","local-files","official-embeds"]);
});
test("catalog and radio reject unsupported HTTP methods",async()=>{
  for(const handler of [radio,catalog]){
    const res=mockRes();
    await handler({method:"POST",query:{q:"rock"}},res);
    assert.equal(res.statusCode,405);
    assert.equal(res.headers.Allow,"GET");
  }
});
test("catalog rejects empty search",async()=>{
  const res=mockRes();
  await catalog({method:"GET",query:{q:"   "}},res);
  assert.equal(res.statusCode,400);
});
