import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";

interface AGBDialogProps {
  children: React.ReactNode;
}

export const AGBDialog = ({ children }: AGBDialogProps) => {
  const [open, setOpen] = useState(false);

  const { data: legalPage, isLoading } = useQuery({
    queryKey: ["legalPage", "agb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("slug", "agb")
        .eq("is_published", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open, // Only fetch when dialog opens
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {legalPage?.title || "Allgemeine Geschäftsbedingungen"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[65vh] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-6 w-1/2 mt-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(legalPage?.content || ""),
              }}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
