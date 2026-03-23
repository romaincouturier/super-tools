import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSenderFrom, getSenderEmail, getSenderName, getBccList } from "../_shared/email-settings.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton } from "../_shared/templates.ts";

import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODULE_LABELS: Record<string, string> = {
  micro_devis: "Micro-devis",
  formations: "Formations",
  evaluations: "Évaluations",
  certificates: "Certificats",
  ameliorations: "Améliorations",
  historique: "Historique",
  contenu: "Contenu",
  besoins: "Besoins participants",
};

// Generate a strong temporary password
function generateTempPassword(): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  
  let password = "";
  
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining characters (16 total)
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

interface RequestBody {
  email: string;
  firstName?: string;
  lastName?: string;
  modules?: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated and is the admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Non autorisé");
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify calling user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !callingUser) {
      throw new Error("Non autorisé");
    }
    
    const adminEmail = await getSenderEmail();
    if (callingUser.email?.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new Error(`Seul ${adminEmail} peut créer des comptes collaborateurs`);
    }

    const { email, firstName, lastName, modules = [] }: RequestBody = await req.json();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email invalide");
    }

    if (!modules || modules.length === 0) {
      throw new Error("Veuillez sélectionner au moins un module");
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (userExists) {
      throw new Error("Un compte existe déjà pour cet email");
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (createError || !newUser.user) {
      console.error("Create user error:", createError);
      throw new Error("Erreur lors de la création du compte");
    }

    // Create security metadata to force password change
    const { error: metaError } = await supabaseClient
      .from("user_security_metadata")
      .insert({
        user_id: newUser.user.id,
        must_change_password: true,
      });

    if (metaError) {
      console.error("Metadata creation error:", metaError);
      // Don't fail the whole operation, but log it
    }

    // Create module access entries
    const moduleAccessEntries = modules.map((module: string) => ({
      user_id: newUser.user.id,
      module: module,
      granted_by: callingUser.id,
    }));

    const { error: accessError } = await supabaseClient
      .from("user_module_access")
      .insert(moduleAccessEntries);

    if (accessError) {
      console.error("Module access creation error:", accessError);
      // Don't fail the whole operation, but log it
    }

    // Create profile for the user with first/last name
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        email: email,
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: firstName && lastName ? `${firstName} ${lastName}` : null,
      });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Don't fail the whole operation, but log it
    }

    // Build module list for email
    const moduleListHtml = modules
      .map((m: string) => `<li>${MODULE_LABELS[m] || m}</li>`)
      .join("");

    // Send welcome email with temporary password
    const APP_URL = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";
    
    const [senderFrom, senderName, bccList] = await Promise.all([getSenderFrom(), getSenderName(), getBccList()]);
    const emailResult = await sendEmail({
      from: senderFrom,
      to: [email],
      bcc: bccList,
      subject: "Bienvenue sur SuperTools - Vos identifiants de connexion",
      html: `
        <h1>Bienvenue sur SuperTools !</h1>
        <p>SuperTools est l'outil interne de Supertilt pour gérer les formations, évaluations et contenus marketing.</p>
        <p><strong>Accès à l'application :</strong> <a href="${APP_URL}" style="color: #e6bc00;">${APP_URL}</a></p>
        
        <h2>Vos identifiants de connexion</h2>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Mot de passe temporaire :</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
        <p style="color: #e74c3c;"><strong>Important :</strong> Vous devrez changer ce mot de passe lors de votre première connexion.</p>
        
        <h2>Vos accès</h2>
        <p>Vous avez accès aux modules suivants :</p>
        <ul>${moduleListHtml}</ul>
        
        ${emailButton("Se connecter à SuperTools", `${APP_URL}/auth`)}
        
        <p>Le nouveau mot de passe doit respecter les critères suivants :</p>
        <ul>
          <li>Au moins 8 caractères</li>
          <li>Au moins une lettre majuscule</li>
          <li>Au moins une lettre minuscule</li>
          <li>Au moins un chiffre</li>
          <li>Au moins un caractère spécial (!@#$%^&*)</li>
        </ul>
        <p>À bientôt sur SuperTools !</p>
        <p>--<br>
        <strong>${senderName}</strong><br>
        Supertilt</p>
      `,
      _emailType: "onboard_collaborator",
    });

    if (!emailResult.success) {
      throw new Error("Le compte a été créé mais l'email n'a pas pu être envoyé");
    }

    console.log(`Collaborator onboarded successfully: ${email} with modules: ${modules.join(", ")}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Compte créé avec succès. Un email a été envoyé à ${email} avec les identifiants de connexion.` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Onboard collaborator error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur est survenue" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
