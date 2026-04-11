---
name: supabase-deploy
trigger: keyword
keywords:
  - supabase_deploy_edge_function
  - edge function
  - deploy function
---

# Supabase Edge Function Deployment – Pflichtregeln

## KRITISCH: `files`-Parameter ist PFLICHT

Beim Aufruf von `supabase_deploy_edge_function` über das Supabase MCP-Tool **MUSS** immer der `files`-Parameter mitgegeben werden. Ohne diesen Parameter schlägt der Deploy **IMMER** fehl mit dem Fehler:

```
Field required [type=missing, ...]
```

## Korrekter Ablauf

1. **Dateiinhalt lesen:** Vor dem Deploy den Inhalt der Edge Function Datei lesen (z.B. `cat supabase/functions/my-function/index.ts`)
2. **Deploy mit `files`:** Den gelesenen Inhalt als `files`-Array übergeben

## Korrektes Beispiel

```json
{
  "project_id": "zcrwqxsyptjwkuxfacvq",
  "name": "my-function",
  "entrypoint_path": "index.ts",
  "verify_jwt": true,
  "files": [
    {
      "name": "index.ts",
      "content": "// ... der vollständige TypeScript-Code ..."
    }
  ]
}
```

## Häufige Fehler (NICHT machen)

- **NIEMALS** `supabase_deploy_edge_function` ohne `files` aufrufen
- **NIEMALS** den vollen Pfad als `entrypoint_path` verwenden (z.B. `functions/my-function/index.ts`) – nur den Dateinamen (`index.ts`)
- Bei mehreren Dateien (z.B. `index.ts` + `utils.ts`) **ALLE** Dateien im `files`-Array mitgeben

## Mehrere Dateien

Wenn die Edge Function aus mehreren Dateien besteht:

```json
{
  "files": [
    {"name": "index.ts", "content": "..."},
    {"name": "utils.ts", "content": "..."},
    {"name": "types.ts", "content": "..."}
  ]
}
```

## Supabase-Projekt Referenz

- **Projekt-ID:** `zcrwqxsyptjwkuxfacvq`
- **Region:** eu-west-1
