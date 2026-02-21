export interface User {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  reference?: string;
  photo?: string;
  role: 'client' | 'partner';
}

export interface Store {
  id: number;
  owner_id: number;
  name: string;
  phone: string;
  address: string;
  email?: string;
  delivery_fee: number;
  min_free_delivery?: number;
  status: 'online' | 'offline';
  whatsapp?: string;
  parking_photo?: string;
  interior_photo?: string;
  category: string;
}

export interface Product {
  id: number;
  store_id: number;
  name: string;
  description?: string;
  price: number;
  category: string;
  photo?: string;
  available: boolean;
}

export interface Order {
  id: number;
  client_id: number;
  store_id: number;
  status: 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered';
  total: number;
  payment_method: 'pix' | 'card' | 'cash';
  change_for?: number;
  created_at: string;
  store_name?: string;
  client_name?: string;
  client_phone?: string;
  client_address?: string;
}

export interface CartItem extends Product {
  quantity: number;
}
