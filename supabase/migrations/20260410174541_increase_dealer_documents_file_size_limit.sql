UPDATE storage.buckets 
SET file_size_limit = 25 * 1024 * 1024 
WHERE name = 'dealer-documents';