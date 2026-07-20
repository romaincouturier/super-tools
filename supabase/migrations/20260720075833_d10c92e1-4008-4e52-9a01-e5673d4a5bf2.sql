
CREATE POLICY "auth_read_game_restock_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'game-restock-files');
CREATE POLICY "auth_insert_game_restock_files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-restock-files');
CREATE POLICY "auth_update_game_restock_files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'game-restock-files') WITH CHECK (bucket_id = 'game-restock-files');
CREATE POLICY "auth_delete_game_restock_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'game-restock-files');
