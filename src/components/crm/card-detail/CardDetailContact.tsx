import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  User,
  Building2,
  Phone,
  Linkedin,
  Mail,
  ExternalLink,
  Globe,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
}

const CardDetailContact = ({ state, handlers }: Props) => {
  const {
    contactExpanded, setContactExpanded,
    firstName, setFirstName, lastName, setLastName,
    company, setCompany, email, setEmail,
    phone, setPhone, linkedinUrl, websiteUrl, setWebsiteUrl,
  } = state;

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3 mt-4">
      <button
        onClick={() => setContactExpanded(!contactExpanded)}
        className="flex items-center justify-between w-full"
      >
        <h4 className="font-medium text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          Contact
          {(firstName || lastName) && (
            <span className="text-muted-foreground font-normal">
              — {[firstName, lastName].filter(Boolean).join(" ")}
              {company && ` (${company})`}
            </span>
          )}
        </h4>
        {contactExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Mini contact — always visible when collapsed */}
      {!contactExpanded && (
        <div className="flex items-center gap-2 flex-wrap">
          {email.trim() && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handlers.copyToClipboard(email)}
              title={email}
            >
              <Copy className="h-3 w-3" />
              Email
            </Button>
          )}
          {phone.trim() && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" title="QR Code téléphone">
                  <QRCodeSVG value={`tel:${phone.trim()}`} size={12} className="h-3 w-3" />
                  QR
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="flex flex-col items-center gap-2">
                  <QRCodeSVG value={`tel:${phone.trim()}`} size={140} />
                  <span className="text-xs text-muted-foreground">Scannez pour appeler</span>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {linkedinUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => window.open(linkedinUrl, '_blank', 'noopener')}
            >
              <Linkedin className="h-3 w-3" />
              LinkedIn
            </Button>
          )}
        </div>
      )}

      {/* Full contact form */}
      {contactExpanded && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Prénom</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nom</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="h-8" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Entreprise
            </Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email
            </Label>
            <div className="flex gap-1">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="h-8 flex-1" />
              {email.trim() && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handlers.copyToClipboard(email)} title="Copier l'email">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Téléphone
            </Label>
            <div className="flex items-center gap-2">
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className="h-8 flex-1" />
              {phone.trim() && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="QR Code téléphone">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="flex flex-col items-center gap-2">
                      <QRCodeSVG value={`tel:${phone.trim()}`} size={140} />
                      <span className="text-xs text-muted-foreground">Scannez pour appeler</span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          {linkedinUrl && (
            <div className="col-span-2">
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => window.open(linkedinUrl, '_blank', 'noopener')}>
                <Linkedin className="h-3.5 w-3.5" />
                LinkedIn
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Site web
            </Label>
            <div className="flex gap-2">
              <Input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://www.exemple.com" className="h-8 flex-1" />
              {websiteUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDetailContact;
