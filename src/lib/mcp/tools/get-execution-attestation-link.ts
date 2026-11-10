import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
import { attestationUrl } from '../attestation-shared';
export default defineTool({name:'get_execution_attestation_link',title:'Générer le lien de signature d’une attestation',description:'Génère (ou régénère, ce qui invalide l’ancien) le lien public de signature et passe l’attestation en Envoyée. N’envoie aucun email : le lien est à transmettre manuellement.',inputSchema:{attestation_id:z.string().uuid()},handler:async({attestation_id},ctx)=>{const db=await staffClient(ctx);const {data,error}=await db.rpc('generate_execution_attestation_link',{p_id:attestation_id});if(error)throw error;const d=data as {token:string;expires_at:string};return result({url:attestationUrl(d.token),expires_at:d.expires_at});}});
