import { createClient } from '@supabase/supabase-js';
import type { ToolContext } from '@lovable.dev/mcp-js';
type Runtime = typeof globalThis & { Deno?: { env: { get(name: string): string | undefined } }; process?: { env: Record<string,string|undefined> } };
function env(name: string) { const r=globalThis as Runtime; return r.Deno?.env.get(name) ?? r.process?.env[name]; }
export function supabaseForUser(ctx: ToolContext) {
 const token=ctx.getToken(); if (!token) throw new Error('Connexion requise');
 const url=env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL');
 let key=env('SUPABASE_PUBLISHABLE_KEY') ?? env('VITE_SUPABASE_PUBLISHABLE_KEY') ?? env('SUPABASE_ANON_KEY');
 if (!key) { const keys=env('SUPABASE_PUBLISHABLE_KEYS'); if(keys) { const parsed=JSON.parse(keys); key=parsed.default ?? Object.values(parsed)[0] as string; } }
 if(!url || !key) throw new Error('Configuration indisponible');
 return createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
}
export async function staffClient(ctx: ToolContext) {
 const db=supabaseForUser(ctx); const {data,error}=await db.rpc('is_staff_user');
 if(error || data!==true) throw new Error('Accès personnel requis'); return db;
}
export async function dropshippingClient(ctx: ToolContext) {
 const db=supabaseForUser(ctx); const userId=ctx.getUserId(); if(!userId) throw new Error('Connexion requise');
 const [admin,module]=await Promise.all([
  db.rpc('is_admin',{_user_id:userId}),
  db.rpc('has_module_access',{_user_id:userId,_module:'dropshipping'}),
 ]);
 if(admin.error) throw admin.error; if(module.error) throw module.error;
 if(admin.data!==true&&module.data!==true) throw new Error('Accès dropshipping requis');
 return db;
}
export function result(data: unknown) { return {content:[{type:'text' as const,text:JSON.stringify(data)}]}; }
