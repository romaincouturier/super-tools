import { Link } from 'react-router-dom';
import { useTrainingTranscripts } from '@/hooks/useTrainingTranscripts';
import { Button } from '@/components/ui/button';
import { useWebMCP } from 'use-webmcp-tool';
import { runWebMCPTool } from '@/lib/webmcp-telemetry';
export default function TrainingTranscriptsSection({trainingId}:{trainingId:string}){
 const {data,isLoading,error,refetch}=useTrainingTranscripts(trainingId);
 useWebMCP({name:'list_visible_training_transcripts',description:'Liste les transcripts visibles sur cette fiche formation.',enabled:!isLoading&&!error,annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>runWebMCPTool('list_visible_training_transcripts',()=>data?.map(r=>r.transcripts?`${r.transcripts.id}: ${r.transcripts.ai_title||r.transcripts.title}`:'').filter(Boolean).join('\n')||'Aucun transcript rattaché.')});
 return <section className="my-6 border-t pt-6"><h2 className="text-lg font-semibold mb-3">Transcripts</h2>{isLoading?<p className="text-muted-foreground">Chargement…</p>:error?<Button variant="outline" onClick={()=>refetch()}>Réessayer</Button>:!data?.length?<p className="text-sm text-muted-foreground">Aucun transcript rattaché.</p>:<ul className="divide-y">{data.map(row=>{const t=row.transcripts;return t?<li key={row.id} className="py-3"><Link className="font-medium underline underline-offset-4" to={`/supertilt-fr/transcripts?transcript=${t.id}`}>{t.ai_title||t.title||'Transcript'}</Link><p className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'})}{t.duration_seconds?` · ${Math.round(t.duration_seconds/60)} min`:''}</p></li>:null;})}</ul>}</section>;
}
