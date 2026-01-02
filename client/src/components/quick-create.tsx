import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, User, ClipboardList, FileText, Loader2, AlertTriangle, Search, Check, ChevronsUpDown, MessageCircle, Circle } from "lucide-react";
import { useChatContext } from "@/contexts/chat-context";
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
import { PhoneNumberField } from "@/components/phone-number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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
  const { onlineUsers, openChat, isConnected } = useChatContext();
  const [openDialog, setOpenDialog] = useState<"contact" | "task" | "note" | "chat" | null>(null);
  const [taskCustomerOpen, setTaskCustomerOpen] = useState(false);
  const [noteCustomerOpen, setNoteCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.firstName?.toLowerCase().includes(search) ||
      c.lastName?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone?.includes(search)
    );
  }, [customers, customerSearch]);

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

  // Watch contact form fields for duplicate detection
  const watchedLastName = contactForm.watch("lastName");
  const watchedEmail = contactForm.watch("email");
  const watchedPhone = contactForm.watch("phone");

  // Detect potential duplicates
  const potentialDuplicates = useMemo(() => {
    if (!watchedLastName && !watchedEmail && !watchedPhone) return [];
    
    return customers.filter(c => {
      const lastNameMatch = watchedLastName && 
        c.lastName?.toLowerCase() === watchedLastName.toLowerCase();
      const emailMatch = watchedEmail && 
        c.email?.toLowerCase() === watchedEmail.toLowerCase();
      const phoneMatch = watchedPhone && watchedPhone.length > 4 && 
        (c.phone?.includes(watchedPhone) || c.mobile?.includes(watchedPhone));
      
      return lastNameMatch || emailMatch || phoneMatch;
    });
  }, [customers, watchedLastName, watchedEmail, watchedPhone]);

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

  const handleOpenChange = (dialog: "contact" | "task" | "note" | "chat" | null) => {
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
          <DropdownMenuItem
            onClick={() => handleOpenChange("chat")}
            data-testid="menu-item-quick-chat"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {t.quickCreate?.chat || "Chat"}
            {onlineUsers.length > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                {onlineUsers.length}
              </span>
            )}
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
                      <PhoneNumberField 
                        value={field.value} 
                        onChange={field.onChange}
                        defaultCountryCode={contactForm.watch("country") || "SK"}
                        data-testid="input-quick-phone"
                      />
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
              
              {potentialDuplicates.length > 0 && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    <div className="font-medium mb-1">{t.quickCreate.duplicateWarning}</div>
                    <ul className="text-sm space-y-1">
                      {potentialDuplicates.slice(0, 3).map(c => (
                        <li key={c.id}>
                          {c.firstName} {c.lastName} - {c.email || c.phone}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

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
                          {users.filter(u => u.id).map((u) => (
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
                render={({ field }) => {
                  const selectedCustomer = customers.find(c => c.id === field.value);
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t.quickCreate.linkedCustomer}</FormLabel>
                      <Popover open={taskCustomerOpen} onOpenChange={setTaskCustomerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={taskCustomerOpen}
                              className="justify-between font-normal"
                              data-testid="select-quick-customer"
                            >
                              {selectedCustomer
                                ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                                : t.quickCreate.optionalCustomer}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput 
                              placeholder={t.quickCreate.searchCustomer}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              <CommandEmpty>{t.common.noResults}</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="__none__"
                                  onSelect={() => {
                                    field.onChange("");
                                    setTaskCustomerOpen(false);
                                    setCustomerSearch("");
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                                  {t.common.none}
                                </CommandItem>
                                {filteredCustomers.slice(0, 50).map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={`${c.firstName} ${c.lastName} ${c.email || ""}`}
                                    onSelect={() => {
                                      field.onChange(c.id);
                                      setTaskCustomerOpen(false);
                                      setCustomerSearch("");
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === c.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                      <span>{c.firstName} {c.lastName}</span>
                                      {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
                render={({ field }) => {
                  const selectedCustomer = customers.find(c => c.id === field.value);
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t.quickCreate.selectCustomer}</FormLabel>
                      <Popover open={noteCustomerOpen} onOpenChange={setNoteCustomerOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={noteCustomerOpen}
                              className="justify-between font-normal"
                              data-testid="select-quick-note-customer"
                            >
                              {selectedCustomer
                                ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                                : t.common.select}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput 
                              placeholder={t.quickCreate.searchCustomer}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              <CommandEmpty>{t.common.noResults}</CommandEmpty>
                              <CommandGroup>
                                {filteredCustomers.slice(0, 50).map((c) => (
                                  <CommandItem
                                    key={c.id}
                                    value={`${c.firstName} ${c.lastName} ${c.email || ""}`}
                                    onSelect={() => {
                                      field.onChange(c.id);
                                      setNoteCustomerOpen(false);
                                      setCustomerSearch("");
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === c.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                      <span>{c.firstName} {c.lastName}</span>
                                      {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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

      <Dialog open={openDialog === "chat"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {t.quickCreate?.chatWithUser || "Start a Chat"}
            </DialogTitle>
            <DialogDescription>
              {t.quickCreate?.selectOnlineUser || "Select an online user to start chatting"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {!isConnected && (
              <div className="text-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                {t.quickCreate?.connecting || "Connecting..."}
              </div>
            )}
            {isConnected && onlineUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {t.quickCreate?.noOnlineUsers || "No users online right now"}
              </div>
            )}
            {onlineUsers.map((onlineUser) => (
              <button
                key={onlineUser.id}
                onClick={() => {
                  openChat(onlineUser);
                  setOpenDialog(null);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover-elevate text-left"
                data-testid={`button-chat-user-${onlineUser.id}`}
              >
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {onlineUser.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-500 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{onlineUser.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">@{onlineUser.username}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(null)}>
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
