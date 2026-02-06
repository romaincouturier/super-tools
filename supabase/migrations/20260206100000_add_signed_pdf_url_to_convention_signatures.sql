-- Add signed_pdf_url column to store the URL of the PDF with the signature overlay
ALTER TABLE public.convention_signatures
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;

COMMENT ON COLUMN public.convention_signatures.signed_pdf_url IS 'URL of the generated PDF with the signature image overlaid on the original document';
