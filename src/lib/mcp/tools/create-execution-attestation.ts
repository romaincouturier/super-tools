import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
import { attestationFields } from '../attestation-shared';
export default defineTool({name:'create_execution_attestation',title:'Créer une attestation de bonne exécution',description:'Crée un brouillon pré-rempli depuis une mission OU une formation ; les champs fournis remplacent le pré-remplissage. Aucun email envoyé.',inputSchema:{mission_id:z.string().uuid().optional(),training_id:z.string().uuid().optional(),...attestationFields},handler:async({mission_id,training_id,...overrides},ctx)=>{if(!mission_id===!training_id)throw new Error('Indiquer mission_id ou training_id, pas les deux');const db=await staffClient(ctx);const {data,error}=await db.rpc('create_execution_attestation',{p_mission_id:mission_id??null,p_training_id:training_id??null,p_overrides:overrides});if(error)throw error;return result(data);}});
