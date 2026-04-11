# DB-Analyse CaravanWert (Projekt: zcrwqxsyptjwkuxfacvq)

## handle_new_user() Trigger
- Alle neuen User bekommen Rolle 'seller'
- Bei user_type='dealer' wird zusätzlich dealer_application mit status='pending' erstellt
- KORREKT!

## approve_dealer_application() RPC
- Prüft admin-Rolle
- Setzt application status auf 'approved'
- LÖSCHT die 'seller' Rolle: DELETE FROM user_roles WHERE user_id = ... AND role = 'seller'
- FÜGT 'dealer' Rolle ein: INSERT INTO user_roles (user_id, role) VALUES (..., 'dealer') ON CONFLICT (user_id, role) DO NOTHING

### PROBLEM: ON CONFLICT (user_id, role) existiert nicht mehr!
Der unique index ist jetzt `idx_user_roles_one_per_user ON user_roles(user_id)` (nur user_id).
Der alte `user_roles_user_id_role_key` wurde gedroppt.
Das bedeutet: `ON CONFLICT (user_id, role) DO NOTHING` wird FEHLSCHLAGEN weil es keinen unique constraint auf (user_id, role) gibt.

ABER: Da zuerst DELETE und dann INSERT gemacht wird, sollte es funktionieren:
1. DELETE entfernt die 'seller' Zeile
2. INSERT fügt 'dealer' ein - kein Konflikt da die Zeile gelöscht wurde

Trotzdem: Der ON CONFLICT clause referenziert einen nicht-existierenden Constraint.
PostgreSQL wird einen Fehler werfen wenn es versucht den ON CONFLICT zu matchen.

## Unique Constraints auf user_roles
- user_roles_pkey: UNIQUE(id) - Primary Key
- idx_user_roles_one_per_user: UNIQUE(user_id) - Ein Role pro User
- KEIN user_roles_user_id_role_key mehr!

## FAZIT
Die approve_dealer_application() Funktion muss aktualisiert werden:
ON CONFLICT (user_id, role) → ON CONFLICT (user_id)
