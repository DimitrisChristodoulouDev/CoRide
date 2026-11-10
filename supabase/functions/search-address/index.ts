import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
Deno.serve(async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:request.headers.get('Authorization')??''}}});
  const {data:{user},error}=await db.auth.getUser();if(error||!user)return Response.json({error:'Sign in to search addresses.'},{status:401,headers:cors});
  const {query}=await request.json();if(typeof query!=='string'||query.trim().length<2||query.length>250)return Response.json({error:'Enter an address between 2 and 250 characters.'},{status:400,headers:cors});
  const limit=await db.rpc('consume_address_search');if(limit.error||!limit.data)return Response.json({error:'Too many searches. Try again in a minute.'},{status:429,headers:cors});
  const key=Deno.env.get('GOOGLE_PLACES_API_KEY');if(!key)return Response.json({error:'The operator has not configured Google Places yet.'},{status:503,headers:cors});
  const google=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.formattedAddress,places.displayName,places.location'},body:JSON.stringify({textQuery:`${query.trim()}, Cyprus`,regionCode:'CY',languageCode:'en',pageSize:8,locationBias:{rectangle:{low:{latitude:34.5,longitude:32.2},high:{latitude:35.7,longitude:34.6}}}})});
  if(!google.ok)return Response.json({error:'Google address search is unavailable. Check billing and Places API configuration.'},{status:502,headers:cors});
  return Response.json(await google.json(),{headers:cors});
 }catch{return Response.json({error:'Unable to search addresses.'},{status:500,headers:cors});}
});
