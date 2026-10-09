// Types générés depuis la base Supabase. Ne pas modifier à la main :
// après chaque migration, régénérer avec `npm run db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      articles: {
        Row: {
          boutique_id: string;
          categorie: string;
          couleur: string | null;
          cree_le: string;
          derniere_confirmation: string;
          description: string | null;
          description_ar: string | null;
          genre: Database["public"]["Enums"]["genre_article"];
          id: string;
          masque_par_moderation: boolean;
          prix: number;
          propose_par_ia: boolean;
          statut: Database["public"]["Enums"]["statut_article"];
          titre: string;
        };
        Insert: {
          boutique_id: string;
          categorie: string;
          couleur?: string | null;
          cree_le?: string;
          derniere_confirmation?: string;
          description?: string | null;
          description_ar?: string | null;
          genre?: Database["public"]["Enums"]["genre_article"];
          id?: string;
          masque_par_moderation?: boolean;
          prix: number;
          propose_par_ia?: boolean;
          statut?: Database["public"]["Enums"]["statut_article"];
          titre: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "articles_boutique_id_fkey";
            columns: ["boutique_id"];
            isOneToOne: false;
            referencedRelation: "boutiques";
            referencedColumns: ["id"];
          },
        ];
      };
      boutiques: {
        Row: {
          adresse: string | null;
          cree_le: string;
          facebook: string | null;
          horaires: string | null;
          id: string;
          instagram: string | null;
          latitude: number | null;
          longitude: number | null;
          nom: string;
          quartier: string;
          slug: string;
          statut: Database["public"]["Enums"]["statut_boutique"];
          whatsapp: string;
        };
        Insert: {
          adresse?: string | null;
          cree_le?: string;
          facebook?: string | null;
          horaires?: string | null;
          id?: string;
          instagram?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          nom: string;
          quartier: string;
          slug: string;
          statut?: Database["public"]["Enums"]["statut_boutique"];
          whatsapp: string;
        };
        Update: Partial<Database["public"]["Tables"]["boutiques"]["Insert"]>;
        Relationships: [];
      };
      commandes: {
        Row: {
          boutique_id: string;
          client_id: string;
          client_nom: string;
          client_telephone: string;
          confirmee_le: string | null;
          cree_le: string;
          expire_le: string | null;
          id: string;
          motif_annulation: string | null;
          note: string | null;
          numero: number;
          prete_le: string | null;
          statut: Database["public"]["Enums"]["statut_commande"];
          terminee_le: string | null;
          total: number;
        };
        Insert: {
          boutique_id: string;
          client_id: string;
          client_nom: string;
          client_telephone: string;
          confirmee_le?: string | null;
          cree_le?: string;
          expire_le?: string | null;
          id?: string;
          motif_annulation?: string | null;
          note?: string | null;
          prete_le?: string | null;
          statut?: Database["public"]["Enums"]["statut_commande"];
          terminee_le?: string | null;
          total?: number;
        };
        Update: Partial<Database["public"]["Tables"]["commandes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "commandes_boutique_id_fkey";
            columns: ["boutique_id"];
            isOneToOne: false;
            referencedRelation: "boutiques";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commandes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profils";
            referencedColumns: ["id"];
          },
        ];
      };
      decisions: {
        Row: { action: string; auteur_id: string; date: string; id: string; signalement_id: string };
        Insert: { action: string; auteur_id: string; date?: string; id?: string; signalement_id: string };
        Update: Partial<Database["public"]["Tables"]["decisions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "decisions_auteur_id_fkey";
            columns: ["auteur_id"];
            isOneToOne: false;
            referencedRelation: "profils";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_signalement_id_fkey";
            columns: ["signalement_id"];
            isOneToOne: false;
            referencedRelation: "signalements";
            referencedColumns: ["id"];
          },
        ];
      };
      evenements: {
        Row: {
          article_id: string | null;
          boutique_id: string;
          date: string;
          id: number;
          taille: string | null;
          type: Database["public"]["Enums"]["type_evenement"];
        };
        Insert: {
          article_id?: string | null;
          boutique_id: string;
          date?: string;
          id?: never;
          taille?: string | null;
          type: Database["public"]["Enums"]["type_evenement"];
        };
        Update: Partial<Database["public"]["Tables"]["evenements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "evenements_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evenements_boutique_id_fkey";
            columns: ["boutique_id"];
            isOneToOne: false;
            referencedRelation: "boutiques";
            referencedColumns: ["id"];
          },
        ];
      };
      lignes_commande: {
        Row: { article_id: string | null; commande_id: string; id: string; prix_unitaire: number; quantite: number; taille: string; titre: string };
        Insert: { article_id?: string | null; commande_id: string; id?: string; prix_unitaire: number; quantite: number; taille: string; titre: string };
        Update: Partial<Database["public"]["Tables"]["lignes_commande"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lignes_commande_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lignes_commande_commande_id_fkey";
            columns: ["commande_id"];
            isOneToOne: false;
            referencedRelation: "commandes";
            referencedColumns: ["id"];
          },
        ];
      };
      photos: {
        Row: { adresse: string; adresse_vignette: string | null; article_id: string; id: string; ordre: number };
        Insert: { adresse: string; adresse_vignette?: string | null; article_id: string; id?: string; ordre?: number };
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "photos_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      profils: {
        Row: {
          bloque: boolean;
          bloque_le: string | null;
          boutique_id: string | null;
          cree_le: string;
          id: string;
          no_shows: number;
          nom: string | null;
          role: Database["public"]["Enums"]["role_utilisateur"];
          telephone: string | null;
        };
        Insert: {
          bloque?: boolean;
          bloque_le?: string | null;
          boutique_id?: string | null;
          cree_le?: string;
          id: string;
          no_shows?: number;
          nom?: string | null;
          role?: Database["public"]["Enums"]["role_utilisateur"];
          telephone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profils"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "profils_boutique_id_fkey";
            columns: ["boutique_id"];
            isOneToOne: false;
            referencedRelation: "boutiques";
            referencedColumns: ["id"];
          },
        ];
      };
      promos: {
        Row: { article_id: string; badge: string | null; date_fin: string; prix_promo: number };
        Insert: { article_id: string; badge?: string | null; date_fin: string; prix_promo: number };
        Update: Partial<Database["public"]["Tables"]["promos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "promos_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      signalements: {
        Row: {
          article_id: string;
          commentaire: string | null;
          cree_le: string;
          id: string;
          motif: string;
          statut: Database["public"]["Enums"]["statut_signalement"];
        };
        Insert: {
          article_id: string;
          commentaire?: string | null;
          cree_le?: string;
          id?: string;
          motif: string;
          statut?: Database["public"]["Enums"]["statut_signalement"];
        };
        Update: Partial<Database["public"]["Tables"]["signalements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "signalements_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      suivi_commandes: {
        Row: { auteur: string; auteur_id: string | null; commande_id: string; date: string; id: number; note: string | null; statut: Database["public"]["Enums"]["statut_commande"] };
        Insert: { auteur: string; auteur_id?: string | null; commande_id: string; date?: string; id?: never; note?: string | null; statut: Database["public"]["Enums"]["statut_commande"] };
        Update: Partial<Database["public"]["Tables"]["suivi_commandes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "suivi_commandes_commande_id_fkey";
            columns: ["commande_id"];
            isOneToOne: false;
            referencedRelation: "commandes";
            referencedColumns: ["id"];
          },
        ];
      };
      tailles: {
        Row: { article_id: string; disponible: boolean; id: string; libelle: string; quantite: number };
        Insert: { article_id: string; disponible?: boolean; id?: string; libelle: string; quantite?: number };
        Update: Partial<Database["public"]["Tables"]["tailles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tailles_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      changer_statut_commande: {
        Args: { commande: string; motif?: string | null; note?: string | null; statut: Database["public"]["Enums"]["statut_commande"] };
        Returns: undefined;
      };
      consommer_quota_ia: {
        Args: never;
        Returns: boolean;
      };
      debloquer_client: {
        Args: { client: string };
        Returns: undefined;
      };
      passer_commande: {
        Args: { boutique: string; lignes: Json; note?: string | null };
        Returns: string;
      };
      rattacher_commercant: {
        Args: { boutique: string; email_commercant: string };
        Returns: undefined;
      };
    };
    Enums: {
      genre_article: "homme" | "femme" | "enfant" | "mixte";
      role_utilisateur: "commercant" | "ambassadeur" | "admin" | "client";
      statut_article: "disponible" | "reserve" | "vendu" | "masque";
      statut_commande: "demandee" | "confirmee" | "prete" | "recuperee" | "annulee" | "expiree";
      statut_boutique: "en_attente" | "validee" | "suspendue";
      statut_signalement: "ouvert" | "traite" | "rejete";
      type_evenement: "vue_article" | "vue_boutique" | "clic_reserver" | "partage";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type Public = Database["public"];

/** Ligne d'une table : Tables<"articles"> */
export type Tables<T extends keyof Public["Tables"]> = Public["Tables"][T]["Row"];
/** Données d'insertion : TablesInsert<"articles"> */
export type TablesInsert<T extends keyof Public["Tables"]> = Public["Tables"][T]["Insert"];
/** Données de mise à jour : TablesUpdate<"articles"> */
export type TablesUpdate<T extends keyof Public["Tables"]> = Public["Tables"][T]["Update"];
/** Valeurs d'une énumération : Enums<"statut_article"> */
export type Enums<T extends keyof Public["Enums"]> = Public["Enums"][T];
