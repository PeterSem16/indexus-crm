import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, User, ClipboardList, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { COUNTRIES } from "@shared/schema";
import type { Customer, SafeUser } from "@shared/schema";

const quickContactSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  country: z.string().min(1, "Required"),
});

const quickTaskSchema = z.object({
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  priority: z.string().default("medium"),
  assignedUserId: z.string().min(1, "Required"),
  customerId: z.string().optional(),
  country: z.string().optional(),
});

const quickNoteSchema = z.object({
  customerId: z.string().min(1, "Required"),
  content: z.string().min(1, "Required"),
});

type QuickContactValues = z.infer<typeof quickContactSchema>;
type QuickTaskValues = z.infer<typeof quickTaskSchema>;
type QuickNoteValues = z.infer<typeof quickNoteSchema>;

export function QuickCreate() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [openDialog, setOpenDialog] = useState<"contact" | "task" | "note" | null>(null);

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const contactForm = useForm<QuickContactValues>({
    resolver: zodResolver(quickContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      country: user?.assignedCountries?.[0] || "SK",
    },
  });

  const taskForm = useForm<QuickTaskValues>({
    resolver: zodResolver(quickTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      assignedUserId: user?.id || "",
      customerId: "",
      country: user?.assignedCountries?.[0] || "",
    },
  });

  const noteForm = useForm<QuickNoteValues>({
    resolver: zodResolver(quickNoteSchema),
    defaultValues: {
      customerId: "",
      content: "",
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: QuickContactValues) => {
      return apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: t.quickCreate.contactCreated,
        description: t.quickCreate.contactCreatedDesc,
      });
      setOpenDialog(null);
      contactForm.reset();
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.quickCreate.createFailed,
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: QuickTaskValues) => {
      return apiRequest("POST", "/api/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: t.quickCreate.taskCreated,
        description: t.quickCreate.taskCreatedDesc,
      });
      setOpenDialog(null);
      taskForm.reset();
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.quickCreate.createFailed,
        variant: "destructive",
      });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: QuickNoteValues) => {
      return apiRequest("POST", `/api/customers/${data.customerId}/notes`, { content: data.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: t.quickCreate.noteCreated,
        description: t.quickCreate.noteCreatedDesc,
      });
      setOpenDialog(null);
      noteForm.reset();
    },
    onError: () => {
      toast({
        title: t.common.error,
        description: t.quickCreate.createFailed,
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (dialog: "contact" | "task" | "note" | null) => {
    setOpenDialog(dialog);
    if (dialog === "contact") {
      contactForm.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        country: user?.assignedCountries?.[0] || "SK",
      });
    } else if (dialog === "task") {
      taskForm.reset({
        title: "",
        description: "",
        priority: "medium",
        assignedUserId: user?.id || "",
        customerId: "",
        country: user?.assignedCountries?.[0] || "",
      });
    } else if (dialog === "note") {
      noteForm.reset({
        customerId: "",
        content: "",
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" data-testid="button-quick-create">
            <Plus className="h-4 w-4 mr-1" />
            {t.quickCreate.title}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => handleOpenChange("contact")}
            data-testid="menu-item-quick-contact"
          >
            <User className="h-4 w-4 mr-2" />
            {t.quickCreate.newContact}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleOpenChange("task")}
            data-testid="menu-item-quick-task"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            {t.quickCreate.newTask}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleOpenChange("note")}
            data-testid="menu-item-quick-note"
          >
            <FileText className="h-4 w-4 mr-2" />
            {t.quickCreate.newNote}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openDialog === "contact"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.quickCreate.newContact}</DialogTitle>
            <DialogDescription>{t.quickCreate.newContactDesc}</DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit((data) => createContactMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.firstName}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-quick-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.lastName}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-quick-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.email}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-quick-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.phone}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-quick-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.country}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-quick-country">
                          <SelectValue placeholder={t.common.select} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createContactMutation.isPending}>
                  {createContactMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "task"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.quickCreate.newTask}</DialogTitle>
            <DialogDescription>{t.quickCreate.newTaskDesc}</DialogDescription>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit((data) => createTaskMutation.mutate(data))} className="space-y-4">
              <FormField
                control={taskForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.quickCreate.taskTitle}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-quick-task-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={taskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.quickCreate.taskDescription}</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="resize-none" data-testid="input-quick-task-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.quickCreate.priority}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-quick-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">{t.quickCreate.priorityLow}</SelectItem>
                          <SelectItem value="medium">{t.quickCreate.priorityMedium}</SelectItem>
                          <SelectItem value="high">{t.quickCreate.priorityHigh}</SelectItem>
                          <SelectItem value="urgent">{t.quickCreate.priorityUrgent}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="assignedUserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.quickCreate.assignedTo}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-quick-assigned-user">
                            <SelectValue placeholder={t.common.select} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName || u.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={taskForm.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.quickCreate.linkedCustomer}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-quick-customer">
                          <SelectValue placeholder={t.quickCreate.optionalCustomer} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">{t.common.none}</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "note"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.quickCreate.newNote}</DialogTitle>
            <DialogDescription>{t.quickCreate.newNoteDesc}</DialogDescription>
          </DialogHeader>
          <Form {...noteForm}>
            <form onSubmit={noteForm.handleSubmit((data) => createNoteMutation.mutate(data))} className="space-y-4">
              <FormField
                control={noteForm.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.quickCreate.selectCustomer}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-quick-note-customer">
                          <SelectValue placeholder={t.common.select} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={noteForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.quickCreate.noteContent}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        className="resize-none min-h-[100px]"
                        data-testid="input-quick-note-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createNoteMutation.isPending}>
                  {createNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
