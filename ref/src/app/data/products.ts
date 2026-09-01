import { Product } from '@/app/types';

export const PRODUCTS: Product[] = [
  // Beverages
  { id: 'p1', name: 'Coffee', price: 3.50, category: 'Beverages' },
  { id: 'p2', name: 'Latte', price: 4.50, category: 'Beverages' },
  { id: 'p3', name: 'Cappuccino', price: 4.25, category: 'Beverages' },
  { id: 'p4', name: 'Espresso', price: 2.50, category: 'Beverages' },
  { id: 'p5', name: 'Tea', price: 2.75, category: 'Beverages' },
  { id: 'p6', name: 'Iced Coffee', price: 4.00, category: 'Beverages' },
  { id: 'p7', name: 'Hot Chocolate', price: 3.75, category: 'Beverages' },
  { id: 'p8', name: 'Smoothie', price: 5.50, category: 'Beverages' },
  { id: 'p9', name: 'Juice', price: 3.25, category: 'Beverages' },
  
  // Food
  { id: 'p10', name: 'Croissant', price: 3.50, category: 'Food' },
  { id: 'p11', name: 'Bagel', price: 2.75, category: 'Food' },
  { id: 'p12', name: 'Muffin', price: 3.25, category: 'Food' },
  { id: 'p13', name: 'Sandwich', price: 7.50, category: 'Food' },
  { id: 'p14', name: 'Salad', price: 8.50, category: 'Food' },
  { id: 'p15', name: 'Wrap', price: 7.25, category: 'Food' },
  { id: 'p16', name: 'Soup', price: 5.50, category: 'Food' },
  { id: 'p17', name: 'Cookie', price: 2.25, category: 'Food' },
  { id: 'p18', name: 'Brownie', price: 3.50, category: 'Food' },
  
  // Snacks
  { id: 'p19', name: 'Chips', price: 1.99, category: 'Snacks' },
  { id: 'p20', name: 'Nuts', price: 3.99, category: 'Snacks' },
  { id: 'p21', name: 'Granola Bar', price: 2.50, category: 'Snacks' },
  { id: 'p22', name: 'Protein Bar', price: 3.75, category: 'Snacks' },
  { id: 'p23', name: 'Trail Mix', price: 4.25, category: 'Snacks' },
  { id: 'p24', name: 'Fruit Cup', price: 3.50, category: 'Snacks' },
];

export const CATEGORIES = ['All', 'Beverages', 'Food', 'Snacks'];
