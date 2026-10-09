-- US-11 : supprimer une photo via l'API Storage exige aussi le droit de lecture sur l'objet.
create policy "commerçant lit ses photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = prive.ma_boutique()::text);
