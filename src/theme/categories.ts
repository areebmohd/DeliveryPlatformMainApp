export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const PRODUCT_CATEGORIES: Category[] = [
  { id: '1', name: 'Clothing', icon: 'tshirt-crew-outline' },
  { id: '2', name: 'Electronics', icon: 'laptop' },
  { id: '3', name: 'Food', icon: 'food-variant' },
  { id: '4', name: 'Health', icon: 'medical-bag' },
  { id: '5', name: 'Stationery', icon: 'pencil-outline' },
  { id: '6', name: 'Home', icon: 'home-outline' },
  { id: '7', name: 'Kids', icon: 'baby-carriage' },
  { id: '8', name: 'Sports', icon: 'basketball' },
  { id: '9', name: 'Vehicles', icon: 'car-side' },
  { id: '10', name: 'Hardware', icon: 'hammer-wrench' },
  { id: '11', name: 'Animals', icon: 'paw' },
  { id: '12', name: 'Art', icon: 'palette-outline' },
  { id: '13', name: 'Others', icon: 'dots-horizontal-circle-outline' },
];
