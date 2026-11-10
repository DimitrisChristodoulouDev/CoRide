// Deploy with Supabase CLI. No service-role key belongs in the app.
import { createClient } from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
Deno.serve(async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
 const client=createClient(url,anon,{global:{headers:{Authorization:request.headers.get('Authorization')??''}}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)return new Response('Unauthorised',{status:401,headers:cors});
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:events}=await admin.from('notifications').select('id,user_id,body').eq('actor_id',user.id).eq('push_sent',false).order('created_at').limit(50);
 let sent=0;
 for(const event of events??[]){
  const {data:token}=await admin.from('push_tokens').select('token').eq('user_id',event.user_id).maybeSingle();if(!token)continue;
  // Claim each event once even if several clients invoke the function at once.
  const {data:claim}=await admin.from('notifications').update({push_sent:true}).eq('id',event.id).eq('push_sent',false).select('id');if(!claim?.length)continue;
  try{
   const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:token.token,title:'CoRide',body:event.body,channelId:'bookings'})});
   const result=await response.json();if(!response.ok||result.data?.status==='error')throw new Error('Push gateway rejected notification');sent++;
  }catch{await admin.from('notifications').update({push_sent:false}).eq('id',event.id);}
 }
 return Response.json({sent},{headers:cors});
});
