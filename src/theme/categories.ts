export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const PRODUCT_CATEGORIES: Category[] = [
  { id: '1', name: 'Grocery', icon: 'basket-outline' },
  { id: '2', name: 'Clothing', icon: 'tshirt-crew-outline' },
  { id: '4', name: 'Food', icon: 'food-variant' },
  { id: '3', name: 'Electronics', icon: 'laptop' },
  { id: '5', name: 'Health', icon: 'medical-bag' },
  { id: '6', name: 'Stationery', icon: 'pencil-outline' },
  { id: '7', name: 'Home', icon: 'home-outline' },
  { id: '8', name: 'Kids', icon: 'baby-carriage' },
  { id: '9', name: 'Sports', icon: 'basketball' },
  { id: '10', name: 'Vehicles', icon: 'car-side' },
  { id: '11', name: 'Hardware', icon: 'hammer-wrench' },
  { id: '12', name: 'Animals', icon: 'paw' },
  { id: '13', name: 'Art', icon: 'palette-outline' },
  { id: '14', name: 'Others', icon: 'dots-horizontal-circle-outline' },
];
