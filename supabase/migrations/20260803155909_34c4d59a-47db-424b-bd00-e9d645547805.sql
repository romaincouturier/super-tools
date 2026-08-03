UPDATE public.app_settings
SET setting_value = '1KM2X5wAo0w0ADeXaj3i4e8dPloczG03x,1JjK_Mtb_lUmgZKvAMsrV6PekYUQRfvqd',
    description = 'Dossiers Google Drive scannés pour les transcripts (plusieurs IDs séparés par des virgules)',
    updated_at = now()
WHERE setting_key = 'google_drive_folder_transcripts';