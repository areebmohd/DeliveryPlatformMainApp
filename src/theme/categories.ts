export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const PRODUCT_CATEGORIES: Category[] = [
  { id: '1', name: 'Clothing & Accessories', icon: 'tshirt-crew-outline' },
  { id: '2', name: 'Electronics & Appliances', icon: 'laptop' },
  { id: '3', name: 'Food & Beverages', icon: 'food-variant' },
  { id: '4', name: 'Health & Beauty', icon: 'medical-bag' },
  { id: '5', name: 'Home & Garden', icon: 'home-outline' },
  { id: '6', name: 'Toys, Baby & Games', icon: 'baby-carriage' },
  { id: '7', name: 'Sports & Outdoors', icon: 'basketball' },
  { id: '8', name: 'Vehicles & Parts', icon: 'car-side' },
  { id: '9', name: 'Hardware & Industrial', icon: 'hammer-wrench' },
  { id: '10', name: 'Animals & Pet Supplies', icon: 'paw' },
  { id: '11', name: 'Arts, Crafts & Entertainment', icon: 'palette-outline' },
  { id: '12', name: 'Office & School', icon: 'pencil-outline' },
  { id: '13', name: 'Others', icon: 'dots-horizontal-circle-outline' },
];
