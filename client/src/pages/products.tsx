import { RecordTagsBadges } from "@/components/record-tags-badges";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { type Product, COUNTRIES } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  currency: z.string().default("EUR"),
  category: z.string().optional(),
  countries: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

const getCategoriesWithTranslations = (t: any) => [
  { value: "cord_blood", label: t.products.categories.cordBlood },
  { value: "cord_tissue", label: t.products.categories.cordTissue },
  { value: "storage", label: t.products.categories.storage },
  { value: "processing", label: t.products.categories.processing },
  { value: "testing", label: t.products.categories.testing },
  { value: "other", label: t.products.categories.other },
];

const CURRENCIES = ["EUR", "USD", "CZK", "HUF", "RON"];

function ProductForm({
  initialData,
  onSubmit,
  isLoading,
  onCancel,
  t,
}: {
  initialData?: Product;
  onSubmit: (data: ProductFormData) => void;
  isLoading: boolean;
  onCancel: () => void;
  t: any;
}) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description || "",
          price: initialData.price,
          currency: initialData.currency,
          category: initialData.category || "",
          countries: initialData.countries || [],
          isActive: initialData.isActive,
        }
      : {
          name: "",
          description: "",
          price: "",
          currency: "EUR",
          category: "",
          countries: [],
          isActive: true,
        },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.products.productName}</FormLabel>
              <FormControl>
                <Input placeholder={t.products.productName} {...field} data-testid="input-product-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.products.description}</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t.products.description} 
                  {...field} 
                  data-testid="input-product-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.products.price}</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...field} 
                    data-testid="input-product-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.products.currency}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-product-currency">
                      <SelectValue placeholder={t.products.selectCurrency} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
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
          control={form.control}
          name="category"
          render={({ field }) => {
            const categories = getCategoriesWithTranslations(t);
            return (
              <FormItem>
                <FormLabel>{t.products.category}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-product-category">
                      <SelectValue placeholder={t.products.selectCategory} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="countries"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.products.availableInCountries}</FormLabel>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                {COUNTRIES.map((country) => (
                  <div key={country.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`country-${country.code}`}
                      checked={field.value?.includes(country.code)}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...(field.value || []), country.code]
                          : (field.value || []).filter((c) => c !== country.code);
                        field.onChange(newValue);
                      }}
                      data-testid={`checkbox-country-${country.code}`}
                    />
                    <Label htmlFor={`country-${country.code}`} className="text-sm cursor-pointer">
                      {country.name}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.products.selectCountriesHint}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t.products.productActive}</FormLabel>
                <p className="text-sm text-muted-foreground">
                  {t.products.productActiveHint}
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-product-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-product">
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save-product">
            {isLoading ? t.products.saving : initialData ? t.products.updateProduct : t.products.createProduct}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function ProductsPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Filter countries based on user's assigned countries
  const userCountryCodes = useMemo(() => {
    if (!user?.assignedCountries || user.assignedCountries.length === 0) {
      return null; // null means show all (for admins)
    }
    return user.assignedCountries;
  }, [user?.assignedCountries]);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Filter products by user's assigned countries
  const userProducts = useMemo(() => {
    if (!userCountryCodes) return products; // Admins see all
    return products.filter(product => {
      // Show products that have at least one country matching user's countries
      // or products with no countries assigned (global products)
      if (!product.countries || product.countries.length === 0) return true;
      return product.countries.some(c => userCountryCodes.includes(c));
    });
  }, [products, userCountryCodes]);

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsFormOpen(false);
      toast({ title: t.success.created });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormData & { id: string }) =>
      apiRequest("PATCH", `/api/products/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingProduct(null);
      toast({ title: t.success.updated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDeletingProduct(null);
      toast({ title: t.success.deleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const filteredProducts = userProducts.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const getCategoryLabel = (category: string | null) => {
    if (!category) return t.products.categories.other;
    const categories = getCategoriesWithTranslations(t);
    return categories.find(c => c.value === category)?.label || category;
  };

  const columns = [
    {
      key: "product",
      header: t.products.productName,
      cell: (product: Product) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {product.description || t.common.noData}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t.products.category,
      cell: (product: Product) => (
        <Badge variant="outline" className="capitalize">
          {getCategoryLabel(product.category)}
        </Badge>
      ),
    },
    {
      key: "countries",
      header: t.common.country,
      cell: (product: Product) => (
        <div className="flex flex-wrap gap-1">
          {product.countries && product.countries.length > 0 ? (
            product.countries.slice(0, 3).map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">
                {code}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">{t.common.allCountries}</span>
          )}
          {product.countries && product.countries.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{product.countries.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "price",
      header: t.products.price,
      cell: (product: Product) => (
        <span className="font-medium">
          {parseFloat(product.price).toFixed(2)} {product.currency}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (product: Product) => (
        <Badge variant={product.isActive ? "default" : "secondary"}>
          {product.isActive ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (product: Product) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setEditingProduct(product);
            }}
            data-testid={`button-edit-product-${product.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingProduct(product);
            }}
            data-testid={`button-delete-product-${product.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.products.title}
        description={t.products.pageDescription}
      >
        <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-2" />
          {t.products.addProduct}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.products.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-products"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredProducts.length} {t.products.title.toLowerCase()}
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredProducts}
        isLoading={isLoading}
        emptyMessage={t.products.noProducts}
        getRowKey={(p) => p.id}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.products.addNewProduct}</DialogTitle>
            <DialogDescription>
              {t.products.pageDescription}
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
            onCancel={() => setIsFormOpen(false)}
            t={t}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.products.editProduct}</DialogTitle>
            {editingProduct && <RecordTagsBadges entityType="product" entityId={editingProduct.id} tags={editingProduct.tags} />}
            <DialogDescription>
              {t.products.updateProductInfo}
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <ProductForm
              initialData={editingProduct}
              onSubmit={(data) => updateMutation.mutate({ ...data, id: editingProduct.id })}
              isLoading={updateMutation.isPending}
              onCancel={() => setEditingProduct(null)}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.products.deleteProduct}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.products.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-product">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProduct && deleteMutation.mutate(deletingProduct.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-product"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
