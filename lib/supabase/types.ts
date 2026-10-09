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
          boutique_id: string | null;
          cree_le: string;
          id: string;
          role: Database["public"]["Enums"]["role_utilisateur"];
          telephone: string | null;
        };
        Insert: {
          boutique_id?: string | null;
          cree_le?: string;
          id: string;
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
      tailles: {
        Row: { article_id: string; disponible: boolean; id: string; libelle: string };
        Insert: { article_id: string; disponible?: boolean; id?: string; libelle: string };
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
      rattacher_commercant: {
        Args: { boutique: string; email_commercant: string };
        Returns: undefined;
      };
    };
    Enums: {
      genre_article: "homme" | "femme" | "enfant" | "mixte";
      role_utilisateur: "commercant" | "ambassadeur" | "admin";
      statut_article: "disponible" | "reserve" | "vendu" | "masque";
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
