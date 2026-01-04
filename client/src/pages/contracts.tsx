import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { 
  FileText, Plus, Edit2, Trash2, Send, Eye, Check, X, Clock, 
  FileSignature, Download, Copy, RefreshCw, AlertCircle, Filter,
  ChevronRight, Settings, PenTool, Mail, Phone, Shield, 
  CheckCircle, Loader2, Edit
} from "lucide-react";
import type { 
  ContractTemplate, ContractInstance, Customer, BillingDetails
} from "@shared/schema";
import { ContractTemplateEditor, DEFAULT_CONTRACT_TEMPLATE } from "@/components/contract-template-editor";

type TabType = "templates" | "contracts";

const CONTRACT_STATUSES: Record<string, { label: string; variant: "secondary" | "default" | "destructive"; icon: typeof FileText }> = {
  draft: { label: "Koncept", variant: "secondary" as const, icon: FileText },
  sent: { label: "Odoslaná", variant: "default" as const, icon: Send },
  pending_signature: { label: "Čaká na podpis", variant: "default" as const, icon: Clock },
  signed: { label: "Podpísaná", variant: "default" as const, icon: Check },
  completed: { label: "Dokončená", variant: "default" as const, icon: Check },
  cancelled: { label: "Zrušená", variant: "destructive" as const, icon: X },
  expired: { label: "Expirovaná", variant: "secondary" as const, icon: AlertCircle }
};

const TEMPLATE_CATEGORIES = [
  { value: "general", label: "Všeobecná zmluva" },
  { value: "cord_blood", label: "Zmluva o uchovávaní krvotvorných buniek" },
  { value: "service", label: "Zmluva o službách" },
  { value: "storage", label: "Zmluva o uchovávaní" },
  { value: "gdpr", label: "GDPR súhlas" }
];

export default function ContractsPage() {
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const selectedCountry = selectedCountries.length === 1 ? selectedCountries[0] : null;
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlCustomerId = urlParams.get("customerId");
  
  const [activeTab, setActiveTab] = useState<TabType>("contracts");
  
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isContractWizardOpen, setIsContractWizardOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [selectedContract, setSelectedContract] = useState<ContractInstance | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    category: string;
    languageCode: string;
    description: string;
    countryCode: string;
    contentHtml: string;
  }>({
    name: "",
    category: "general",
    languageCode: "sk",
    description: "",
    countryCode: selectedCountry || "SK",
    contentHtml: ""
  });
  
  const [contractForm, setContractForm] = useState({
    templateId: "",
    customerId: "",
    billingDetailsId: "",
    currency: "EUR",
    notes: ""
  });
  
  const [urlCustomerProcessed, setUrlCustomerProcessed] = useState(false);
  
  const [signatureForm, setSignatureForm] = useState({
    otpCode: "",
    signatureRequestId: ""
  });
  const [otpVerified, setOtpVerified] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  
  const [participantForm, setParticipantForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "signer",
    participantType: "customer", // customer, billing_company, internal_witness, guarantor
    signatureRequired: true
  });
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductSetId, setSelectedProductSetId] = useState("");
  
  type SignatureRequest = {
    id: string;
    contractId: string;
    signerName: string;
    signerEmail: string | null;
    status: string;
    otpVerifiedAt: string | null;
  };
  
  const { data: signatureRequests } = useQuery<SignatureRequest[]>({
    queryKey: ["/api/contracts", selectedContract?.id, "signature-requests"],
    queryFn: async () => {
      if (!selectedContract?.id) return [];
      const response = await fetch(`/api/contracts/${selectedContract.id}/signature-requests`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isSignatureModalOpen && !!selectedContract?.id
  });

  useEffect(() => {
    if (signatureRequests && signatureRequests.length > 0) {
      const activeRequest = signatureRequests.find(r => r.status === "otp_verified") 
        || signatureRequests.find(r => r.status === "sent");
      if (activeRequest) {
        setSignatureForm(prev => ({ ...prev, signatureRequestId: activeRequest.id }));
        if (activeRequest.status === "otp_verified") {
          setOtpVerified(true);
        }
      }
    }
  }, [signatureRequests]);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contracts/templates", selectedCountry],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<ContractInstance[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  useEffect(() => {
    if (urlCustomerId && customers.length > 0 && !urlCustomerProcessed) {
      const customerExists = customers.some(c => c.id === urlCustomerId);
      if (customerExists) {
        setContractForm(prev => ({ ...prev, customerId: urlCustomerId }));
        setIsContractWizardOpen(true);
        toast({ 
          title: "Zákazník vybraný", 
          description: customers.find(c => c.id === urlCustomerId)?.firstName + " " + customers.find(c => c.id === urlCustomerId)?.lastName 
        });
      }
      setUrlCustomerProcessed(true);
    }
  }, [urlCustomerId, customers, urlCustomerProcessed, toast]);

  const { data: billingDetails = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      return apiRequest("POST", "/api/contracts/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
      toast({ title: "Šablóna vytvorená", description: "Šablóna zmluvy bola úspešne vytvorená." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť šablónu.", variant: "destructive" });
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof templateForm> }) => {
      return apiRequest("PATCH", `/api/contracts/templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      setIsTemplateDialogOpen(false);
      setSelectedTemplate(null);
      resetTemplateForm();
      toast({ title: "Šablóna aktualizovaná", description: "Šablóna bola úspešne uložená." });
    }
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contracts/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/templates"] });
      toast({ title: "Šablóna vymazaná" });
    }
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: typeof contractForm) => {
      return apiRequest("POST", "/api/contracts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsContractWizardOpen(false);
      setWizardStep(1);
      resetContractForm();
      toast({ title: "Zmluva vytvorená", description: "Zmluva bola úspešne vytvorená." });
    }
  });

  const sendContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/contracts/${id}/send`);
      const data = await response.json() as { success: boolean; signersCount: number; signatureRequests: Array<{ id: string; signerName: string; signerEmail: string | null; status: string }> };
      return { ...data, contractId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      if (data.signatureRequests && data.signatureRequests.length > 0) {
        setSignatureForm(prev => ({ ...prev, signatureRequestId: data.signatureRequests[0].id }));
      }
      toast({ title: "Zmluva odoslaná", description: "Zmluva bola odoslaná na podpis." });
    }
  });

  const cancelContractMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/contracts/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Zmluva zrušená" });
    }
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ contractId, otpCode, signatureRequestId }: { contractId: string; otpCode: string; signatureRequestId: string }) => {
      const response = await apiRequest("POST", `/api/contracts/${contractId}/verify-otp`, { otpCode, signatureRequestId });
      return await response.json() as { success: boolean; verified: boolean; signatureRequestId: string };
    },
    onSuccess: (data) => {
      setOtpVerified(true);
      if (data.signatureRequestId) {
        setSignatureForm(prev => ({ ...prev, signatureRequestId: data.signatureRequestId }));
      }
      toast({ title: "OTP overené", description: "Kód bol úspešne overený. Teraz môžete podpísať zmluvu." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Neplatný alebo expirovaný kód.", variant: "destructive" });
    }
  });

  const signContractMutation = useMutation({
    mutationFn: async ({ contractId, signatureRequestId, signatureData }: { contractId: string; signatureRequestId: string; signatureData: string }) => {
      return apiRequest("POST", `/api/contracts/${contractId}/sign`, { 
        signatureRequestId, 
        signatureData,
        signatureType: "typed"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsSignatureModalOpen(false);
      setOtpVerified(false);
      setSignatureForm({ otpCode: "", signatureRequestId: "" });
      setSignatureData("");
      toast({ title: "Zmluva podpísaná", description: "Zmluva bola úspešne elektronicky podpísaná." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa podpísať zmluvu.", variant: "destructive" });
    }
  });

  const renderContractMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/contracts/${id}/render`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      toast({ title: "Zmluva vygenerovaná" });
    }
  });

  const addParticipantMutation = useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: typeof participantForm }) => {
      return apiRequest("POST", `/api/contracts/${contractId}/participants`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      setIsAddingParticipant(false);
      setParticipantForm({ fullName: "", email: "", phone: "", role: "signer", participantType: "customer", signatureRequired: true });
      toast({ title: "Účastník pridaný" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa pridať účastníka.", variant: "destructive" });
    }
  });

  type ContractDetail = ContractInstance & {
    participants?: Array<{
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      role: string;
      signatureRequired: boolean;
    }>;
    products?: Array<{
      id: string;
      productId: string;
      productSetId: string;
      quantity: number;
      priceOverride: string | null;
    }>;
  };

  const { data: contractDetail } = useQuery<ContractDetail>({
    queryKey: ["/api/contracts", selectedContract?.id],
    enabled: isPreviewOpen && !!selectedContract?.id
  });

  type ProductSet = {
    id: string;
    name: string;
    productId: string;
    productName: string;
    countryCode: string | null;
    currency: string;
    totalGrossAmount: string | null;
  };

  // Get billing details to filter product sets by country
  const billingDetail = billingDetails.find(b => b.id === selectedContract?.billingDetailsId);

  const { data: productSets = [] } = useQuery<ProductSet[]>({
    queryKey: ["/api/product-sets", { country: billingDetail?.countryCode }],
    enabled: isPreviewOpen && !!selectedContract?.id
  });

  const addContractProductMutation = useMutation({
    mutationFn: async ({ contractId, productSetId }: { contractId: string; productSetId: string }) => {
      return apiRequest("POST", `/api/contracts/${contractId}/products`, { 
        productSetId,
        quantity: 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      setIsAddingProduct(false);
      setSelectedProductSetId("");
      toast({ title: "Produkt pridaný" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa pridať produkt.", variant: "destructive" });
    }
  });

  const removeContractProductMutation = useMutation({
    mutationFn: async ({ contractId, productId }: { contractId: string; productId: string }) => {
      return apiRequest("DELETE", `/api/contracts/${contractId}/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedContract?.id] });
      toast({ title: "Produkt odstránený" });
    }
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      category: "general",
      languageCode: "sk",
      description: "",
      countryCode: selectedCountry || "SK",
      contentHtml: ""
    });
  };

  const resetContractForm = () => {
    setContractForm({
      templateId: "",
      customerId: "",
      billingDetailsId: "",
      currency: "EUR",
      notes: ""
    });
  };

  const handleEditTemplate = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      languageCode: template.languageCode,
      description: template.description || "",
      countryCode: template.countryCode,
      contentHtml: template.contentHtml || ""
    });
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleCreateContract = () => {
    createContractMutation.mutate(contractForm);
  };

  const filteredTemplates = templates.filter(t => 
    !selectedCountry || t.countryCode === selectedCountry
  );

  const filteredContracts = contracts.filter(c => {
    const customer = customers.find(cust => cust.id === c.customerId);
    return !selectedCountry || customer?.country === selectedCountry;
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : "Neznámy";
  };

  const getStatusBadge = (status: string) => {
    const config = CONTRACT_STATUSES[status as keyof typeof CONTRACT_STATUSES] || CONTRACT_STATUSES.draft;
    return (
      <Badge variant={config.variant} className="gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader 
        title="Zmluvy"
        description="Správa zmlúv a šablón"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <TabsList>
              <TabsTrigger value="contracts" className="gap-2" data-testid="tab-contracts">
                <FileSignature className="h-4 w-4" />
                Zmluvy
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2" data-testid="tab-templates">
                <FileText className="h-4 w-4" />
                Šablóny
              </TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2 flex-wrap">
              {activeTab === "templates" && (
                <Button 
                  onClick={() => {
                    resetTemplateForm();
                    setSelectedTemplate(null);
                    setIsTemplateDialogOpen(true);
                  }}
                  data-testid="button-add-template"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nová šablóna
                </Button>
              )}
              {activeTab === "contracts" && (
                <Button onClick={() => setIsContractWizardOpen(true)} data-testid="button-add-contract">
                  <Plus className="h-4 w-4 mr-2" />
                  Nová zmluva
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="templates" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Názov</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Krajina</TableHead>
                      <TableHead>Stav</TableHead>
                      <TableHead>Vytvorená</TableHead>
                      <TableHead className="text-right">Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Načítavam...
                        </TableCell>
                      </TableRow>
                    ) : filteredTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Žiadne šablóny
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTemplates.map(template => (
                        <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>
                            {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                          </TableCell>
                          <TableCell>{template.countryCode}</TableCell>
                          <TableCell>
                            <Badge variant={template.status === "published" ? "default" : "secondary"}>
                              {template.status === "published" ? "Publikovaná" : "Koncept"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {template.createdAt && format(new Date(template.createdAt), "d.M.yyyy", { locale: sk })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => handleEditTemplate(template)}
                                data-testid={`button-edit-template-${template.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Naozaj chcete vymazať túto šablónu?")) {
                                    deleteTemplateMutation.mutate(template.id);
                                  }
                                }}
                                data-testid={`button-delete-template-${template.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Číslo zmluvy</TableHead>
                      <TableHead>Klient</TableHead>
                      <TableHead>Stav</TableHead>
                      <TableHead>Suma</TableHead>
                      <TableHead>Vytvorená</TableHead>
                      <TableHead className="text-right">Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Načítavam...
                        </TableCell>
                      </TableRow>
                    ) : filteredContracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Žiadne zmluvy
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContracts.map(contract => (
                        <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                          <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                          <TableCell>{getCustomerName(contract.customerId)}</TableCell>
                          <TableCell>{getStatusBadge(contract.status)}</TableCell>
                          <TableCell>
                            {contract.totalGrossAmount} {contract.currency}
                          </TableCell>
                          <TableCell>
                            {contract.createdAt && format(new Date(contract.createdAt), "d.M.yyyy", { locale: sk })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedContract(contract);
                                  setIsPreviewOpen(true);
                                }}
                                data-testid={`button-preview-contract-${contract.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {contract.status === "draft" && (
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => sendContractMutation.mutate(contract.id)}
                                  data-testid={`button-send-contract-${contract.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {(contract.status === "draft" || contract.status === "sent") && (
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => {
                                    const reason = prompt("Dôvod zrušenia:");
                                    if (reason) {
                                      cancelContractMutation.mutate({ id: contract.id, reason });
                                    }
                                  }}
                                  data-testid={`button-cancel-contract-${contract.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedTemplate ? "Upraviť šablónu" : "Nová šablóna zmluvy"}</DialogTitle>
            <DialogDescription>
              Vytvorte alebo upravte šablónu zmluvy. Kliknite na pole vľavo pre vloženie do šablóny.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Názov šablóny</Label>
                  <Input
                    id="template-name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="Zmluva o uchovávaní"
                    data-testid="input-template-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-category">Kategória</Label>
                  <Select
                    value={templateForm.category}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, category: value })}
                  >
                    <SelectTrigger id="template-category" data-testid="select-template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-country">Krajina</Label>
                  <Select
                    value={templateForm.countryCode}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, countryCode: value })}
                  >
                    <SelectTrigger id="template-country" data-testid="select-template-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SK">Slovensko</SelectItem>
                      <SelectItem value="CZ">Česká republika</SelectItem>
                      <SelectItem value="HU">Maďarsko</SelectItem>
                      <SelectItem value="RO">Rumunsko</SelectItem>
                      <SelectItem value="IT">Taliansko</SelectItem>
                      <SelectItem value="DE">Nemecko</SelectItem>
                      <SelectItem value="US">USA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">Popis</Label>
                  <Input
                    id="template-description"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="Štandardná zmluva"
                    data-testid="input-template-description"
                  />
                </div>
              </div>
              
              <Separator />
              
              <ContractTemplateEditor
                value={templateForm.contentHtml}
                onChange={(value) => setTemplateForm({ ...templateForm, contentHtml: value })}
              />
            </div>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={!templateForm.name || createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Ukladám..." : "Uložiť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isContractWizardOpen} onOpenChange={setIsContractWizardOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nová zmluva - Krok {wizardStep}/3</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && "Vyberte šablónu zmluvy a klienta"}
              {wizardStep === 2 && "Vyberte fakturačné údaje a produkty"}
              {wizardStep === 3 && "Skontrolujte a potvrďte zmluvu"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(step => (
                <div 
                  key={step}
                  className={`flex-1 h-2 rounded-full ${
                    step <= wizardStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            
            {wizardStep === 1 && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Šablóna zmluvy</Label>
                  <Select
                    value={contractForm.templateId}
                    onValueChange={(value) => setContractForm({ ...contractForm, templateId: value })}
                  >
                    <SelectTrigger data-testid="select-contract-template">
                      <SelectValue placeholder="Vyberte šablónu" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Žiadne šablóny. Najprv vytvorte šablónu zmluvy.
                        </div>
                      ) : (
                        filteredTemplates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} {template.status === "draft" && "(koncept)"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Klient</Label>
                  <Select
                    value={contractForm.customerId}
                    onValueChange={(value) => setContractForm({ ...contractForm, customerId: value })}
                  >
                    <SelectTrigger data-testid="select-contract-customer">
                      <SelectValue placeholder="Vyberte klienta" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName} - {customer.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {wizardStep === 2 && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Fakturačná spoločnosť</Label>
                  <Select
                    value={contractForm.billingDetailsId}
                    onValueChange={(value) => setContractForm({ ...contractForm, billingDetailsId: value })}
                  >
                    <SelectTrigger data-testid="select-contract-billing">
                      <SelectValue placeholder="Vyberte fakturačné údaje" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingDetails.map(bd => (
                        <SelectItem key={bd.id} value={bd.id}>
                          {bd.companyName} ({bd.countryCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mena</Label>
                    <Select
                      value={contractForm.currency}
                      onValueChange={(value) => setContractForm({ ...contractForm, currency: value })}
                    >
                      <SelectTrigger data-testid="select-contract-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CZK">CZK</SelectItem>
                        <SelectItem value="HUF">HUF</SelectItem>
                        <SelectItem value="RON">RON</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Poznámky</Label>
                  <Textarea
                    value={contractForm.notes}
                    onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                    placeholder="Interné poznámky k zmluve..."
                    data-testid="textarea-contract-notes"
                  />
                </div>
              </div>
            )}
            
            {wizardStep === 3 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Zhrnutie zmluvy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Šablóna:</span>
                      <span>{templates.find(t => t.id === contractForm.templateId)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Klient:</span>
                      <span>{getCustomerName(contractForm.customerId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fakturácia:</span>
                      <span>{billingDetails.find(b => b.id === contractForm.billingDetailsId)?.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mena:</span>
                      <span>{contractForm.currency}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <Shield className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Po vytvorení zmluvy bude možné pridať produkty a účastníkov, 
                    a následne odoslať na podpis.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (wizardStep > 1) setWizardStep(wizardStep - 1);
              else setIsContractWizardOpen(false);
            }}>
              {wizardStep > 1 ? "Späť" : "Zrušiť"}
            </Button>
            {wizardStep < 3 ? (
              <Button 
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={
                  (wizardStep === 1 && (!contractForm.templateId || !contractForm.customerId)) ||
                  (wizardStep === 2 && !contractForm.billingDetailsId)
                }
                data-testid="button-wizard-next"
              >
                Ďalej
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreateContract}
                disabled={createContractMutation.isPending}
                data-testid="button-create-contract"
              >
                {createContractMutation.isPending ? "Vytváram..." : "Vytvoriť zmluvu"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Zmluva {selectedContract?.contractNumber}
            </DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div>
                  <span className="text-sm text-muted-foreground">Stav:</span>
                  <div className="mt-1">{getStatusBadge(selectedContract.status)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Klient:</span>
                  <div className="mt-1 font-medium">{getCustomerName(selectedContract.customerId)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Fakturačná spoločnosť:</span>
                  <div className="mt-1 font-medium">
                    {billingDetails.find(b => b.id === selectedContract.billingDetailsId)?.companyName || "Nevybraná"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Suma:</span>
                  <div className="mt-1 font-medium">
                    {selectedContract.totalGrossAmount || "0"} {selectedContract.currency}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {selectedContract.status === "draft" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      Podpisovatelia
                    </h4>
                    {!isAddingParticipant && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const customer = customers.find(c => c.id === selectedContract.customerId);
                          if (customer) {
                            setParticipantForm({
                              fullName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
                              email: customer.email || "",
                              phone: customer.phone || customer.mobile || "",
                              role: "signer",
                              participantType: "customer",
                              signatureRequired: true
                            });
                          }
                          setIsAddingParticipant(true);
                        }}
                        data-testid="button-add-participant"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Pridať
                      </Button>
                    )}
                  </div>
                  
                  {contractDetail?.participants && contractDetail.participants.length > 0 ? (
                    <div className="space-y-2">
                      {contractDetail.participants.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-sm">{p.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.email && <span>{p.email}</span>}
                                {p.email && p.phone && <span> | </span>}
                                {p.phone && <span>{p.phone}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{p.role}</Badge>
                            {p.signatureRequired && <Badge>Podpis</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Žiadni podpisovatelia. Pridajte aspoň jedného podpisovateľa pre odoslanie zmluvy.
                    </p>
                  )}
                  
                  {isAddingParticipant && (
                    <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="participantName">Meno a priezvisko</Label>
                          <Input
                            id="participantName"
                            value={participantForm.fullName}
                            onChange={(e) => setParticipantForm({ ...participantForm, fullName: e.target.value })}
                            data-testid="input-participant-name"
                          />
                        </div>
                        <div>
                          <Label>Typ účastníka</Label>
                          <Select 
                            value={participantForm.participantType} 
                            onValueChange={(v) => setParticipantForm({ ...participantForm, participantType: v })}
                          >
                            <SelectTrigger data-testid="select-participant-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">Klient / Zákazník</SelectItem>
                              <SelectItem value="billing_company">Poskytovateľ / Firma</SelectItem>
                              <SelectItem value="internal_witness">Interný svedok</SelectItem>
                              <SelectItem value="guarantor">Ručiteľ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Rola pri podpise</Label>
                          <Select 
                            value={participantForm.role} 
                            onValueChange={(v) => setParticipantForm({ ...participantForm, role: v })}
                          >
                            <SelectTrigger data-testid="select-participant-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="signer">Podpisovateľ</SelectItem>
                              <SelectItem value="witness">Svedok</SelectItem>
                              <SelectItem value="authorized_representative">Splnomocnený zástupca</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="participantEmail">Email</Label>
                          <Input
                            id="participantEmail"
                            type="email"
                            value={participantForm.email}
                            onChange={(e) => setParticipantForm({ ...participantForm, email: e.target.value })}
                            data-testid="input-participant-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="participantPhone">Telefón</Label>
                          <Input
                            id="participantPhone"
                            value={participantForm.phone}
                            onChange={(e) => setParticipantForm({ ...participantForm, phone: e.target.value })}
                            data-testid="input-participant-phone"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="signatureRequired"
                            checked={participantForm.signatureRequired}
                            onChange={(e) => setParticipantForm({ ...participantForm, signatureRequired: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor="signatureRequired" className="text-sm cursor-pointer">Vyžaduje podpis</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setIsAddingParticipant(false)}>
                            Zrušiť
                          </Button>
                          <Button 
                            size="sm"
                            disabled={!participantForm.fullName || addParticipantMutation.isPending}
                            onClick={() => {
                              addParticipantMutation.mutate({
                                contractId: selectedContract.id,
                                data: participantForm
                              });
                            }}
                            data-testid="button-save-participant"
                          >
                            {addParticipantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložiť"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <Separator className="my-4" />
                  
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Produkty / Cenové sady
                    </h4>
                    {!isAddingProduct && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsAddingProduct(true)}
                        data-testid="button-add-product"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Pridať produkt
                      </Button>
                    )}
                  </div>
                  
                  {contractDetail?.products && contractDetail.products.length > 0 ? (
                    <div className="space-y-2">
                      {contractDetail.products.map((p) => {
                        const productSet = productSets.find(ps => ps.id === p.productSetId);
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/50">
                            <div>
                              <div className="font-medium text-sm">{productSet?.name || "Neznámy produkt"}</div>
                              <div className="text-xs text-muted-foreground">
                                Množstvo: {p.quantity} | Cena: {productSet?.totalGrossAmount || p.priceOverride || "N/A"} {productSet?.currency || selectedContract.currency}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeContractProductMutation.mutate({ 
                                contractId: selectedContract.id, 
                                productId: p.id 
                              })}
                              data-testid={`button-remove-product-${p.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Žiadne produkty. Pridajte produkty pre výpočet ceny zmluvy.
                    </p>
                  )}
                  
                  {isAddingProduct && (
                    <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                      <div>
                        <Label>Vyberte cenovú sadu (billset)</Label>
                        <Select 
                          value={selectedProductSetId} 
                          onValueChange={setSelectedProductSetId}
                        >
                          <SelectTrigger data-testid="select-product-set">
                            <SelectValue placeholder="Vyberte produkt" />
                          </SelectTrigger>
                          <SelectContent>
                            {productSets.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">Žiadne cenové sady pre túto krajinu</div>
                            ) : (
                              productSets.map((ps) => (
                                <SelectItem key={ps.id} value={ps.id}>
                                  {ps.productName}: {ps.name} - {ps.totalGrossAmount || "0"} {ps.currency}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setIsAddingProduct(false);
                          setSelectedProductSetId("");
                        }}>
                          Zrušiť
                        </Button>
                        <Button 
                          size="sm"
                          disabled={!selectedProductSetId || addContractProductMutation.isPending}
                          onClick={() => {
                            addContractProductMutation.mutate({
                              contractId: selectedContract.id,
                              productSetId: selectedProductSetId
                            });
                          }}
                          data-testid="button-save-product"
                        >
                          {addContractProductMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pridať"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <Separator />
              
              {selectedContract.renderedHtml || contractDetail?.renderedHtml ? (
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert p-4 border rounded-md bg-white dark:bg-gray-900"
                  dangerouslySetInnerHTML={{ __html: selectedContract.renderedHtml || contractDetail?.renderedHtml || "" }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Zmluva ešte nebola vygenerovaná</p>
                  <Button 
                    variant="outline" 
                    className="mt-2"
                    disabled={renderContractMutation.isPending}
                    onClick={() => renderContractMutation.mutate(selectedContract.id)}
                    data-testid="button-render-preview"
                  >
                    {renderContractMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Vygenerovať náhľad
                  </Button>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Zavrieť
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Stiahnuť PDF
            </Button>
            {selectedContract?.status === "draft" && (
              <Button onClick={() => {
                if (selectedContract) {
                  sendContractMutation.mutate(selectedContract.id);
                  setIsPreviewOpen(false);
                }
              }}>
                <Send className="h-4 w-4 mr-2" />
                Odoslať na podpis
              </Button>
            )}
            {(selectedContract?.status === "sent" || selectedContract?.status === "pending_signature") && (
              <Button onClick={() => {
                setIsPreviewOpen(false);
                setOtpVerified(false);
                setSignatureForm({ otpCode: "", signatureRequestId: "" });
                setSignatureData("");
                setIsSignatureModalOpen(true);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Podpísať zmluvu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Modal */}
      <Dialog open={isSignatureModalOpen} onOpenChange={(open) => {
        setIsSignatureModalOpen(open);
        if (!open) {
          setOtpVerified(false);
          setSignatureForm({ otpCode: "", signatureRequestId: "" });
          setSignatureData("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Elektronický podpis zmluvy</DialogTitle>
            <DialogDescription>
              {selectedContract?.contractNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4">
              {!otpVerified ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <span className="font-medium">Overenie identity</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Na email/telefón klienta bol odoslaný 6-miestny overovací kód. 
                      Zadajte ho pre pokračovanie v podpise.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otpCode">Overovací kód (OTP)</Label>
                    <Input
                      id="otpCode"
                      placeholder="123456"
                      maxLength={6}
                      value={signatureForm.otpCode}
                      onChange={(e) => setSignatureForm({
                        ...signatureForm,
                        otpCode: e.target.value.replace(/\D/g, "").slice(0, 6)
                      })}
                      className="text-center text-2xl tracking-widest"
                      data-testid="input-otp-code"
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={signatureForm.otpCode.length !== 6 || verifyOtpMutation.isPending || !signatureForm.signatureRequestId}
                    onClick={() => {
                      if (!signatureForm.signatureRequestId) {
                        toast({ title: "Chyba", description: "Nebola nájdená žiadosť o podpis.", variant: "destructive" });
                        return;
                      }
                      verifyOtpMutation.mutate({
                        contractId: selectedContract.id,
                        otpCode: signatureForm.otpCode,
                        signatureRequestId: signatureForm.signatureRequestId
                      });
                    }}
                    data-testid="button-verify-otp"
                  >
                    {verifyOtpMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Overiť kód
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700 dark:text-green-400">
                        Identita overená
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signatureData">Podpis (napíšte svoje meno)</Label>
                    <Input
                      id="signatureData"
                      placeholder="Meno a priezvisko"
                      value={signatureData}
                      onChange={(e) => setSignatureData(e.target.value)}
                      className="italic"
                      data-testid="input-signature"
                    />
                    <p className="text-xs text-muted-foreground">
                      Napísaním svojho mena potvrdzujete, že ste si prečítali a súhlasíte s obsahom zmluvy.
                    </p>
                  </div>

                  <div className="p-3 border rounded-md bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Náhľad podpisu:</div>
                    <div className="text-xl italic font-serif text-center py-2 border-b-2 border-foreground/30">
                      {signatureData || "Váš podpis"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsSignatureModalOpen(false)}
            >
              Zrušiť
            </Button>
            {otpVerified && (
              <Button
                disabled={!signatureData.trim() || signContractMutation.isPending || !signatureForm.signatureRequestId}
                onClick={() => {
                  if (selectedContract && signatureForm.signatureRequestId) {
                    signContractMutation.mutate({
                      contractId: selectedContract.id,
                      signatureRequestId: signatureForm.signatureRequestId,
                      signatureData: signatureData
                    });
                  } else {
                    toast({ title: "Chyba", description: "Neplatná žiadosť o podpis.", variant: "destructive" });
                  }
                }}
                data-testid="button-sign-contract"
              >
                {signContractMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Edit className="h-4 w-4 mr-2" />
                )}
                Podpísať zmluvu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
