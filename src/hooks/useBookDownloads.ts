import { useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { downloadBookProduction } from '@/services/bookDownloads';
import type { BookProduction } from '@/types/book';

export function useBookDownloads(allowed: boolean) {
  const busy = useRef(false);
  const [downloading, setDownloading] = useState(false);

  async function download(productions: BookProduction[]) {
    if (!allowed || busy.current || productions.length === 0) return;
    busy.current = true;
    setDownloading(true);
    let success = 0;
    const failures: string[] = [];
    try {
      for (const production of productions) {
        try {
          await downloadBookProduction(production);
          success++;
        } catch (error) {
          failures.push(`${production.title} : ${error instanceof Error ? error.message : 'Erreur de téléchargement'}`);
        }
      }
      if (success > 0) toast({ title: `${success} fichier${success > 1 ? 's' : ''} téléchargé${success > 1 ? 's' : ''}` });
      if (success < productions.length) toast({
        title: 'Erreur lors du téléchargement',
        description: `${productions.length - success} fichier(s) n’ont pas pu être téléchargés. ${failures[0]}`,
        variant: 'destructive',
      });
    } finally {
      busy.current = false;
      setDownloading(false);
    }
  }

  return { downloading, download };
}