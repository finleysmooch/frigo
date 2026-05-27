// ============================================
// FRIGO — LIST ICON (Phase 8R-UX6 Item 4b)
// ============================================
// Shared lookup from view → icon for the four default lists. Extracted from
// three duplicates (ViewsScreen, ViewDetailScreen, ListPickerModal).
//
// Drift caught during extraction: ViewsScreen wrapped the icon in a
// 56px-wide centered slot (for card layout alignment), while the other two
// rendered the raw icon. This helper returns the raw icon; the slot wrapper
// stays in ViewsScreen at the call site.
//
// Custom (non-default) views return null — callers fall back to the view's
// emoji.
// ============================================

import React from 'react';
import GroceryBagIcon from '../../components/icons/grocery/GroceryBagIcon';
import ShoppingCartIcon from '../../components/icons/grocery/ShoppingCartIcon';
import ReceiptIcon from '../../components/icons/grocery/ReceiptIcon';
import CartIcon from '../../components/icons/grocery/CartIcon';
import { ViewWithFilters } from '../types/views';

export interface ListIconOptions {
  size: number;
  /** Brand teal for Short / Medium / Long list. */
  iconColor: string;
  /** In Cart is a "done / staged" state, rendered black per ViewsScreen. */
  cartColor: string;
}

/**
 * Returns the icon for a default list, or null for custom lists (caller
 * should fall back to the view's emoji).
 */
export function renderListIcon(
  view: ViewWithFilters,
  options: ListIconOptions
): React.ReactElement | null {
  if (!view.is_default) return null;
  switch (view.name) {
    case 'Short List':
      return <GroceryBagIcon size={options.size} color={options.iconColor} />;
    case 'Medium List':
      return <ShoppingCartIcon size={options.size} color={options.iconColor} />;
    case 'Long List':
      return <ReceiptIcon size={options.size} color={options.iconColor} />;
    case 'In Cart':
      return <CartIcon size={options.size} color={options.cartColor} />;
    default:
      return null;
  }
}
