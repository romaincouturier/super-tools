import { Check, X } from "lucide-react";
import { validatePassword, PasswordValidation } from "@/lib/passwordValidation";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface CriteriaItemProps {
  met: boolean;
  label: string;
}

const CriteriaItem = ({ met, label }: CriteriaItemProps) => (
  <div className={`flex items-center gap-2 text-sm ${met ? "text-green-600" : "text-muted-foreground"}`}>
    {met ? (
      <Check className="w-4 h-4" />
    ) : (
      <X className="w-4 h-4" />
    )}
    {label}
  </div>
);

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const validation = validatePassword(password);
  
  if (!password) return null;

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded-md space-y-1">
      <p className="text-sm font-medium mb-2">Critères du mot de passe :</p>
      <CriteriaItem met={validation.hasMinLength} label="Au moins 8 caractères" />
      <CriteriaItem met={validation.hasUppercase} label="Au moins une majuscule" />
      <CriteriaItem met={validation.hasLowercase} label="Au moins une minuscule" />
      <CriteriaItem met={validation.hasNumber} label="Au moins un chiffre" />
      <CriteriaItem met={validation.hasSpecialChar} label="Au moins un caractère spécial (!@#$%^&*)" />
    </div>
  );
};

export default PasswordStrengthIndicator;
