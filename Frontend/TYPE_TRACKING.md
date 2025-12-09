# TypeScript `any` Type Tracking

**Generated**: 2025-12-06  
**Total**: 63 `any` types  
**Fixable**: 36 | **Intentional Skips**: 27

---

## 📋 Fixable Types (36)

### Dashboard Components

| Status | File                                | Line | Code Pattern                     |
| ------ | ----------------------------------- | ---- | -------------------------------- |
| [x]    | `EquipmentUtilizationAnalytics.tsx` | 136  | `] as any);`                     |
| [ ]    | `MetricsCards.tsx`                  | 59   | `analyticsData as any;`          |
| [x]    | `AttendanceTracker.tsx`             | 109  | `(dataRes.data as any[]).map`    |
| [x]    | `AutomationDashboard.tsx`           | 63   | `(store as any)?.automationJobs` |
| [x]    | `AutomationDashboard.tsx`           | 65   | `(store as any).automationJobs`  |
| [x]    | `EquipmentDashboard.tsx`            | 909  | `(item: any)`                    |
| [x]    | `ReportsBuilder.tsx`                | 242  | `new Blob([response as any]`     |
| [x]    | `SelfServiceMode.tsx`               | 265  | `catch (error: any)`             |

### Dialogs & Import

| Status | File                   | Line | Code Pattern              |
| ------ | ---------------------- | ---- | ------------------------- |
| [x]    | `BookImportDialog.tsx` | 382  | `Promise<any>`            |
| [x]    | `BookImportDialog.tsx` | 397  | `(result: any)`           |
| [x]    | `BookCheckout.tsx`     | 345  | `(resp?.data as any[])`   |
| [x]    | `BookCheckout.tsx`     | 390  | `(search.data as any[])`  |
| [x]    | `BarcodeManager.tsx`   | 72   | `(response as any).error` |

### Context & Services

| Status | File                   | Line | Code Pattern          |
| ------ | ---------------------- | ---- | --------------------- |
| [x]    | `AuthContext.tsx`      | 221  | `catch (error: any)`  |
| [x]    | `WebSocketContext.tsx` | 209  | `data: any;`          |
| [x]    | `FineManagement.tsx`   | 51   | `apiClient.post<any>` |

### Library Files

| Status | File                    | Line | Code Pattern                         |
| ------ | ----------------------- | ---- | ------------------------------------ |
| [x]    | `errors.ts`             | 9    | `[key: string]: any`                 |
| [x]    | `errors.ts`             | 42   | `payload.error as any`               |
| [x]    | `api.ts`                | 37   | `} as any;`                          |
| [x]    | `scanner.ts`            | 312  | `(window as any).webkitAudioContext` |
| [x]    | `error-utils.ts`        | 285  | `err as any`                         |
| [x]    | `smart-search.tsx`      | 17   | `data?: any;`                        |
| [x]    | `PWAInstallPrompt.tsx`  | 41   | `(navigator as any).standalone`      |
| [x]    | `OptimizedImage.tsx`    | 301  | `as any;`                            |
| [x]    | `CompoundComponent.tsx` | 233  | `ComponentType<any>`                 |

---

## ⏭️ Intentional Skips (27)

### Radix UI Wrappers (22)

| File                | Lines  | Reason                             |
| ------------------- | ------ | ---------------------------------- |
| `dropdown-menu.tsx` | 9-24   | Radix primitive type compatibility |
| `tabs.tsx`          | 58-61  | Radix primitive exports            |
| `progress.tsx`      | 19     | Radix indicator component          |
| `scroll-area.tsx`   | 22, 43 | Radix scroll components            |

### Type Utilities (5)

| File             | Lines            | Reason                   |
| ---------------- | ---------------- | ------------------------ |
| `type-utils.ts`  | 63, 571          | Generic type inference   |
| `RenderProps.ts` | 59, 60, 493, 508 | HOC pattern requirements |

### Performance/Test (6)

| File                      | Lines         | Reason                   |
| ------------------------- | ------------- | ------------------------ |
| `performanceBenchmark.ts` | 192, 193, 217 | Browser performance APIs |
| `performanceTest.ts`      | 30, 47, 293   | Test metrics typing      |
| `state-manager.ts`        | 100, 155, 165 | Zustand middleware       |

---

## 🔧 Fix Strategies

| Pattern           | Fix                            |
| ----------------- | ------------------------------ |
| `error: any`      | → `error: unknown`             |
| `data as any[]`   | → Define interface, cast to it |
| `store as any`    | → Type store properly          |
| `response as any` | → Use API response type        |
| `Promise<any>`    | → Define return type           |
| `(item: any)`     | → Use existing interface       |

---

## ✅ Verification

```bash
# Count remaining any types
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | `
  Select-String -Pattern ': any|<any>|as any' | `
  Measure-Object | Select-Object -ExpandProperty Count
```
