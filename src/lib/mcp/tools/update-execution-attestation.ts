import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
import { attestationFields } from './attestation-shared';
export default defineTool({name:'update_execution_attestation',title:'Modifier une attestation de bonne exécution',description:'Modifie les champs fournis. Une attestation envoyée repasse en brouillon et son lien est invalidé. Impossible après signature.',inputSchema:{attestation_id:z.string().uuid(),...attestationFields},handler:async({attestation_id,...patch},ctx)=>{const db=await staffClient(ctx);const {data,error}=await db.from('execution_attestations').update(patch).eq('id',attestation_id).select('*').single();if(error)throw error;return result(data);}});
