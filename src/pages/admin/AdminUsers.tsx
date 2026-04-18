import { useState, useMemo, useEffect } from "react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useExport } from "@/hooks/useExport";
import { ExportButton } from "@/components/ExportButton";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import { adminSuspendUser } from "@/lib/adminSuspendUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Phone,
  Building,
  MoreHorizontal,
  Edit,
  Shield,
  Ban,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { UserEditDialog } from "@/components/admin/UserEditDialog";

interface UserRole {
  role: string;
}

interface UserWithRoles {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  is_suspended?: boolean;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  created_at: string;
  roles: UserRole[];
}

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { sortField, sortDirection, handleSort, sortData } = useTableSort<UserWithRoles>('created_at', 'desc');

  const userSortAccessors: Record<string, (u: UserWithRoles) => unknown> = {
    name: (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase(),
    email: (u) => (u.email || '').toLowerCase(),
    company_name: (u) => (u.company_name || '').toLowerCase(),
    created_at: (u) => u.created_at || '',
  };

  const { exportCSV, exportExcel, isExporting } = useExport({
    filename: "benutzer",
    columns: [
      { key: "id", label: "ID" },
      { key: "first_name", label: "Vorname" },
      { key: "last_name", label: "Nachname" },
      { key: "email", label: "E-Mail" },
      { key: "phone", label: "Telefon" },
      { key: "company_name", label: "Firma" },
      { key: "roles", label: "Rollen", format: (v: any) => v?.map((r: any) => r.role).join(", ") || "" },
      { key: "is_suspended", label: "Status", format: (v: boolean) => v ? "Gesperrt" : "Aktiv" },
      { key: "created_at", label: "Registriert am", format: (v: string) => v ? new Date(v).toLocaleDateString("de-DE") : "" },
    ],
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          roles:user_roles (role)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserWithRoles[];
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: ({ userId, suspend }: { userId: string; suspend: boolean }) =>
      adminSuspendUser(userId, suspend),
    onSuccess: (result, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      const baseDesc = suspend
        ? "Der Benutzer kann sich nicht mehr anmelden."
        : "Der Benutzer kann sich wieder anmelden.";
      const mailDesc = result.mailSent
        ? " Der Benutzer wurde per E-Mail informiert."
        : result.mailError
          ? ` E-Mail-Versand fehlgeschlagen: ${result.mailError}`
          : "";
      toast({
        title: suspend ? "Benutzer gesperrt" : "Benutzer entsperrt",
        description: `${baseDesc}${mailDesc}`,
        variant: result.mailError ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Status konnte nicht geändert werden.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await invokeWithAuth("admin-delete-user", {
        body: { userId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Benutzer konnte nicht gelöscht werden");
      }

      const result = response.data as any;
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast({
        title: "Benutzer gelöscht",
        description: "Der Benutzer wurde erfolgreich gelöscht.",
      });
      setShowDeleteDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users.filter((user) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.first_name?.toLowerCase().includes(searchLower) ||
        user.last_name?.toLowerCase().includes(searchLower) ||
        user.company_name?.toLowerCase().includes(searchLower);

      // Role filter
      const userRoleNames = user.roles?.map((r) => r.role) || [];
      const matchesRole =
        roleFilter === "all" || userRoleNames.includes(roleFilter);

      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !user.is_suspended) ||
        (statusFilter === "suspended" && user.is_suspended);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const sortedUsers = useMemo(() => sortData(filteredUsers, userSortAccessors), [filteredUsers, sortData]);

  // Pagination
  const [userPage, setUserPage] = useState(1);
  const USER_PAGE_SIZE = 25;
  useEffect(() => { setUserPage(1); }, [searchTerm, roleFilter, statusFilter]);
  const paginatedUsers = useMemo(() => {
    return sortedUsers?.slice((userPage - 1) * USER_PAGE_SIZE, userPage * USER_PAGE_SIZE) || [];
  }, [sortedUsers, userPage]);

  const getRoleBadges = (roles: UserRole[]) => {
    if (!roles || roles.length === 0)
      return <Badge variant="outline">Keine Rolle</Badge>;

    return (
      <div className="flex gap-1 flex-wrap">
        {roles.map((r, idx) => {
          const role = r.role;
          let variant: "default" | "secondary" | "outline" = "outline";

          if (role === "admin") variant = "default";
          if (role === "dealer") variant = "secondary";

          return (
            <Badge key={idx} variant={variant} className="text-xs">
              {role === "admin"
                ? "Admin"
                : role === "dealer"
                ? "Händler"
                : "Verkäufer"}
            </Badge>
          );
        })}
      </div>
    );
  };

  const handleEdit = (user: UserWithRoles) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const handleToggleSuspend = (user: UserWithRoles) => {
    toggleSuspendMutation.mutate({
      userId: user.id,
      suspend: !user.is_suspended,
    });
  };

  const handleDelete = (user: UserWithRoles) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">
            Benutzerverwaltung
          </h1>
          <p className="text-muted-foreground">
            Übersicht aller registrierten Benutzer ({filteredUsers.length} von{" "}
            {users?.length || 0})
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nach Name, E-Mail oder Firma suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rolle filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rollen</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="dealer">Händler</SelectItem>
              <SelectItem value="seller">Verkäufer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="suspended">Gesperrt</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            onExportCSV={() => exportCSV(filteredUsers || [])}
            onExportExcel={() => exportExcel(filteredUsers || [])}
            isExporting={isExporting}
          />
        </div>
      </Card>

      <Card className="border-2 hover:border-primary/20 transition-smooth overflow-hidden">
        <div className="overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              <SortableTableHead field="name" label="Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead field="email" label="Kontakt" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <SortableTableHead field="company_name" label="Firma" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <TableHead>Rollen</TableHead>
              <TableHead>Status</TableHead>
              <SortableTableHead field="created_at" label="Registriert am" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Lädt...
                </TableCell>
              </TableRow>
            ) : filteredUsers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Keine Benutzer gefunden
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className={user.is_suspended ? "opacity-60" : ""}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {user.first_name} {user.last_name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {user.email}
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {user.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.company_name ? (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{user.company_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getRoleBadges(user.roles)}</TableCell>
                  <TableCell>
                    {user.is_suspended ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" />
                        Gesperrt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit text-green-600 border-green-600">
                        <CheckCircle className="w-3 h-3" />
                        Aktiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {format(new Date(user.created_at), "dd.MM.yyyy", {
                        locale: de,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/users/${user.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Details anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                          <Shield className="w-4 h-4 mr-2" />
                          Rollen verwalten
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleSuspend(user)}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          {user.is_suspended ? "Entsperren" : "Sperren"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(user)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        {(sortedUsers?.length || 0) > USER_PAGE_SIZE && (
          <div className="px-4 pb-4">
            <AdminPagination
              page={userPage}
              pageSize={USER_PAGE_SIZE}
              totalItems={sortedUsers?.length || 0}
              onPageChange={setUserPage}
            />
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <UserEditDialog
        user={selectedUser}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie den Benutzer{" "}
              <strong>
                {selectedUser?.first_name} {selectedUser?.last_name}
              </strong>{" "}
              ({selectedUser?.email}) löschen möchten? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
