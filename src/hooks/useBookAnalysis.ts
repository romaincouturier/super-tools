import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEdgeFunction } from './useEdgeFunction';
import { getBookAnalysisStatus } from '@/services/bookAnalysis';

export function useBookAnalysis(albumId: string, ids: string[]) {
  const client = useQueryClient();
  const action = useEdgeFunction('analyze-book-productions', { successToast: { title: 'Analyse mise en file d’attente' } });
  const status = useQuery({ queryKey: ['book-analysis', albumId, ids], queryFn: () => getBookAnalysisStatus(ids), enabled: ids.length > 0,
    refetchInterval: query => query.state.data?.jobs.some(j => j.status === 'pending' || j.status === 'processing') ? 5000 : false });
  useEffect(() => {
    if (status.data?.jobs.some(j => j.status === 'done')) client.invalidateQueries({ queryKey: ['book-productions', albumId] });
  }, [status.dataUpdatedAt, albumId, client]);
  async function regenerate(id: string) {
    if (await action.invoke({ production_id: id })) await status.refetch();
  }
  async function resume() {
    if (await action.invoke({ resume: true })) await status.refetch();
  }
  return { ...status, loading: action.loading, regenerate, resume };
}