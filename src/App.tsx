import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Search, 
  User as UserIcon, 
  Home, 
  ChevronRight, 
  Plus, 
  Minus, 
  X, 
  Clock, 
  MapPin, 
  Phone, 
  LogOut, 
  Store as StoreIcon, 
  Package, 
  Camera, 
  CheckCircle2,
  ArrowLeft,
  MessageCircle,
  CreditCard,
  DollarSign,
  QrCode,
  Bell,
  Trash2,
  PlusCircle,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
import { User, Store, Product, Order, CartItem } from './types';
import { DEVELOPER_INFO, PARTNER_SECRET_CODE, ORDER_STATUS_LABELS, CATEGORIES } from './constants';

// --- Supabase Client ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const base = "w-full py-3 px-4 rounded-xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2";
  const variants: any = {
    primary: "bg-primary text-white shadow-lg shadow-orange-200 disabled:bg-slate-300",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    outline: "border-2 border-primary text-primary hover:bg-orange-50",
    ghost: "text-slate-500 hover:bg-slate-100"
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, ...props }: any) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-slate-600 mb-1 ml-1">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />}
      <input 
        {...props} 
        className={`w-full bg-white border border-slate-200 rounded-xl py-3 ${Icon ? 'pl-12' : 'px-4'} pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all`}
      />
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [view, setView] = useState<'home' | 'search' | 'orders' | 'profile' | 'store_detail' | 'cart' | 'checkout' | 'partner_dashboard' | 'partner_menu' | 'partner_orders' | 'login' | 'register'>('home');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [partnerOrders, setPartnerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [regStep, setRegStep] = useState(1);

  // Auth State
  const [authData, setAuthData] = useState({ phone: '', pin: '', name: '', email: '', address: '', reference: '', role: 'client' as 'client' | 'partner' });
  const [partnerRegData, setPartnerRegData] = useState({ storeName: '', storePhone: '', storeAddress: '', storeEmail: '', deliveryFee: '0', minFree: '', category: 'Restaurantes', protocol: '' });

  // Partner Menu State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', category: 'Comida' });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedStore = localStorage.getItem('store');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedStore) setStore(JSON.parse(savedStore));
    fetchStores();
  }, []);

  useEffect(() => {
    if (view === 'orders') fetchMyOrders();
    if (view === 'partner_orders') fetchPartnerOrders();
    if (view === 'partner_menu' && store) fetchProducts(store.id);
  }, [view, user, store]);

  useEffect(() => {
    if (user) {
      // Subscribe to orders changes
      const channel = supabase
        .channel('db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: user.role === 'partner' ? `store_id=eq.${store?.id}` : `client_id=eq.${user.id}`
          },
          (payload) => {
            if (user.role === 'partner') {
              setNotifications(prev => [...prev, `Novo pedido recebido! #${payload.new.id}`]);
              fetchPartnerOrders();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: user.role === 'client' ? `client_id=eq.${user.id}` : `store_id=eq.${store?.id}`
          },
          (payload) => {
            if (user.role === 'client') {
              setNotifications(prev => [...prev, `Seu pedido #${payload.new.id} está ${ORDER_STATUS_LABELS[payload.new.status]}`]);
              fetchMyOrders();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, store]);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setStores(data);
      }
    } catch (e) {
      console.error('Error fetching stores:', e);
    }
  };

  const fetchProducts = async (storeId: number) => {
    try {
      const res = await fetch(`/api/stores/${storeId}/products`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchMyOrders = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/orders/client/${user.id}`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setMyOrders(data);
      }
    } catch (e) {
      console.error('Error fetching my orders:', e);
    }
  };

  const fetchPartnerOrders = async () => {
    if (!store) return;
    try {
      const res = await fetch(`/api/orders/store/${store.id}`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setPartnerOrders(data);
      }
    } catch (e) {
      console.error('Error fetching partner orders:', e);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: authData.phone, pin: authData.pin })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('O servidor retornou um erro inesperado (HTML). Verifique se o backend está rodando corretamente no Vercel.');
      }

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setStore(data.store);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.store) localStorage.setItem('store', JSON.stringify(data.store));
        setView(data.user.role === 'partner' ? 'partner_dashboard' : 'home');
      } else {
        alert(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!authData.name || !authData.phone || !authData.pin) {
      alert('Por favor, preencha nome, telefone e PIN.');
      return;
    }

    if (authData.role === 'partner') {
      if (partnerRegData.protocol !== PARTNER_SECRET_CODE) {
        alert('Código de protocolo inválido. Entre em contato com o desenvolvedor.');
        return;
      }
      if (!partnerRegData.storeName || !partnerRegData.storePhone || !partnerRegData.storeAddress) {
        alert('Por favor, preencha os dados da loja.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error('Resposta não-JSON:', text);
        throw new Error('O servidor retornou um erro inesperado. Verifique os logs do Vercel.');
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta de usuário');
      }

      let userStore = null;
      if (authData.role === 'partner') {
        const storeRes = await fetch('/api/partner/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_id: data.id,
            name: partnerRegData.storeName,
            phone: partnerRegData.storePhone,
            address: partnerRegData.storeAddress,
            email: partnerRegData.storeEmail,
            delivery_fee: parseFloat(partnerRegData.deliveryFee) || 0,
            min_free_delivery: partnerRegData.minFree ? parseFloat(partnerRegData.minFree) : null,
            category: partnerRegData.category,
            whatsapp: partnerRegData.storePhone
          })
        });
        
        const storeContentType = storeRes.headers.get("content-type");
        if (!storeContentType || !storeContentType.includes("application/json")) {
          throw new Error('Erro ao criar loja: O servidor retornou uma resposta inválida.');
        }

        userStore = await storeRes.json();
        
        if (!storeRes.ok) {
          throw new Error(userStore.error || 'Erro ao criar loja');
        }

        setStore(userStore);
        localStorage.setItem('store', JSON.stringify(userStore));
      }

      const userWithId = { ...authData, id: data.id };
      setUser(userWithId);
      localStorage.setItem('user', JSON.stringify(userWithId));
      setView(authData.role === 'partner' ? 'partner_dashboard' : 'home');
      
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const handleCheckout = async (paymentMethod: string, changeFor?: string) => {
    if (!user || !selectedStore) return;
    setLoading(true);
    try {
      const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
      const total = subtotal + selectedStore.delivery_fee;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: user.id,
          store_id: selectedStore.id,
          items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, price: item.price })),
          total,
          payment_method: paymentMethod,
          change_for: changeFor ? parseFloat(changeFor) : null
        })
      });
      if (res.ok) {
        const data = await res.json();
        
        // Generate WhatsApp Link
        const itemsText = cart.map(i => `${i.quantity}x ${i.name} (R$ ${i.price.toFixed(2)})`).join('\n');
        const message = `*Novo Pedido no Delivery Pira!* 🚀\n\n` +
          `*Pedido:* #${data.orderId}\n` +
          `*Cliente:* ${user.name}\n` +
          `*Telefone:* ${user.phone}\n` +
          `*Endereço:* ${user.address}\n` +
          `*Referência:* ${user.reference}\n\n` +
          `*Itens:*\n${itemsText}\n\n` +
          `*Subtotal:* R$ ${subtotal.toFixed(2)}\n` +
          `*Taxa de Entrega:* R$ ${selectedStore.delivery_fee.toFixed(2)}\n` +
          `*TOTAL:* R$ ${total.toFixed(2)}\n\n` +
          `*Pagamento:* ${paymentMethod.toUpperCase()}${changeFor ? ` (Troco para R$ ${changeFor})` : ''}`;
        
        const whatsappUrl = `https://wa.me/${selectedStore.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        
        setCart([]);
        setView('orders');
        fetchMyOrders();
        
        // Open WhatsApp
        window.open(whatsappUrl, '_blank');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchPartnerOrders();
  };

  const toggleStoreStatus = async () => {
    if (!store) return;
    const newStatus = store.status === 'online' ? 'offline' : 'online';
    await fetch(`/api/partner/store/${store.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const updatedStore = { ...store, status: newStatus as any };
    setStore(updatedStore);
    localStorage.setItem('store', JSON.stringify(updatedStore));
  };

  const handleAddProduct = async () => {
    if (!store) return;
    setLoading(true);
    try {
      const res = await fetch('/api/partner/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.id,
          ...newProduct,
          price: parseFloat(newProduct.price)
        })
      });
      if (res.ok) {
        setShowAddProduct(false);
        setNewProduct({ name: '', description: '', price: '', category: 'Comida' });
        fetchProducts(store.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    await fetch(`/api/partner/products/${id}`, { method: 'DELETE' });
    if (store) fetchProducts(store.id);
  };

  // --- Views ---

  const renderHome = () => (
    <div className="pb-24">
      <header className="bg-white px-6 pt-8 pb-6 rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">Delivery Pira</h1>
            <p className="text-slate-500 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Pirapemas, MA
            </p>
          </div>
          <button onClick={() => setView('profile')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <UserIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="O que você quer pedir hoje?" 
            className="w-full bg-slate-100 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </header>

      <section className="px-6 mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-display font-bold">Categorias</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} className="flex-shrink-0 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 font-medium text-slate-700">
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section className="px-6 mt-8">
        <h2 className="text-lg font-display font-bold mb-4">Estabelecimentos</h2>
        <div className="space-y-4">
          {stores.map(s => (
            <div 
              key={s.id} 
              onClick={() => { setSelectedStore(s); fetchProducts(s.id); setView('store_detail'); }}
              className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer active:scale-98 transition-transform"
            >
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400">
                <StoreIcon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-slate-900">{s.name}</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Aberto</span>
                </div>
                <p className="text-sm text-slate-500 mb-2">{s.category}</p>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 30-45 min</span>
                  <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Taxa: R$ {s.delivery_fee.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderStoreDetail = () => (
    <div className="pb-24">
      <div className="relative h-48 bg-primary">
        <button onClick={() => setView('home')} className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 -mt-12">
        <div className="bg-white p-6 rounded-3xl shadow-xl">
          <h1 className="text-2xl font-display font-bold mb-1">{selectedStore?.name}</h1>
          <p className="text-slate-500 text-sm mb-4">{selectedStore?.category}</p>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-600 border-t border-slate-100 pt-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-slate-400 text-xs">Tempo</span>
              <span>30-45 min</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-slate-400 text-xs">Entrega</span>
              <span>R$ {selectedStore?.delivery_fee.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="px-6 mt-8">
        <h2 className="text-lg font-display font-bold mb-4">Cardápio</h2>
        <div className="space-y-4">
          {products.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{p.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-2">{p.description}</p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-primary">R$ {p.price.toFixed(2)}</span>
                  <div className="flex items-center gap-3">
                    {cart.find(i => i.id === p.id) ? (
                      <>
                        <button onClick={() => removeFromCart(p.id)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-bold">{cart.find(i => i.id === p.id)?.quantity}</span>
                        <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                          <Plus className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => addToCart(p)} className="bg-primary/10 text-primary px-4 py-1.5 rounded-full font-bold text-sm">
                        Adicionar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-24 h-24 bg-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400">
                <Package className="w-8 h-8" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {cart.length > 0 && (
        <div className="fixed bottom-24 left-6 right-6">
          <Button onClick={() => setView('cart')} className="shadow-2xl">
            <ShoppingBag className="w-5 h-5" />
            Ver Carrinho ({cart.reduce((acc, i) => acc + i.quantity, 0)})
            <span className="ml-auto">R$ {cart.reduce((acc, i) => acc + i.price * i.quantity, 0).toFixed(2)}</span>
          </Button>
        </div>
      )}
    </div>
  );

  const renderCart = () => {
    const subtotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const delivery = selectedStore?.delivery_fee || 0;
    const total = subtotal + delivery;

    return (
      <div className="pb-24">
        <header className="px-6 pt-8 pb-4 flex items-center gap-4">
          <button onClick={() => setView('store_detail')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-bold">Seu Carrinho</h1>
        </header>

        <div className="px-6 space-y-4 mt-4">
          {cart.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900">{item.name}</h3>
                <p className="text-sm text-primary font-bold">R$ {item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold">{item.quantity}</span>
                <button onClick={() => addToCart(item)} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 mt-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Taxa de entrega</span>
              <span>R$ {delivery.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-100">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>
          <Button onClick={() => setView('checkout')} className="mt-6">Continuar para Pagamento</Button>
        </div>
      </div>
    );
  };

  const renderCheckout = () => {
    const [method, setMethod] = useState('pix');
    const [change, setChange] = useState('');

    return (
      <div className="pb-24">
        <header className="px-6 pt-8 pb-4 flex items-center gap-4">
          <button onClick={() => setView('cart')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-bold">Pagamento</h1>
        </header>

        <div className="px-6 mt-6 space-y-6">
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Endereço de Entrega</h2>
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 items-center">
              <div className="w-10 h-10 bg-orange-50 text-primary rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{user?.address}</p>
                <p className="text-xs text-slate-500">{user?.reference}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Método de Pagamento</h2>
            <div className="space-y-3">
              {[
                { id: 'pix', label: 'Pix', icon: QrCode },
                { id: 'card', label: 'Cartão (na entrega)', icon: CreditCard },
                { id: 'cash', label: 'Dinheiro', icon: DollarSign }
              ].map(m => (
                <div 
                  key={m.id} 
                  onClick={() => setMethod(m.id)}
                  className={`p-4 rounded-3xl border-2 transition-all flex items-center gap-4 cursor-pointer ${method === m.id ? 'border-primary bg-orange-50' : 'border-slate-100 bg-white'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === m.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-bold ${method === m.id ? 'text-primary' : 'text-slate-700'}`}>{m.label}</span>
                  {method === m.id && <CheckCircle2 className="ml-auto w-5 h-5 text-primary" />}
                </div>
              ))}
            </div>
          </section>

          {method === 'cash' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <Input 
                label="Troco para quanto?" 
                placeholder="Ex: 50.00" 
                type="number" 
                value={change} 
                onChange={(e: any) => setChange(e.target.value)} 
              />
            </motion.div>
          )}

          {method === 'pix' && (
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
              <MessageCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Ao finalizar, você receberá o código Pix. Envie o comprovante para a loja via WhatsApp para agilizar seu pedido.
              </p>
            </div>
          )}

          <Button onClick={() => handleCheckout(method, change)} disabled={loading}>
            {loading ? 'Processando...' : 'Finalizar Pedido'}
          </Button>
        </div>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="pb-24">
      <header className="px-6 pt-8 pb-6">
        <h1 className="text-2xl font-display font-bold">Meus Pedidos</h1>
      </header>
      <div className="px-6 space-y-4">
        {myOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">Você ainda não fez nenhum pedido.</p>
          </div>
        ) : (
          myOrders.map(o => (
            <div key={o.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{o.store_name}</h3>
                  <p className="text-xs text-slate-400">Pedido #{o.id} • {new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${
                  o.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {ORDER_STATUS_LABELS[o.status]}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                <span className="text-sm font-medium text-slate-600">Total: R$ {o.total.toFixed(2)}</span>
                <button className="text-primary text-sm font-bold">Ver Detalhes</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="pb-24">
      <header className="px-6 pt-12 pb-8 bg-white text-center rounded-b-3xl shadow-sm">
        <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-300 relative">
          <UserIcon className="w-12 h-12" />
          <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center border-4 border-white">
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-xl font-display font-bold">{user?.name}</h2>
        <p className="text-slate-500 text-sm">{user?.phone}</p>
      </header>

      <div className="px-6 mt-8 space-y-3">
        <button className="w-full bg-white p-4 rounded-2xl flex items-center gap-4 text-slate-700 font-medium shadow-sm border border-slate-50">
          <MapPin className="w-5 h-5 text-slate-400" /> Meus Endereços <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
        </button>
        <button className="w-full bg-white p-4 rounded-2xl flex items-center gap-4 text-slate-700 font-medium shadow-sm border border-slate-50">
          <CreditCard className="w-5 h-5 text-slate-400" /> Pagamentos <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
        </button>
        <button className="w-full bg-white p-4 rounded-2xl flex items-center gap-4 text-slate-700 font-medium shadow-sm border border-slate-50">
          <Bell className="w-5 h-5 text-slate-400" /> Notificações <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
        </button>
        
        <div className="pt-6">
          <button 
            onClick={() => { setUser(null); setStore(null); localStorage.clear(); setView('login'); }}
            className="w-full bg-red-50 p-4 rounded-2xl flex items-center gap-4 text-red-600 font-bold"
          >
            <LogOut className="w-5 h-5" /> Sair da Conta
          </button>
        </div>

        <div className="mt-12 p-6 bg-slate-100 rounded-3xl text-center">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Desenvolvido por</p>
          <p className="text-sm font-bold text-slate-700">Delivery Pira Team</p>
          <p className="text-xs text-slate-500 mt-1">{DEVELOPER_INFO.email}</p>
          <p className="text-xs text-slate-500 mt-1">{DEVELOPER_INFO.whatsapp}</p>
        </div>
      </div>
    </div>
  );

  const renderPartnerDashboard = () => (
    <div className="pb-24">
      <header className="px-6 pt-8 pb-6 bg-white rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">{store?.name}</h1>
            <p className="text-slate-500 text-sm">Painel do Parceiro</p>
          </div>
          <button 
            onClick={toggleStoreStatus}
            className={`px-4 py-2 rounded-full font-bold text-xs transition-colors ${store?.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
          >
            {store?.status === 'online' ? 'LOJA ONLINE' : 'LOJA OFFLINE'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <p className="text-xs text-orange-600 font-bold uppercase mb-1">Vendas Hoje</p>
            <p className="text-xl font-display font-bold text-primary">R$ 0,00</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-blue-600 font-bold uppercase mb-1">Pedidos</p>
            <p className="text-xl font-display font-bold text-blue-700">0</p>
          </div>
        </div>
      </header>

      <div className="px-6 mt-8 space-y-4">
        <button onClick={() => { fetchPartnerOrders(); setView('partner_orders'); }} className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 text-primary rounded-2xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-900">Gerenciar Pedidos</h3>
            <p className="text-sm text-slate-500">Veja e atualize status</p>
          </div>
          <ChevronRight className="ml-auto w-5 h-5 text-slate-300" />
        </button>

        <button onClick={() => { if (store) fetchProducts(store.id); setView('partner_menu'); }} className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-900">Meu Cardápio</h3>
            <p className="text-sm text-slate-500">Produtos e preços</p>
          </div>
          <ChevronRight className="ml-auto w-5 h-5 text-slate-300" />
        </button>

        <button onClick={() => setView('profile')} className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-50 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-900">Configurações</h3>
            <p className="text-sm text-slate-500">Perfil e loja</p>
          </div>
          <ChevronRight className="ml-auto w-5 h-5 text-slate-300" />
        </button>
      </div>
    </div>
  );

  const renderPartnerOrders = () => (
    <div className="pb-24">
      <header className="px-6 pt-8 pb-4 flex items-center gap-4">
        <button onClick={() => setView('partner_dashboard')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display font-bold">Pedidos Recebidos</h1>
      </header>
      <div className="px-6 space-y-4 mt-4">
        {partnerOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">Nenhum pedido recebido ainda.</p>
          </div>
        ) : (
          partnerOrders.map(o => (
            <div key={o.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">{o.client_name}</h3>
                  <p className="text-xs text-slate-400">Pedido #{o.id} • {o.payment_method.toUpperCase()}</p>
                </div>
                <span className="text-sm font-bold text-primary">R$ {o.total.toFixed(2)}</span>
              </div>
              <div className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">
                <p className="flex items-center gap-2 mb-1"><MapPin className="w-3 h-3" /> {o.client_address}</p>
                <p className="flex items-center gap-2"><Phone className="w-3 h-3" /> {o.client_phone}</p>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['preparing', 'ready', 'out_for_delivery', 'delivered'].map(status => (
                  <button 
                    key={status}
                    onClick={() => updateOrderStatus(o.id, status)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                      o.status === status ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderPartnerMenu = () => (
    <div className="pb-24">
      <header className="px-6 pt-8 pb-4 flex items-center gap-4">
        <button onClick={() => setView('partner_dashboard')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display font-bold">Meu Cardápio</h1>
        <button onClick={() => setShowAddProduct(true)} className="ml-auto w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
          <Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="px-6 space-y-4 mt-4">
        {products.map(p => (
          <div key={p.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-slate-900">{p.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1">{p.description}</p>
              <p className="text-sm font-bold text-primary mt-1">R$ {p.price.toFixed(2)}</p>
            </div>
            <button onClick={() => handleDeleteProduct(p.id)} className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAddProduct && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
          >
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[40px] px-8 pt-10 pb-12 max-w-md mx-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-display font-bold">Novo Produto</h2>
                <button onClick={() => setShowAddProduct(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <Input label="Nome do Produto" placeholder="Ex: Pizza Calabresa" value={newProduct.name} onChange={(e: any) => setNewProduct({ ...newProduct, name: e.target.value })} />
              <Input label="Descrição" placeholder="Ingredientes, tamanho..." value={newProduct.description} onChange={(e: any) => setNewProduct({ ...newProduct, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Preço" placeholder="0.00" type="number" value={newProduct.price} onChange={(e: any) => setNewProduct({ ...newProduct, price: e.target.value })} />
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 mb-1 ml-1">Categoria</label>
                  <select 
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20"
                    value={newProduct.category}
                    onChange={(e: any) => setNewProduct({ ...newProduct, category: e.target.value })}
                  >
                    <option value="Comida">Comida</option>
                    <option value="Bebida">Bebida</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleAddProduct} disabled={loading} className="mt-4">
                {loading ? 'Adicionando...' : 'Adicionar ao Cardápio'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-white px-8 pt-24 pb-12 flex flex-col">
      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-primary rounded-3xl mx-auto mb-6 flex items-center justify-center text-white shadow-xl shadow-orange-200 rotate-12">
          <ShoppingBag className="w-10 h-10 -rotate-12" />
        </div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Bem-vindo!</h1>
        <p className="text-slate-500 mt-2">Peça o melhor de Pirapemas em um toque.</p>
      </div>

      <div className="flex-1">
        <Input 
          label="Telefone" 
          placeholder="(99) 99999-9999" 
          icon={Phone} 
          value={authData.phone} 
          onChange={(e: any) => setAuthData({ ...authData, phone: e.target.value })} 
        />
        <Input 
          label="PIN de Segurança (6 dígitos)" 
          placeholder="••••••" 
          type="password" 
          maxLength={6} 
          icon={X} 
          value={authData.pin} 
          onChange={(e: any) => setAuthData({ ...authData, pin: e.target.value })} 
        />
        <Button onClick={handleLogin} disabled={loading} className="mt-4">
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
        <button onClick={() => setView('register')} className="w-full mt-6 text-slate-500 font-medium text-sm">
          Não tem uma conta? <span className="text-primary font-bold">Cadastre-se</span>
        </button>
      </div>

      <div className="mt-auto text-center pt-8 border-t border-slate-100">
        <p className="text-xs text-slate-400 font-medium">Delivery Pira v1.0</p>
      </div>
    </div>
  );

  const renderRegister = () => {
    return (
      <div className="min-h-screen bg-white px-8 pt-12 pb-12">
        <header className="mb-8 flex items-center gap-4">
          <button onClick={() => regStep > 1 ? setRegStep(regStep - 1) : setView('login')} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-display font-bold">Criar Conta</h1>
        </header>

        {regStep === 1 ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setAuthData({ ...authData, role: 'client' })}
                className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all ${authData.role === 'client' ? 'border-primary bg-orange-50 text-primary' : 'border-slate-100 text-slate-400'}`}
              >
                Cliente
              </button>
              <button 
                onClick={() => setAuthData({ ...authData, role: 'partner' })}
                className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all ${authData.role === 'partner' ? 'border-primary bg-orange-50 text-primary' : 'border-slate-100 text-slate-400'}`}
              >
                Parceiro
              </button>
            </div>
            <Input label="Nome Completo" placeholder="Seu nome" value={authData.name} onChange={(e: any) => setAuthData({ ...authData, name: e.target.value })} />
            <Input label="Telefone" placeholder="(99) 99999-9999" value={authData.phone} onChange={(e: any) => setAuthData({ ...authData, phone: e.target.value })} />
            <Input label="PIN de Segurança (6 dígitos)" placeholder="••••••" type="password" maxLength={6} value={authData.pin} onChange={(e: any) => setAuthData({ ...authData, pin: e.target.value })} />
            <Button onClick={() => setRegStep(2)} className="mt-4">Próximo Passo</Button>
          </motion.div>
        ) : authData.role === 'client' ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Input label="Endereço" placeholder="Rua, número, bairro" value={authData.address} onChange={(e: any) => setAuthData({ ...authData, address: e.target.value })} />
            <Input label="Ponto de Referência" placeholder="Ex: Perto da praça" value={authData.reference} onChange={(e: any) => setAuthData({ ...authData, reference: e.target.value })} />
            <Input label="Email (Opcional)" placeholder="seu@email.com" value={authData.email} onChange={(e: any) => setAuthData({ ...authData, email: e.target.value })} />
            <Button onClick={handleRegister} disabled={loading} className="mt-4">Finalizar Cadastro</Button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 mb-6">
              <p className="text-xs text-yellow-700 leading-relaxed">
                Para se cadastrar como parceiro, você precisa de um código de protocolo. Entre em contato com o desenvolvedor via WhatsApp: 19991759068.
              </p>
            </div>
            <Input label="Nome da Loja" placeholder="Ex: Pizzaria do Pira" value={partnerRegData.storeName} onChange={(e: any) => setPartnerRegData({ ...partnerRegData, storeName: e.target.value })} />
            <Input label="Telefone da Loja" placeholder="(99) 99999-9999" value={partnerRegData.storePhone} onChange={(e: any) => setPartnerRegData({ ...partnerRegData, storePhone: e.target.value })} />
            <Input label="Endereço da Loja" placeholder="Localização completa" value={partnerRegData.storeAddress} onChange={(e: any) => setPartnerRegData({ ...partnerRegData, storeAddress: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Taxa de Entrega" placeholder="0.00" type="number" value={partnerRegData.deliveryFee} onChange={(e: any) => setPartnerRegData({ ...partnerRegData, deliveryFee: e.target.value })} />
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 mb-1 ml-1">Categoria</label>
                <select 
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20"
                  value={partnerRegData.category}
                  onChange={(e: any) => setPartnerRegData({ ...partnerRegData, category: e.target.value })}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <Input label="Código de Protocolo" placeholder="Digite o código recebido" value={partnerRegData.protocol} onChange={(e: any) => setPartnerRegData({ ...partnerRegData, protocol: e.target.value })} />
            <Button onClick={handleRegister} disabled={loading || !partnerRegData.protocol} className="mt-4">Criar Conta de Parceiro</Button>
          </motion.div>
        )}
      </div>
    );
  };

  // --- Main Render ---

  const renderView = () => {
    if (view === 'login') return renderLogin();
    if (view === 'register') return renderRegister();
    
    // Protected views
    if (!user) {
      if (['checkout', 'orders', 'profile', 'partner_dashboard', 'partner_orders', 'partner_menu'].includes(view)) {
        return renderLogin();
      }
    }

    switch (view) {
      case 'home': return renderHome();
      case 'store_detail': return renderStoreDetail();
      case 'cart': return renderCart();
      case 'checkout': return renderCheckout();
      case 'orders': return renderOrders();
      case 'profile': return renderProfile();
      case 'partner_dashboard': return renderPartnerDashboard();
      case 'partner_orders': return renderPartnerOrders();
      case 'partner_menu': return renderPartnerMenu();
      default: return renderHome();
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>

      {/* Notifications Toast */}
      <div className="fixed top-6 left-6 right-6 z-50 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl mb-2 flex items-center gap-3 pointer-events-auto"
            >
              <Bell className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">{n}</p>
              <button onClick={() => setNotifications(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Navigation Bar */}
      {!['login', 'register', 'checkout', 'cart'].includes(view) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center safe-bottom z-40 max-w-md mx-auto">
          {!user || user.role === 'client' ? (
            <>
              <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-primary' : 'text-slate-400'}`}>
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-bold">Início</span>
              </button>
              <button onClick={() => setView('orders')} className={`flex flex-col items-center gap-1 ${view === 'orders' ? 'text-primary' : 'text-slate-400'}`}>
                <ShoppingBag className="w-6 h-6" />
                <span className="text-[10px] font-bold">Pedidos</span>
              </button>
              <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 ${view === 'profile' ? 'text-primary' : 'text-slate-400'}`}>
                <UserIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold">{user ? 'Perfil' : 'Entrar'}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setView('partner_dashboard')} className={`flex flex-col items-center gap-1 ${view === 'partner_dashboard' ? 'text-primary' : 'text-slate-400'}`}>
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-bold">Painel</span>
              </button>
              <button onClick={() => { fetchPartnerOrders(); setView('partner_orders'); }} className={`flex flex-col items-center gap-1 ${view === 'partner_orders' ? 'text-primary' : 'text-slate-400'}`}>
                <ShoppingBag className="w-6 h-6" />
                <span className="text-[10px] font-bold">Pedidos</span>
              </button>
              <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 ${view === 'profile' ? 'text-primary' : 'text-slate-400'}`}>
                <UserIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold">Perfil</span>
              </button>
            </>
          )}
        </nav>
      )}
    </div>
  );
}
