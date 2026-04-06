import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useToast } from "@/hooks/use-toast";
import {
  Scale,
  Save,
  FileText,
  Shield,
  Building,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface LegalPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  version: number;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

const LEGAL_PAGES_CONFIG = [
  { slug: "agb", label: "AGB", icon: FileText },
  { slug: "datenschutz", label: "Datenschutz", icon: Shield },
  { slug: "impressum", label: "Impressum", icon: Building },
];

export default function AdminLegal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("agb");
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});

  const { data: legalPages, isLoading } = useQuery({
    queryKey: ["adminLegalPages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .order("slug");

      if (error) throw error;
      return data as LegalPage[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      slug,
      content,
      isPublished,
    }: {
      slug: string;
      content: string;
      isPublished?: boolean;
    }) => {
      const page = legalPages?.find((p) => p.slug === slug);
      if (!page) throw new Error("Page not found");

      const updateData: Partial<LegalPage> & { updated_at: string } = {
        content,
        version: page.version + 1,
        updated_at: new Date().toISOString(),
      };

      if (typeof isPublished !== "undefined") {
        updateData.is_published = isPublished;
        if (isPublished) {
          updateData.published_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from("legal_pages")
        .update(updateData)
        .eq("slug", slug);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["adminLegalPages"] });
      queryClient.invalidateQueries({ queryKey: ["legalPage", variables.slug] });
      setIsDirty((prev) => ({ ...prev, [variables.slug]: false }));
      toast({
        title: "Gespeichert",
        description: "Die Änderungen wurden erfolgreich gespeichert.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({
      slug,
      isPublished,
    }: {
      slug: string;
      isPublished: boolean;
    }) => {
      const { error } = await supabase
        .from("legal_pages")
        .update({
          is_published: isPublished,
          published_at: isPublished ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", slug);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminLegalPages"] });
      toast({
        title: "Status geändert",
        description: "Der Veröffentlichungsstatus wurde aktualisiert.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Status konnte nicht geändert werden.",
        variant: "destructive",
      });
    },
  });

  const handleContentChange = (slug: string, content: string) => {
    setEditedContent((prev) => ({ ...prev, [slug]: content }));
    setIsDirty((prev) => ({ ...prev, [slug]: true }));
  };

  const handleSave = (slug: string) => {
    const content =
      editedContent[slug] ?? legalPages?.find((p) => p.slug === slug)?.content;
    if (content) {
      updateMutation.mutate({ slug, content });
    }
  };

  const getPageContent = (slug: string) => {
    if (editedContent[slug] !== undefined) {
      return editedContent[slug];
    }
    return legalPages?.find((p) => p.slug === slug)?.content || "";
  };

  const getPage = (slug: string) => {
    return legalPages?.find((p) => p.slug === slug);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Scale className="w-8 h-8 text-primary" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Rechtliche Dokumente</h1>
        </div>
        <Card className="p-6">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Rechtliche Dokumente</h1>
            <p className="text-muted-foreground">
              AGB, Datenschutz und Impressum bearbeiten
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          {LEGAL_PAGES_CONFIG.map((config) => {
            const page = getPage(config.slug);
            return (
              <TabsTrigger
                key={config.slug}
                value={config.slug}
                className="relative"
              >
                <config.icon className="w-4 h-4 mr-2" />
                {config.label}
                {isDirty[config.slug] && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
                )}
                {page && !page.is_published && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Entwurf
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {LEGAL_PAGES_CONFIG.map((config) => {
          const page = getPage(config.slug);
          return (
            <TabsContent key={config.slug} value={config.slug} className="mt-6">
              <div className="space-y-4">
                {/* Meta Info Card */}
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      {/* Version */}
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Version:</span>
                        <Badge variant="outline">{page?.version || 1}</Badge>
                      </div>

                      {/* Last Updated */}
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Zuletzt bearbeitet:
                        </span>
                        <span>
                          {page?.updated_at ? formatDate(page.updated_at) : "-"}
                        </span>
                      </div>

                      {/* Publish Status */}
                      <div className="flex items-center gap-2">
                        {page?.is_published ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">Veröffentlicht</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600">
                            <EyeOff className="w-4 h-4" />
                            <span className="text-sm">Entwurf</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Publish Toggle */}
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`publish-${config.slug}`}
                          checked={page?.is_published ?? true}
                          onCheckedChange={(checked) =>
                            togglePublishMutation.mutate({
                              slug: config.slug,
                              isPublished: checked,
                            })
                          }
                        />
                        <Label
                          htmlFor={`publish-${config.slug}`}
                          className="text-sm"
                        >
                          {page?.is_published ? (
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" /> Sichtbar
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <EyeOff className="w-4 h-4" /> Versteckt
                            </span>
                          )}
                        </Label>
                      </div>

                      {/* Save Button */}
                      <Button
                        onClick={() => handleSave(config.slug)}
                        disabled={
                          !isDirty[config.slug] || updateMutation.isPending
                        }
                        className="gradient-hero"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateMutation.isPending
                          ? "Speichern..."
                          : "Speichern"}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Editor Card */}
                <Card className="p-6">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold">{page?.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      Bearbeiten Sie den Inhalt mit dem Editor unten.
                    </p>
                  </div>
                  <RichTextEditor
                    content={getPageContent(config.slug)}
                    onChange={(content) =>
                      handleContentChange(config.slug, content)
                    }
                  />
                </Card>

                {/* Preview Link */}
                <div className="flex justify-end">
                  <a
                    href={`/${config.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Vorschau auf der Website
                  </a>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
