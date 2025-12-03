/**
 * Enhanced Pricing Configuration Component
 * Allows librarians to easily manage all printing prices
 */

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DollarSign, Edit, Save, X, RefreshCw } from 'lucide-react';

type PaperSize = 'SHORT' | 'LONG';
type ColorLevel = 'BW' | 'HALF_COLOR' | 'FULL_COLOR';

interface Pricing {
  id: string;
  paper_size: PaperSize;
  color_level: ColorLevel;
  price: number;
  is_active: boolean;
}

// Default pricing structure - all combinations
const DEFAULT_PRICING_MATRIX: Array<{
  paper_size: PaperSize;
  color_level: ColorLevel;
  defaultPrice: number;
  label: string;
}> = [
  {
    paper_size: 'SHORT',
    color_level: 'BW',
    defaultPrice: 2,
    label: 'Short B&W',
  },
  {
    paper_size: 'SHORT',
    color_level: 'HALF_COLOR',
    defaultPrice: 5,
    label: 'Short Half Color',
  },
  {
    paper_size: 'SHORT',
    color_level: 'FULL_COLOR',
    defaultPrice: 10,
    label: 'Short Full Color',
  },
  { paper_size: 'LONG', color_level: 'BW', defaultPrice: 3, label: 'Long B&W' },
  {
    paper_size: 'LONG',
    color_level: 'HALF_COLOR',
    defaultPrice: 6,
    label: 'Long Half Color',
  },
  {
    paper_size: 'LONG',
    color_level: 'FULL_COLOR',
    defaultPrice: 11,
    label: 'Long Full Color',
  },
];

interface PricingConfigurationProps {
  onPricingUpdate?: () => void;
}

export default function PricingConfiguration({
  onPricingUpdate,
}: PricingConfigurationProps) {
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>(
    {}
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkPrices, setBulkPrices] = useState<Record<string, number>>({});

  // Load pricing
  const loadPricing = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<Pricing[]>('/api/printing/pricing');
      if (res.success && res.data) {
        setPricing(res.data);
      } else {
        setPricing([]);
      }
    } catch {
      toast.error('Failed to load pricing');
      setPricing([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  // Build the pricing matrix combining existing prices with defaults
  const pricingMatrix = useMemo(() => {
    return DEFAULT_PRICING_MATRIX.map((item) => {
      const existingPrice = pricing.find(
        (p) =>
          p.paper_size === item.paper_size &&
          p.color_level === item.color_level &&
          p.is_active
      );
      return {
        ...item,
        currentPrice: existingPrice?.price ?? item.defaultPrice,
        priceId: existingPrice?.id,
        hasPrice: !!existingPrice,
      };
    });
  }, [pricing]);

  // Initialize editing prices
  const startEditing = () => {
    const initial: Record<string, number> = {};
    pricingMatrix.forEach((item) => {
      const key = `${item.paper_size}_${item.color_level}`;
      initial[key] = item.currentPrice;
    });
    setEditingPrices(initial);
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPrices({});
    setIsEditing(false);
  };

  // Save all prices
  const saveAllPrices = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingPrices).map(([key, price]) => {
        const [paper_size, color_level] = key.split('_') as [
          PaperSize,
          ColorLevel,
        ];
        return { paper_size, color_level, price };
      });

      // Create/update each pricing
      let successCount = 0;
      for (const update of updates) {
        const res = await apiClient.post('/api/printing/pricing', update);
        if (res.success) successCount++;
      }

      if (successCount === updates.length) {
        toast.success('All prices updated successfully');
        setIsEditing(false);
        setEditingPrices({});
        loadPricing();
        onPricingUpdate?.();
      } else {
        toast.warning(`Updated ${successCount}/${updates.length} prices`);
        loadPricing();
      }
    } catch {
      toast.error('Failed to save prices');
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk update dialog (for future use)
  const _openBulkUpdate = () => {
    const initial: Record<string, number> = {};
    pricingMatrix.forEach((item) => {
      const key = `${item.paper_size}_${item.color_level}`;
      initial[key] = item.currentPrice;
    });
    setBulkPrices(initial);
    setShowBulkDialog(true);
  };

  const applyBulkUpdate = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(bulkPrices).map(([key, price]) => {
        const [paper_size, color_level] = key.split('_') as [
          PaperSize,
          ColorLevel,
        ];
        return { paper_size, color_level, price };
      });

      let successCount = 0;
      for (const update of updates) {
        const res = await apiClient.post('/api/printing/pricing', update);
        if (res.success) successCount++;
      }

      if (successCount === updates.length) {
        toast.success('All prices updated successfully');
        setShowBulkDialog(false);
        setBulkPrices({});
        loadPricing();
        onPricingUpdate?.();
      } else {
        toast.warning(`Updated ${successCount}/${updates.length} prices`);
        loadPricing();
      }
    } catch {
      toast.error('Failed to save prices');
    } finally {
      setIsSaving(false);
    }
  };

  const getColorLevelLabel = (level: ColorLevel) => {
    switch (level) {
      case 'BW':
        return 'Black & White';
      case 'HALF_COLOR':
        return 'Half Color';
      case 'FULL_COLOR':
        return 'Full Color';
      default:
        return level;
    }
  };

  const getColorBadgeVariant = (
    level: ColorLevel
  ): 'default' | 'secondary' | 'outline' => {
    switch (level) {
      case 'BW':
        return 'outline';
      case 'HALF_COLOR':
        return 'secondary';
      case 'FULL_COLOR':
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="shadow-md border-slate-200 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Printing Prices
          </CardTitle>
          <CardDescription>
            Configure prices for different paper sizes and color options
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={saveAllPrices} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save All'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPricing}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
              <Button size="sm" onClick={startEditing}>
                <Edit className="h-4 w-4 mr-1" />
                Edit Prices
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Paper Size</TableHead>
                  <TableHead>Color Type</TableHead>
                  <TableHead className="text-right">Price per Page</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingMatrix.map((item) => {
                  const key = `${item.paper_size}_${item.color_level}`;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">
                        {item.paper_size === 'SHORT' ? 'Short (A4)' : 'Long'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getColorBadgeVariant(item.color_level)}>
                          {getColorLevelLabel(item.color_level)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground">₱</span>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              className="w-20 h-8 text-right"
                              value={editingPrices[key] ?? item.currentPrice}
                              onChange={(e) =>
                                setEditingPrices((prev) => ({
                                  ...prev,
                                  [key]: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </div>
                        ) : (
                          <span
                            className={
                              item.hasPrice
                                ? 'font-semibold'
                                : 'text-muted-foreground'
                            }
                          >
                            ₱{item.currentPrice.toFixed(2)}
                            {!item.hasPrice && ' (default)'}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Quick Reference */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Quick Reference</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>• Short = Letter/A4 size paper</div>
            <div>• Long = Legal size paper</div>
            <div>• B&W = Black & White only</div>
            <div>• Half Color = Some color elements</div>
            <div>• Full Color = Full color print</div>
            <div>• Prices are per page</div>
          </div>
        </div>
      </CardContent>

      {/* Bulk Update Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Price Update</DialogTitle>
            <DialogDescription>
              Update all printing prices at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {DEFAULT_PRICING_MATRIX.map((item) => {
              const key = `${item.paper_size}_${item.color_level}`;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">₱</span>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      className="w-24 h-8"
                      value={bulkPrices[key] ?? item.defaultPrice}
                      onChange={(e) =>
                        setBulkPrices((prev) => ({
                          ...prev,
                          [key]: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={applyBulkUpdate} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update All Prices'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
