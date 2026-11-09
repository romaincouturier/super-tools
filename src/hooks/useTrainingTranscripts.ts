import { useQuery } from '@tanstack/react-query';
import { fetchTrainingTranscripts } from '@/services/trainingTranscripts';
export function useTrainingTranscripts(id:string){return useQuery({queryKey:['training-transcripts',id],queryFn:()=>fetchTrainingTranscripts(id),enabled:!!id});}
