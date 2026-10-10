export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      abonnements_boutique: {
        Row: {
          boutique_id: string
          cree_le: string
          profil_id: string
          source: string
        }
        Insert: {
          boutique_id: string
          cree_le?: string
          profil_id: string
          source?: string
        }
        Update: {
          boutique_id?: string
          cree_le?: string
          profil_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonnements_boutique_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonnements_boutique_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      appels_ia: {
        Row: {
          date: string
          id: number
          utilisateur_id: string
        }
        Insert: {
          date?: string
          id?: never
          utilisateur_id: string
        }
        Update: {
          date?: string
          id?: never
          utilisateur_id?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          boutique_id: string
          categorie: string
          couleur: string | null
          cree_le: string
          derniere_confirmation: string
          description: string | null
          description_ar: string | null
          genre: Database["public"]["Enums"]["genre_article"]
          id: string
          masque_par_moderation: boolean
          prix: number
          propose_par_ia: boolean
          statut: Database["public"]["Enums"]["statut_article"]
          titre: string
        }
        Insert: {
          boutique_id: string
          categorie: string
          couleur?: string | null
          cree_le?: string
          derniere_confirmation?: string
          description?: string | null
          description_ar?: string | null
          genre?: Database["public"]["Enums"]["genre_article"]
          id?: string
          masque_par_moderation?: boolean
          prix: number
          propose_par_ia?: boolean
          statut?: Database["public"]["Enums"]["statut_article"]
          titre: string
        }
        Update: {
          boutique_id?: string
          categorie?: string
          couleur?: string | null
          cree_le?: string
          derniere_confirmation?: string
          description?: string | null
          description_ar?: string | null
          genre?: Database["public"]["Enums"]["genre_article"]
          id?: string
          masque_par_moderation?: boolean
          prix?: number
          propose_par_ia?: boolean
          statut?: Database["public"]["Enums"]["statut_article"]
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
        ]
      }
      bons: {
        Row: {
          commande_id: string | null
          cree_le: string
          expire_le: string | null
          id: string
          montant: number
          origine: string
          parrainage_id: string | null
          profil_id: string
          releve_id: string | null
          statut: string
          utilise_le: string | null
        }
        Insert: {
          commande_id?: string | null
          cree_le?: string
          expire_le?: string | null
          id?: string
          montant?: number
          origine: string
          parrainage_id?: string | null
          profil_id: string
          releve_id?: string | null
          statut?: string
          utilise_le?: string | null
        }
        Update: {
          commande_id?: string | null
          cree_le?: string
          expire_le?: string | null
          id?: string
          montant?: number
          origine?: string
          parrainage_id?: string | null
          profil_id?: string
          releve_id?: string | null
          statut?: string
          utilise_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_parrainage_id_fkey"
            columns: ["parrainage_id"]
            isOneToOne: false
            referencedRelation: "parrainages"
            referencedColumns: ["filleul_id"]
          },
          {
            foreignKeyName: "bons_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_releve_fkey"
            columns: ["releve_id"]
            isOneToOne: false
            referencedRelation: "releves_bons"
            referencedColumns: ["id"]
          },
        ]
      }
      boutiques: {
        Row: {
          adresse: string | null
          bons_acceptes: boolean
          cree_le: string
          facebook: string | null
          horaires: string | null
          id: string
          instagram: string | null
          latitude: number | null
          longitude: number | null
          nom: string
          quartier: string
          slug: string
          statut: Database["public"]["Enums"]["statut_boutique"]
          ville: string
          whatsapp: string
        }
        Insert: {
          adresse?: string | null
          bons_acceptes?: boolean
          cree_le?: string
          facebook?: string | null
          horaires?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          nom: string
          quartier: string
          slug: string
          statut?: Database["public"]["Enums"]["statut_boutique"]
          ville: string
          whatsapp: string
        }
        Update: {
          adresse?: string | null
          bons_acceptes?: boolean
          cree_le?: string
          facebook?: string | null
          horaires?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          nom?: string
          quartier?: string
          slug?: string
          statut?: Database["public"]["Enums"]["statut_boutique"]
          ville?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "boutiques_ville_fkey"
            columns: ["ville"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["code"]
          },
        ]
      }
      commandes: {
        Row: {
          bon_id: string | null
          boutique_id: string
          client_id: string
          client_nom: string
          client_telephone: string
          confirmee_le: string | null
          contestation_validee_le: string | null
          contestee_le: string | null
          cree_le: string
          expire_le: string | null
          id: string
          langue: string
          mode_remise: string | null
          motif_annulation: string | null
          no_show_annule_le: string | null
          no_show_le: string | null
          note: string | null
          numero: number
          prete_le: string | null
          remise_bon: number
          statut: Database["public"]["Enums"]["statut_commande"]
          telephone_verifie: boolean
          terminee_le: string | null
          total: number
        }
        Insert: {
          bon_id?: string | null
          boutique_id: string
          client_id: string
          client_nom: string
          client_telephone: string
          confirmee_le?: string | null
          contestation_validee_le?: string | null
          contestee_le?: string | null
          cree_le?: string
          expire_le?: string | null
          id?: string
          langue?: string
          mode_remise?: string | null
          motif_annulation?: string | null
          no_show_annule_le?: string | null
          no_show_le?: string | null
          note?: string | null
          numero?: never
          prete_le?: string | null
          remise_bon?: number
          statut?: Database["public"]["Enums"]["statut_commande"]
          telephone_verifie?: boolean
          terminee_le?: string | null
          total?: number
        }
        Update: {
          bon_id?: string | null
          boutique_id?: string
          client_id?: string
          client_nom?: string
          client_telephone?: string
          confirmee_le?: string | null
          contestation_validee_le?: string | null
          contestee_le?: string | null
          cree_le?: string
          expire_le?: string | null
          id?: string
          langue?: string
          mode_remise?: string | null
          motif_annulation?: string | null
          no_show_annule_le?: string | null
          no_show_le?: string | null
          note?: string | null
          numero?: never
          prete_le?: string | null
          remise_bon?: number
          statut?: Database["public"]["Enums"]["statut_commande"]
          telephone_verifie?: boolean
          terminee_le?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "commandes_bon_id_fkey"
            columns: ["bon_id"]
            isOneToOne: false
            referencedRelation: "bons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      contestations: {
        Row: {
          client_id: string
          commande_id: string
          cree_le: string
          motif: string
        }
        Insert: {
          client_id: string
          commande_id: string
          cree_le?: string
          motif: string
        }
        Update: {
          client_id?: string
          commande_id?: string
          cree_le?: string
          motif?: string
        }
        Relationships: [
          {
            foreignKeyName: "contestations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contestations_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: true
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          action: string
          auteur_id: string
          date: string
          id: string
          signalement_id: string
        }
        Insert: {
          action: string
          auteur_id: string
          date?: string
          id?: string
          signalement_id: string
        }
        Update: {
          action?: string
          auteur_id?: string
          date?: string
          id?: string
          signalement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_signalement_id_fkey"
            columns: ["signalement_id"]
            isOneToOne: false
            referencedRelation: "signalements"
            referencedColumns: ["id"]
          },
        ]
      }
      evenements: {
        Row: {
          article_id: string | null
          boutique_id: string
          date: string
          id: number
          taille: string | null
          type: Database["public"]["Enums"]["type_evenement"]
        }
        Insert: {
          article_id?: string | null
          boutique_id: string
          date?: string
          id?: never
          taille?: string | null
          type: Database["public"]["Enums"]["type_evenement"]
        }
        Update: {
          article_id?: string | null
          boutique_id?: string
          date?: string
          id?: never
          taille?: string | null
          type?: Database["public"]["Enums"]["type_evenement"]
        }
        Relationships: [
          {
            foreignKeyName: "evenements_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evenements_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_commande: {
        Row: {
          article_id: string | null
          commande_id: string
          id: string
          prix_unitaire: number
          quantite: number
          taille: string
          titre: string
        }
        Insert: {
          article_id?: string | null
          commande_id: string
          id?: string
          prix_unitaire: number
          quantite: number
          taille: string
          titre: string
        }
        Update: {
          article_id?: string | null
          commande_id?: string
          id?: string
          prix_unitaire?: number
          quantite?: number
          taille?: string
          titre?: string
        }
        Relationships: [
          {
            foreignKeyName: "lignes_commande_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_releve: {
        Row: {
          bon_id: string | null
          boutique_id: string
          client: string
          commande_id: string | null
          id: string
          mode_remise: string
          montant: number
          motif: string | null
          numero_commande: number
          releve_id: string
          remise_le: string
          statut: string
          total_commande: number
        }
        Insert: {
          bon_id?: string | null
          boutique_id: string
          client: string
          commande_id?: string | null
          id?: string
          mode_remise: string
          montant: number
          motif?: string | null
          numero_commande: number
          releve_id: string
          remise_le: string
          statut?: string
          total_commande: number
        }
        Update: {
          bon_id?: string | null
          boutique_id?: string
          client?: string
          commande_id?: string | null
          id?: string
          mode_remise?: string
          montant?: number
          motif?: string | null
          numero_commande?: number
          releve_id?: string
          remise_le?: string
          statut?: string
          total_commande?: number
        }
        Relationships: [
          {
            foreignKeyName: "lignes_releve_bon_id_fkey"
            columns: ["bon_id"]
            isOneToOne: true
            referencedRelation: "bons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_releve_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_releve_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_releve_releve_id_fkey"
            columns: ["releve_id"]
            isOneToOne: false
            referencedRelation: "releves_bons"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_whatsapp: {
        Row: {
          commande_id: string | null
          cree_le: string
          destinataire: string
          envoye_le: string | null
          erreur: string | null
          id: string
          identifiant_fournisseur: string | null
          langue: string
          modele: string
          parametres: Json
          reservation: string | null
          reserve_jusqu_a: string | null
          statut: Database["public"]["Enums"]["statut_message_whatsapp"]
          tentatives: number
          texte: string
        }
        Insert: {
          commande_id?: string | null
          cree_le?: string
          destinataire: string
          envoye_le?: string | null
          erreur?: string | null
          id?: string
          identifiant_fournisseur?: string | null
          langue?: string
          modele: string
          parametres?: Json
          reservation?: string | null
          reserve_jusqu_a?: string | null
          statut?: Database["public"]["Enums"]["statut_message_whatsapp"]
          tentatives?: number
          texte: string
        }
        Update: {
          commande_id?: string | null
          cree_le?: string
          destinataire?: string
          envoye_le?: string | null
          erreur?: string | null
          id?: string
          identifiant_fournisseur?: string | null
          langue?: string
          modele?: string
          parametres?: Json
          reservation?: string | null
          reserve_jusqu_a?: string | null
          statut?: Database["public"]["Enums"]["statut_message_whatsapp"]
          tentatives?: number
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_whatsapp_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      parrainages: {
        Row: {
          boutique_id: string | null
          commande_id: string | null
          cree_le: string
          filleul_id: string
          modifie_le: string
          motif: string | null
          parrain_id: string | null
          saisies: number
          statut: string
          valide_le: string | null
        }
        Insert: {
          boutique_id?: string | null
          commande_id?: string | null
          cree_le?: string
          filleul_id: string
          modifie_le?: string
          motif?: string | null
          parrain_id?: string | null
          saisies?: number
          statut?: string
          valide_le?: string | null
        }
        Update: {
          boutique_id?: string | null
          commande_id?: string | null
          cree_le?: string
          filleul_id?: string
          modifie_le?: string
          motif?: string | null
          parrain_id?: string | null
          saisies?: number
          statut?: string
          valide_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parrainages_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parrainages_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parrainages_filleul_id_fkey"
            columns: ["filleul_id"]
            isOneToOne: true
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parrainages_parrain_id_fkey"
            columns: ["parrain_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          adresse: string
          adresse_vignette: string | null
          article_id: string
          id: string
          ordre: number
        }
        Insert: {
          adresse: string
          adresse_vignette?: string | null
          article_id: string
          id?: string
          ordre?: number
        }
        Update: {
          adresse?: string
          adresse_vignette?: string | null
          article_id?: string
          id?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "photos_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      profils: {
        Row: {
          bloque: boolean
          bloque_le: string | null
          bloque_par_admin: boolean
          boutique_id: string | null
          code_parrainage: string | null
          cree_le: string
          id: string
          no_shows: number
          nom: string | null
          parrainage_exclu: boolean
          role: Database["public"]["Enums"]["role_utilisateur"]
          telephone: string | null
          telephone_verifie_le: string | null
          ville: string | null
        }
        Insert: {
          bloque?: boolean
          bloque_le?: string | null
          bloque_par_admin?: boolean
          boutique_id?: string | null
          code_parrainage?: string | null
          cree_le?: string
          id: string
          no_shows?: number
          nom?: string | null
          parrainage_exclu?: boolean
          role?: Database["public"]["Enums"]["role_utilisateur"]
          telephone?: string | null
          telephone_verifie_le?: string | null
          ville?: string | null
        }
        Update: {
          bloque?: boolean
          bloque_le?: string | null
          bloque_par_admin?: boolean
          boutique_id?: string | null
          code_parrainage?: string | null
          cree_le?: string
          id?: string
          no_shows?: number
          nom?: string | null
          parrainage_exclu?: boolean
          role?: Database["public"]["Enums"]["role_utilisateur"]
          telephone?: string | null
          telephone_verifie_le?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profils_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profils_ville_fkey"
            columns: ["ville"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["code"]
          },
        ]
      }
      promos: {
        Row: {
          article_id: string
          badge: string | null
          date_fin: string
          prix_promo: number
        }
        Insert: {
          article_id: string
          badge?: string | null
          date_fin: string
          prix_promo: number
        }
        Update: {
          article_id?: string
          badge?: string | null
          date_fin?: string
          prix_promo?: number
        }
        Relationships: [
          {
            foreignKeyName: "promos_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      releves_bons: {
        Row: {
          boutique_id: string
          cloture_le: string | null
          cree_le: string
          id: string
          mois: string
          montant: number
          nombre: number
          paye_le: string | null
          paye_par: string | null
          reference_paiement: string | null
          statut: string
        }
        Insert: {
          boutique_id: string
          cloture_le?: string | null
          cree_le?: string
          id?: string
          mois: string
          montant?: number
          nombre?: number
          paye_le?: string | null
          paye_par?: string | null
          reference_paiement?: string | null
          statut?: string
        }
        Update: {
          boutique_id?: string
          cloture_le?: string | null
          cree_le?: string
          id?: string
          mois?: string
          montant?: number
          nombre?: number
          paye_le?: string | null
          paye_par?: string | null
          reference_paiement?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "releves_bons_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releves_bons_paye_par_fkey"
            columns: ["paye_par"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements: {
        Row: {
          article_id: string
          commentaire: string | null
          cree_le: string
          id: string
          motif: string
          statut: Database["public"]["Enums"]["statut_signalement"]
        }
        Insert: {
          article_id: string
          commentaire?: string | null
          cree_le?: string
          id?: string
          motif: string
          statut?: Database["public"]["Enums"]["statut_signalement"]
        }
        Update: {
          article_id?: string
          commentaire?: string | null
          cree_le?: string
          id?: string
          motif?: string
          statut?: Database["public"]["Enums"]["statut_signalement"]
        }
        Relationships: [
          {
            foreignKeyName: "signalements_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      suivi_commandes: {
        Row: {
          auteur: string
          auteur_id: string | null
          commande_id: string
          date: string
          id: number
          note: string | null
          statut: Database["public"]["Enums"]["statut_commande"]
        }
        Insert: {
          auteur: string
          auteur_id?: string | null
          commande_id: string
          date?: string
          id?: never
          note?: string | null
          statut: Database["public"]["Enums"]["statut_commande"]
        }
        Update: {
          auteur?: string
          auteur_id?: string | null
          commande_id?: string
          date?: string
          id?: never
          note?: string | null
          statut?: Database["public"]["Enums"]["statut_commande"]
        }
        Relationships: [
          {
            foreignKeyName: "suivi_commandes_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivi_commandes_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      tailles: {
        Row: {
          article_id: string
          disponible: boolean
          id: string
          libelle: string
          quantite: number
        }
        Insert: {
          article_id: string
          disponible?: boolean
          id?: string
          libelle: string
          quantite?: number
        }
        Update: {
          article_id?: string
          disponible?: boolean
          id?: string
          libelle?: string
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "tailles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      villes: {
        Row: {
          centre_lat: number
          centre_lng: number
          code: string
          cree_le: string
          lat_max: number
          lat_min: number
          lng_max: number
          lng_min: number
          nom: string
          nom_ar: string
          numero_wilaya: number | null
          ordre: number
          ouverte: boolean
          pays: string
          zoom: number
        }
        Insert: {
          centre_lat: number
          centre_lng: number
          code: string
          cree_le?: string
          lat_max: number
          lat_min: number
          lng_max: number
          lng_min: number
          nom: string
          nom_ar: string
          numero_wilaya?: number | null
          ordre?: number
          ouverte?: boolean
          pays?: string
          zoom?: number
        }
        Update: {
          centre_lat?: number
          centre_lng?: number
          code?: string
          cree_le?: string
          lat_max?: number
          lat_min?: number
          lng_max?: number
          lng_min?: number
          nom?: string
          nom_ar?: string
          numero_wilaya?: number | null
          ordre?: number
          ouverte?: boolean
          pays?: string
          zoom?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abonnes_boutique: { Args: never; Returns: Json }
      annuler_bons_parrainage: {
        Args: { filleul: string; motif: string }
        Returns: number
      }
      annuler_no_show: { Args: { commande: string }; Returns: undefined }
      bloquer_client: { Args: { client: string }; Returns: undefined }
      boutiques_carte: {
        Args: { code_ville?: string; limite?: number }
        Returns: {
          id: string
          latitude: number
          longitude: number
          nom: string
          promos_en_cours: number
          quartier: string
          rayons: Json
          slug: string
        }[]
      }
      budget_parrainage: { Args: { mois?: string }; Returns: Json }
      changer_statut_commande: {
        Args: {
          commande: string
          motif?: string
          note?: string
          statut: Database["public"]["Enums"]["statut_commande"]
        }
        Returns: undefined
      }
      choisir_parrain: { Args: { saisie: string }; Returns: string }
      commande_a_confirmer: {
        Args: { commande: string; jeton: string }
        Returns: Json
      }
      confirmer_commande_par_lien: {
        Args: { commande: string; jeton: string }
        Returns: string
      }
      consommer_quota_ia: { Args: never; Returns: boolean }
      contester_no_show: {
        Args: { commande: string; motif: string }
        Returns: undefined
      }
      controler_envoi_code: {
        Args: { jeton: string; numero: string }
        Returns: undefined
      }
      debloquer_client: { Args: { client: string }; Returns: undefined }
      decider_ligne: {
        Args: { decision: string; ligne: string; motif: string }
        Returns: undefined
      }
      declarer_no_show: { Args: { commande: string }; Returns: undefined }
      definir_langue_commande: {
        Args: { commande: string; langue: string }
        Returns: undefined
      }
      enregistrer_envoi_code: {
        Args: { jeton: string; numero: string }
        Returns: undefined
      }
      enregistrer_evenement: {
        Args: {
          article?: string
          boutique: string
          jeton: string
          taille?: string
          type: Database["public"]["Enums"]["type_evenement"]
          visiteur: string
        }
        Returns: boolean
      }
      exclure_parrainage: {
        Args: { exclu: boolean; profil: string }
        Returns: undefined
      }
      jeton_retrait_envoi: {
        Args: { commande: string; jeton: string }
        Returns: string
      }
      marquer_releve_paye: {
        Args: { paye_le: string; reference: string; releve: string }
        Returns: undefined
      }
      mes_bons: { Args: never; Returns: Json }
      messages_whatsapp_commande: {
        Args: { commande: string }
        Returns: {
          destinataire: string
          id: string
          modele: string
          parametres: Json
          reservation: string
          texte: string
        }[]
      }
      messages_whatsapp_en_attente: {
        Args: { jeton: string; limite?: number }
        Returns: {
          destinataire: string
          id: string
          modele: string
          parametres: Json
          reservation: string
          texte: string
        }[]
      }
      mettre_de_cote: {
        Args: { ligne: string; motif: string }
        Returns: undefined
      }
      mon_code_parrainage: { Args: never; Returns: string }
      mon_parrainage: { Args: never; Returns: Json }
      ne_plus_suivre: { Args: { boutique: string }; Returns: boolean }
      parrainage_ouvert: { Args: never; Returns: boolean }
      passer_commande: {
        Args: { boutique: string; lignes: Json; note?: string }
        Returns: string
      }
      rattacher_commercant: {
        Args: { boutique: string; email_commercant: string }
        Returns: undefined
      }
      regler_budget_parrainage: {
        Args: { montant: number }
        Returns: undefined
      }
      remettre_commande: {
        Args: { code?: string; jeton?: string }
        Returns: Json
      }
      resultat_message_whatsapp: {
        Args: {
          definitif?: boolean
          erreur?: string
          identifiant?: string
          jeton: string
          message: string
          reservation: string
          succes: boolean
        }
        Returns: undefined
      }
      retirer_boutique_des_bons: {
        Args: { boutique: string; retiree: boolean }
        Returns: undefined
      }
      retrait_boutique: {
        Args: { code?: string; jeton?: string }
        Returns: Json
      }
      retrait_client: {
        Args: { commande: string }
        Returns: {
          code: string
          jeton: string
        }[]
      }
      retrait_par_lien: { Args: { jeton: string }; Returns: Json }
      signaler_article: {
        Args: {
          article: string
          commentaire?: string
          jeton: string
          motif: string
          visiteur: string
        }
        Returns: undefined
      }
      suivre_boutique: { Args: { boutique: string }; Returns: boolean }
      utiliser_bon: { Args: { commande: string }; Returns: string }
      valider_no_show: { Args: { commande: string }; Returns: undefined }
      villes_ouvertes: {
        Args: never
        Returns: {
          boutiques: number
          centre_lat: number
          centre_lng: number
          code: string
          lat_max: number
          lat_min: number
          lng_max: number
          lng_min: number
          nom: string
          nom_ar: string
          pays: string
          zoom: number
        }[]
      }
    }
    Enums: {
      genre_article: "homme" | "femme" | "enfant" | "mixte"
      role_utilisateur: "commercant" | "ambassadeur" | "admin" | "client"
      statut_article: "disponible" | "reserve" | "vendu" | "masque"
      statut_boutique: "en_attente" | "validee" | "suspendue"
      statut_commande:
        | "demandee"
        | "confirmee"
        | "prete"
        | "recuperee"
        | "annulee"
        | "expiree"
      statut_message_whatsapp: "a_envoyer" | "envoye" | "echec"
      statut_signalement: "ouvert" | "traite" | "rejete"
      type_evenement:
        | "vue_article"
        | "vue_boutique"
        | "clic_reserver"
        | "partage"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      genre_article: ["homme", "femme", "enfant", "mixte"],
      role_utilisateur: ["commercant", "ambassadeur", "admin", "client"],
      statut_article: ["disponible", "reserve", "vendu", "masque"],
      statut_boutique: ["en_attente", "validee", "suspendue"],
      statut_commande: [
        "demandee",
        "confirmee",
        "prete",
        "recuperee",
        "annulee",
        "expiree",
      ],
      statut_message_whatsapp: ["a_envoyer", "envoye", "echec"],
      statut_signalement: ["ouvert", "traite", "rejete"],
      type_evenement: [
        "vue_article",
        "vue_boutique",
        "clic_reserver",
        "partage",
      ],
    },
  },
} as const
