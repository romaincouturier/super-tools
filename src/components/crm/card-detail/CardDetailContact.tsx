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
  MapPin,
  Hash,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { CardDetailState, CardDetailHandlers } from "./types";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskName, maskEmail, maskPhone, maskText, maskAddress, maskSiren } from "@/lib/demoMask";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
}

const CardDetailContact = ({ state, handlers }: Props) => {
  const { isDemoMode } = useDemoMode();
  const {
    contactExpanded, setContactExpanded,
    firstName, setFirstName, lastName, setLastName,
    company, setCompany, email, setEmail,
    phone, setPhone, phone2, setPhone2, linkedinUrl, websiteUrl, setWebsiteUrl,
    siren, setSiren, address, setAddress,
    postalCode, setPostalCode, city, setCity, country, setCountry,
  } = state;

  const d = {
    firstName: isDemoMode ? maskName(firstName) : firstName,
    lastName: isDemoMode ? maskName(lastName) : lastName,
    company: isDemoMode ? maskText(company) : company,
    email: isDemoMode ? maskEmail(email) : email,
    phone: isDemoMode ? maskPhone(phone) : phone,
    phone2: isDemoMode ? maskPhone(phone2) : phone2,
    address: isDemoMode ? maskAddress(address) : address,
    siren: isDemoMode ? maskSiren(siren) : siren,
    city: isDemoMode ? maskText(city) : city,
    postalCode: isDemoMode ? "•••••" : postalCode,
  };

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
              — {[d.firstName, d.lastName].filter(Boolean).join(" ")}
              {company && ` (${d.company})`}
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
              title={isDemoMode ? "••••" : email}
            >
              <Copy className="h-3 w-3" />
              {d.email}
            </Button>
          )}
          {phone.trim() && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" title="QR Code téléphone">
                  <Phone className="h-3 w-3" />
                  {d.phone}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="flex flex-col items-center gap-2">
                  {!isDemoMode && <QRCodeSVG value={`tel:${phone.trim()}`} size={140} />}
                  {isDemoMode && <div className="w-[140px] h-[140px] bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">Masqué</div>}
                  <span className="text-xs text-muted-foreground">Scannez pour appeler</span>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Phone className="h-3 w-3" />
              Téléphone 2
            </Label>
            <div className="flex items-center gap-2">
              <Input type="tel" value={d.phone2} onChange={(e) => setPhone2(e.target.value)} placeholder="Second numéro" className="h-8 flex-1" readOnly={isDemoMode} />
              {phone2.trim() && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="QR Code téléphone 2">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="flex flex-col items-center gap-2">
                      {!isDemoMode && <QRCodeSVG value={`tel:${phone2.trim()}`} size={140} />}
                      {isDemoMode && <div className="w-[140px] h-[140px] bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">Masqué</div>}
                      <span className="text-xs text-muted-foreground">Scannez pour appeler</span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
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
            <Input value={d.firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nom</Label>
            <Input value={d.lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Entreprise
            </Label>
            <Input value={d.company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de l'entreprise" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email
            </Label>
            <div className="flex gap-1">
              <Input type="email" value={d.email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="h-8 flex-1" readOnly={isDemoMode} />
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
              <Input type="tel" value={d.phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className="h-8 flex-1" readOnly={isDemoMode} />
              {phone.trim() && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="QR Code téléphone">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="end">
                    <div className="flex flex-col items-center gap-2">
                      {!isDemoMode && <QRCodeSVG value={`tel:${phone.trim()}`} size={140} />}
                      {isDemoMode && <div className="w-[140px] h-[140px] bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">Masqué</div>}
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
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Hash className="h-3 w-3" />
              SIREN
            </Label>
            <Input value={d.siren} onChange={(e) => setSiren(e.target.value)} placeholder="123456789" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1" />
          <div className="space-y-1 col-span-2">
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Adresse
            </Label>
            <Input value={d.address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue de la République" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Code postal</Label>
            <Input value={d.postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="75001" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ville</Label>
            <Input value={d.city} onChange={(e) => setCity(e.target.value)} placeholder="Paris" className="h-8" readOnly={isDemoMode} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Pays</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France" className="h-8" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CardDetailContact;
