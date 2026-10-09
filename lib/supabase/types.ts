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
      boutiques: {
        Row: {
          adresse: string | null
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
          whatsapp: string
        }
        Insert: {
          adresse?: string | null
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
          whatsapp: string
        }
        Update: {
          adresse?: string | null
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
          whatsapp?: string
        }
        Relationships: []
      }
      commandes: {
        Row: {
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
          motif_annulation: string | null
          no_show_annule_le: string | null
          no_show_le: string | null
          note: string | null
          numero: number
          prete_le: string | null
          statut: Database["public"]["Enums"]["statut_commande"]
          telephone_verifie: boolean
          terminee_le: string | null
          total: number
        }
        Insert: {
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
          motif_annulation?: string | null
          no_show_annule_le?: string | null
          no_show_le?: string | null
          note?: string | null
          numero?: never
          prete_le?: string | null
          statut?: Database["public"]["Enums"]["statut_commande"]
          telephone_verifie?: boolean
          terminee_le?: string | null
          total?: number
        }
        Update: {
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
          motif_annulation?: string | null
          no_show_annule_le?: string | null
          no_show_le?: string | null
          note?: string | null
          numero?: never
          prete_le?: string | null
          statut?: Database["public"]["Enums"]["statut_commande"]
          telephone_verifie?: boolean
          terminee_le?: string | null
          total?: number
        }
        Relationships: [
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
          cree_le: string
          id: string
          no_shows: number
          nom: string | null
          role: Database["public"]["Enums"]["role_utilisateur"]
          telephone: string | null
          telephone_verifie_le: string | null
        }
        Insert: {
          bloque?: boolean
          bloque_le?: string | null
          bloque_par_admin?: boolean
          boutique_id?: string | null
          cree_le?: string
          id: string
          no_shows?: number
          nom?: string | null
          role?: Database["public"]["Enums"]["role_utilisateur"]
          telephone?: string | null
          telephone_verifie_le?: string | null
        }
        Update: {
          bloque?: boolean
          bloque_le?: string | null
          bloque_par_admin?: boolean
          boutique_id?: string | null
          cree_le?: string
          id?: string
          no_shows?: number
          nom?: string | null
          role?: Database["public"]["Enums"]["role_utilisateur"]
          telephone?: string | null
          telephone_verifie_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profils_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      annuler_no_show: { Args: { commande: string }; Returns: undefined }
      bloquer_client: { Args: { client: string }; Returns: undefined }
      changer_statut_commande: {
        Args: {
          commande: string
          motif?: string
          note?: string
          statut: Database["public"]["Enums"]["statut_commande"]
        }
        Returns: undefined
      }
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
      passer_commande: {
        Args: { boutique: string; lignes: Json; note?: string }
        Returns: string
      }
      rattacher_commercant: {
        Args: { boutique: string; email_commercant: string }
        Returns: undefined
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
      valider_no_show: { Args: { commande: string }; Returns: undefined }
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
