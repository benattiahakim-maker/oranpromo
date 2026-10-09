-- US-20.2 : rôle « client » pour les comptes qui commandent.
-- Fichier séparé : une nouvelle valeur d'enum ne peut pas être utilisée dans la transaction qui la crée.
alter type role_utilisateur add value if not exists 'client';
