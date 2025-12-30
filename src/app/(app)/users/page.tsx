'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { getUsersAction, createUserAction, updateUserAction, deleteUserAction } from "@/lib/actions/user.actions";
import type { User } from "@/lib/db/schema";
import { cn } from '@/lib/utils/utils';
import { getStatusBadgeClass } from '@/lib/utils/status-utils';
import { useState, useEffect } from "react";
import { UserForm } from "@/components/user/user-form";
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
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const { toast } = useToast();

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const result = await getUsersAction();
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else if (result.data) {
        setUsers(result.data);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load users',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setIsSubmitting(true);
    try {
      const result = await deleteUserAction(userToDelete.id);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      } else {
        toast({
          title: 'User Deleted',
          description: `${userToDelete.name} has been deleted successfully.`,
        });
        await loadUsers();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete user',
      });
    } finally {
      setIsSubmitting(false);
      setUserToDelete(null);
      setIsDeleteAlertOpen(false);
    }
  };

  const handleFormSubmit = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    setIsSubmitting(true);
    try {
      if (userData.id) {
        // Update existing user
        const result = await updateUserAction(userData.id, {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          status: userData.status,
          assignedStates: userData.assignedStates || undefined,
        });

        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error,
          });
          return;
        }

        toast({
          title: 'User Updated',
          description: `${userData.name} has been updated successfully.`,
        });
      } else {
        // Create new user
        const result = await createUserAction({
          name: userData.name,
          email: userData.email,
          password: (userData as any).password || undefined,
          role: userData.role,
          status: userData.status,
          assignedStates: userData.assignedStates || undefined,
        });

        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error,
          });
          return;
        }

        toast({
          title: 'User Created',
          description: `${userData.name} has been created successfully.`,
        });
      }

      await loadUsers();
      setIsFormOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save user',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <Button onClick={handleAddUser}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Manage user accounts and permissions. {users.length} total users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">No users found. Add your first user to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned States</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(getStatusBadgeClass(user.status))}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.assignedStates ? (
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              try {
                                const states = typeof user.assignedStates === 'string' 
                                  ? JSON.parse(user.assignedStates) 
                                  : user.assignedStates;
                                if (Array.isArray(states) && states.length > 0) {
                                  return states.map((state: string, index: number) => (
                                    <Badge 
                                      key={state} 
                                      variant={index === 0 ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {state} {index === 0 ? '(Primary)' : '(Secondary)'}
                                    </Badge>
                                  ));
                                }
                                return <span className="text-muted-foreground text-sm">-</span>;
                              } catch {
                                return <span className="text-muted-foreground text-sm">{user.assignedStates}</span>;
                              }
                            })()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEditUser(user)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleDeleteUser(user)}
                              className="text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <UserForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        user={selectedUser}
        isSubmitting={isSubmitting}
      />

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for{' '}
              <strong>{userToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
