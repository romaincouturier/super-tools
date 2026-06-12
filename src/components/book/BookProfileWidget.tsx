import { User } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BookProfile } from '@/types/book';

interface BookProfileWidgetProps {
  profile: BookProfile | null;
}

export default function BookProfileWidget({ profile }: BookProfileWidgetProps) {
  const hasPhoto = Boolean(profile?.photo_url);
  const hasBio = Boolean(profile?.bio);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-lg cursor-pointer flex items-center justify-center bg-gray-700">
              {hasPhoto ? (
                <img
                  src={profile!.photo_url!}
                  alt="Profil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-gray-300" />
              )}
            </div>
          </TooltipTrigger>
          {hasBio && (
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm">{profile!.bio}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
