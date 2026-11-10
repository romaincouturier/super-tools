import { z } from 'zod';
export const attestationFields = {
 client_name:z.string().max(300).optional(),client_address:z.string().max(500).optional(),
 signer_name:z.string().max(200).optional(),signer_function:z.string().max(200).optional(),signer_email:z.string().email().optional(),
 is_public_entity:z.boolean().optional().describe("Intervention auprès d'une collectivité territoriale"),
 public_entity_name:z.string().max(300).optional(),public_contract_reference:z.string().max(200).optional(),
 subject:z.string().max(300).optional(),start_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),end_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
 location:z.string().max(300).optional(),participants_count:z.number().int().min(0).optional(),days_count:z.number().min(0).optional(),amount_ht:z.number().min(0).optional(),
 free_text:z.string().max(10000).optional().describe('Texte libre de description de la prestation'),certification_text:z.string().max(2000).optional(),link_validity_days:z.number().int().min(1).max(365).optional(),
};
export const SUMMARY='id,source_type,mission_id,training_id,status,subject,client_name,signer_name,signer_function,is_public_entity,public_entity_name,sent_at,expires_at,signed_at,refused_at,refusal_reason,created_at';
export function attestationUrl(token:string){ return `https://academy.supertilt.fr/attestation/${token}`; }
