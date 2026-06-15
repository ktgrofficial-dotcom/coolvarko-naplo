const ALLOWED_ORIGIN="https://ktgrofficial-dotcom.github.io";
export default{async fetch(request,env){
if(request.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"}});
if(request.method!=="POST")return new Response("Method not allowed",{status:405});
const origin=request.headers.get("Origin");
if(origin!==ALLOWED_ORIGIN)return new Response("Forbidden",{status:403});
try{
const body=await request.json();
const apiKey=env.ANTHROPIC_API_KEY||"";
const response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify(body)});
const data=await response.json();
return new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":ALLOWED_ORIGIN}});
}catch(err){return new Response(JSON.stringify({error:err.message}),{status:500,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":ALLOWED_ORIGIN}});}
}};
