/**
 * Legal Document Upload Component
 * Handles upload of HRB register, Gewerbenachweis, and other legal documents
 */

import { useState, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ensureValidRLSSession } from '@/lib/sessionGuard';

interface LegalDocumentUploadProps {
  dealerApplicationId: string;
  onDocumentsChange?: (documents: any[]) => void;
  existingDocuments?: any[];
}

interface DocumentType {
  value: string;
  label: string;
  required: boolean;
  description: string;
}

const documentTypes: DocumentType[] = [
  {
    value: 'hrb_register',
    label: 'Handelsregisterauszug (HRB)',
    required: true,
    description: 'Aktueller Auszug aus dem Handelsregister'
  },
  {
    value: 'gewerbenachweis',
    label: 'Gewerbenachweis',
    required: true,
    description: 'Gewerbeanmeldung oder Gewerbeummeldung'
  },
  {
    value: 'ust_id_certificate',
    label: 'USt-ID Bescheinigung',
    required: false,
    description: 'Bescheinigung über die Umsatzsteuer-Identifikationsnummer'
  },
  {
    value: 'other',
    label: 'Sonstige Dokumente',
    required: false,
    description: 'Weitere relevante Dokumente'
  },
];

export const LegalDocumentUpload = ({ 
  dealerApplicationId, 
  onDocumentsChange,
  existingDocuments = []
}: LegalDocumentUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedDocumentType, setSelectedDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState(existingDocuments);

  useEffect(() => { setDocuments(existingDocuments); }, [existingDocuments]);

  const handleFileSelect = () => {
    if (!selectedDocumentType) {
      toast({
        title: 'Dokumenttyp auswählen',
        description: 'Bitte wählen Sie zuerst den Dokumenttyp aus',
        variant: 'destructive',
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast({
        title: 'Ungültiger Dateityp',
        description: 'Erlaubt: PDF, JPEG, PNG, HEIC',
        variant: 'destructive',
      });
      return;
    }

    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      toast({
        title: 'Datei zu groß',
        description: 'Maximale Dateigröße: 25 MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${dealerApplicationId}/${selectedDocumentType}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('dealer-documents')
        .upload(fileName, file, {
          contentType: file.type || `application/${fileExt}`,
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100);
          }
        });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from('dealer-documents')
        .createSignedUrl(fileName, 10 * 365 * 24 * 60 * 60); // 10 years

      if (signedError) throw signedError;
      const documentUrl = signedData.signedUrl;

      // Save document record
      const { data: document, error: documentError } = await supabase
        .from('legal_documents')
        .insert({
          dealer_application_id: dealerApplicationId,
          document_type: selectedDocumentType,
          document_name: file.name,
          file_url: documentUrl,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();

      if (documentError) throw documentError;

      // Update local state
      const newDocuments = [...documents, document];
      setDocuments(newDocuments);
      onDocumentsChange?.(newDocuments);

      toast({
        title: 'Dokument hochgeladen',
        description: `${file.name} wurde erfolgreich hochgeladen`,
      });

      // Reset form
      setSelectedDocumentType('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      logger.error('Error uploading document:', error);
      toast({
        title: 'Upload-Fehler',
        description: 'Dokument konnte nicht hochgeladen werden',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return;

      const { error } = await supabase
        .from('legal_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      const newDocuments = documents.filter(doc => doc.id !== documentId);
      setDocuments(newDocuments);
      onDocumentsChange?.(newDocuments);

      toast({
        title: 'Dokument gelöscht',
        description: 'Das Dokument wurde entfernt',
      });
    } catch (error) {
      logger.error('Error deleting document:', error);
      toast({
        title: 'Fehler',
        description: 'Dokument konnte nicht gelöscht werden',
        variant: 'destructive',
      });
    }
  };

  const getDocumentTypeBadge = (docType: string, verified: boolean) => {
    const type = documentTypes.find(t => t.value === docType);
    const isRequired = type?.required;
    
    if (verified) {
      return <Badge className="bg-green-100 text-green-800">Verifiziert</Badge>;
    } else if (isRequired) {
      return <Badge variant="destructive">Erforderlich</Badge>;
    } else {
      return <Badge variant="outline">Optional</Badge>;
    }
  };

  const requiredDocuments = documentTypes.filter(t => t.required);
  const uploadedRequiredDocs = requiredDocuments.filter(reqDoc => 
    documents.some(doc => doc.document_type === reqDoc.value)
  );
  const completionPercentage = (uploadedRequiredDocs.length / requiredDocuments.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Rechtliche Dokumente
        </CardTitle>
        <CardDescription>
          Laden Sie die erforderlichen Geschäftsdokumente hoch
        </CardDescription>
        
        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Erforderliche Dokumente</span>
            <span>{uploadedRequiredDocs.length} von {requiredDocuments.length}</span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dokumenttyp auswählen</Label>
            <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Wählen Sie den Dokumenttyp" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} {type.required && '*'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDocumentType && (
              <p className="text-xs text-muted-foreground">
                {documentTypes.find(t => t.value === selectedDocumentType)?.description}
              </p>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={handleFileSelect}
            disabled={uploading || !selectedDocumentType}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Lädt hoch...' : 'Dokument hochladen'}
          </Button>
          
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-xs text-center text-muted-foreground">
                {Math.round(uploadProgress)}% hochgeladen
              </p>
            </div>
          )}
        </div>

        {/* Document List */}
        <div className="space-y-4">
          <h4 className="font-medium">Hochgeladene Dokumente</h4>
          
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Dokumente hochgeladen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{doc.document_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {documentTypes.find(t => t.value === doc.document_type)?.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Hochgeladen: {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getDocumentTypeBadge(doc.document_type, doc.verified)}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Requirements Checklist */}
        <div className="space-y-3">
          <h4 className="font-medium">Erforderliche Dokumente</h4>
          {requiredDocuments.map((reqDoc) => {
            const isUploaded = documents.some(doc => doc.document_type === reqDoc.value);
            return (
              <div key={reqDoc.value} className="flex items-center gap-3 p-2 rounded">
                {isUploaded ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{reqDoc.label}</div>
                  <div className="text-sm text-muted-foreground">{reqDoc.description}</div>
                </div>
                {isUploaded && <Badge className="bg-green-100 text-green-800">✓</Badge>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LegalDocumentUpload;
