/**
 * Dealer Rating Component
 * Displays and manages dealer ratings and reviews
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DealerRatingProps {
  dealerId: string;
  auctionId?: string;
  variant?: 'display' | 'form';
  showReviewForm?: boolean;
}

interface ReviewForm {
  rating: number;
  title: string;
  comment: string;
  communication_rating: number;
  reliability_rating: number;
  professionalism_rating: number;
}

export const DealerRating = ({ 
  dealerId, 
  auctionId,
  variant = 'display',
  showReviewForm = false 
}: DealerRatingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewForm>({
    rating: 5,
    title: '',
    comment: '',
    communication_rating: 5,
    reliability_rating: 5,
    professionalism_rating: 5,
  });

  // Fetch dealer rating summary
  const { data: ratingSummary } = useQuery({
    queryKey: ['dealer-rating-summary', dealerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealer_rating_summary')
        .select('*')
        .eq('dealer_id', dealerId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch dealer reviews
  const { data: reviews } = useQuery({
    queryKey: ['dealer-reviews', dealerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealer_reviews')
        .select(`
          *,
          reviewer:profiles(first_name, last_name, company_name),
          response:review_responses(response_text, created_at)
        `)
        .eq('dealer_id', dealerId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: ReviewForm) => {
      const { error } = await supabase
        .from('dealer_reviews')
        .insert({
          dealer_id: dealerId,
          reviewer_id: user!.id,
          auction_id: auctionId,
          rating: reviewData.rating,
          title: reviewData.title,
          comment: reviewData.comment,
          communication_rating: reviewData.communication_rating,
          reliability_rating: reviewData.reliability_rating,
          professionalism_rating: reviewData.professionalism_rating,
          status: 'pending', // Requires admin approval
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealer-reviews', dealerId] });
      setIsReviewDialogOpen(false);
      setReviewForm({
        rating: 5,
        title: '',
        comment: '',
        communication_rating: 5,
        reliability_rating: 5,
        professionalism_rating: 5,
      });
      toast({
        title: 'Bewertung eingereicht',
        description: 'Ihre Bewertung wird geprüft und dann veröffentlicht',
      });
    },
  });

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 cursor-pointer transition-colors ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
            onClick={() => interactive && onRatingChange?.(star)}
          />
        ))}
      </div>
    );
  };

  const handleSubmitReview = () => {
    if (!reviewForm.comment.trim()) {
      toast({
        title: 'Kommentar erforderlich',
        description: 'Bitte geben Sie einen Kommentar zu Ihrer Bewertung ab',
        variant: 'destructive',
      });
      return;
    }
    
    submitReviewMutation.mutate(reviewForm);
  };

  if (variant === 'display') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Händlerbewertungen
          </CardTitle>
          {ratingSummary && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {renderStars(Math.round(ratingSummary.average_rating))}
                <span className="font-bold text-lg">{ratingSummary.average_rating.toFixed(1)}</span>
              </div>
              <Badge variant="outline">
                {ratingSummary.total_reviews} Bewertung{ratingSummary.total_reviews !== 1 ? 'en' : ''}
              </Badge>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {/* Rating Breakdown */}
          {ratingSummary && ratingSummary.total_reviews > 0 && (
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-medium">Kommunikation</div>
                  <div className="text-muted-foreground">
                    {ratingSummary.avg_communication.toFixed(1)}/5
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-medium">Zuverlässigkeit</div>
                  <div className="text-muted-foreground">
                    {ratingSummary.avg_reliability.toFixed(1)}/5
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-medium">Professionalität</div>
                  <div className="text-muted-foreground">
                    {ratingSummary.avg_professionalism.toFixed(1)}/5
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews?.map((review: any) => (
              <div key={review.id} className="border-b pb-4 last:border-b-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {renderStars(review.rating)}
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(review.created_at), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {review.reviewer.company_name || 
                     `${review.reviewer.first_name} ${review.reviewer.last_name}`}
                  </Badge>
                </div>
                
                {review.title && (
                  <h4 className="font-medium mb-2">{review.title}</h4>
                )}
                
                <p className="text-sm text-muted-foreground mb-3">
                  {review.comment}
                </p>
                
                {/* Dealer Response */}
                {review.response && (
                  <div className="bg-muted/50 p-3 rounded-lg mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Antwort des Händlers</span>
                    </div>
                    <p className="text-sm">{review.response.response_text}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(review.response.created_at), 'dd.MM.yyyy', { locale: de })}
                    </p>
                  </div>
                )}
              </div>
            ))}
            
            {(!reviews || reviews.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine Bewertungen vorhanden
              </div>
            )}
          </div>

          {/* Review Form Button */}
          {showReviewForm && user && (
            <div className="mt-6 pt-4 border-t">
              <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Star className="h-4 w-4 mr-2" />
                    Händler bewerten
                  </Button>
                </DialogTrigger>
                
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Händler bewerten</DialogTitle>
                    <DialogDescription>
                      Teilen Sie Ihre Erfahrung mit anderen Nutzern
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Overall Rating */}
                    <div className="space-y-2">
                      <Label>Gesamtbewertung *</Label>
                      <div className="flex items-center gap-4">
                        {renderStars(reviewForm.rating, true, (rating) => 
                          setReviewForm({ ...reviewForm, rating })
                        )}
                        <span className="text-sm text-muted-foreground">
                          {reviewForm.rating} von 5 Sternen
                        </span>
                      </div>
                    </div>

                    {/* Category Ratings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Kommunikation</Label>
                        {renderStars(reviewForm.communication_rating, true, (rating) =>
                          setReviewForm({ ...reviewForm, communication_rating: rating })
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Zuverlässigkeit</Label>
                        {renderStars(reviewForm.reliability_rating, true, (rating) =>
                          setReviewForm({ ...reviewForm, reliability_rating: rating })
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Professionalität</Label>
                        {renderStars(reviewForm.professionalism_rating, true, (rating) =>
                          setReviewForm({ ...reviewForm, professionalism_rating: rating })
                        )}
                      </div>
                    </div>

                    {/* Review Title */}
                    <div className="space-y-2">
                      <Label htmlFor="review_title">Titel (optional)</Label>
                      <Input
                        id="review_title"
                        value={reviewForm.title}
                        onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                        placeholder="Kurze Zusammenfassung Ihrer Erfahrung"
                        maxLength={100}
                      />
                    </div>

                    {/* Review Comment */}
                    <div className="space-y-2">
                      <Label htmlFor="review_comment">Bewertung *</Label>
                      <Textarea
                        id="review_comment"
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                        placeholder="Beschreiben Sie Ihre Erfahrung mit diesem Händler..."
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground">
                        {reviewForm.comment.length}/1000 Zeichen
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                        Abbrechen
                      </Button>
                      <Button 
                        onClick={handleSubmitReview}
                        disabled={submitReviewMutation.isPending || !reviewForm.comment.trim()}
                      >
                        {submitReviewMutation.isPending ? 'Sendet...' : 'Bewertung absenden'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Form variant for inline review submission
  return (
    <Card>
      <CardHeader>
        <CardTitle>Händler bewerten</CardTitle>
        <CardDescription>
          Bewerten Sie Ihre Erfahrung mit diesem Händler
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Simplified rating form for inline use */}
          <div className="space-y-2">
            <Label>Bewertung</Label>
            {renderStars(reviewForm.rating, true, (rating) => 
              setReviewForm({ ...reviewForm, rating })
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Kommentar</Label>
            <Textarea
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              placeholder="Ihre Erfahrung..."
              rows={3}
            />
          </div>
          
          <Button 
            onClick={handleSubmitReview}
            disabled={submitReviewMutation.isPending}
            className="w-full"
          >
            Bewertung absenden
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Compact Rating Display Component
 */
export const CompactRatingDisplay = ({ dealerId }: { dealerId: string }) => {
  const { data: ratingSummary } = useQuery({
    queryKey: ['dealer-rating-summary', dealerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dealer_rating_summary')
        .select('*')
        .eq('dealer_id', dealerId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  if (!ratingSummary || ratingSummary.total_reviews === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Star className="h-4 w-4" />
        Noch keine Bewertungen
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= Math.round(ratingSummary.average_rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium">
        {ratingSummary.average_rating.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground">
        ({ratingSummary.total_reviews} Bewertung{ratingSummary.total_reviews !== 1 ? 'en' : ''})
      </span>
    </div>
  );
};

export default DealerRating;
