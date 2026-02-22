import express from 'express';
import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

let supabaseCached: any = null;

const getSupabase = () => {
  if (supabaseCached) return supabaseCached;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (!url || !key) {
    console.error('ERRO: Configuração do Supabase incompleta no servidor.', { 
      temUrl: !!url, 
      temKey: !!key,
      urlPreview: url ? url.substring(0, 10) + '...' : 'nulo'
    });
    return null;
  }
  try {
    supabaseCached = createClient(url, key);
    return supabaseCached;
  } catch (e) {
    console.error('Erro ao criar cliente Supabase:', e);
    return null;
  }
};

const app = express();
const server = createServer(app);

const upload = multer({ storage: multer.memoryStorage() });

// Helper to upload to Supabase Storage
async function uploadToSupabase(file: any, bucket: string) {
  const supabase = getSupabase();
  const fileName = `${Date.now()}-${file.originalname}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });
    
  if (error) throw error;
  
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);
    
  return publicUrl;
}

app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/ping', (req, res) => {
  try {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      env: {
        hasViteUrl: !!process.env.VITE_SUPABASE_URL,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
        urlPreview: url ? `${url.substring(0, 10)}...` : 'missing',
        keyPreview: key ? `${key.substring(0, 5)}...` : (anonKey ? `${anonKey.substring(0, 5)}...` : 'missing')
      },
      nodeEnv: process.env.NODE_ENV
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Erro no ping', message: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, phone, email, pin, address, reference, role } = req.body;
  console.log('Tentativa de registro:', { name, phone, role });
  
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        name, 
        phone, 
        email: email || null, 
        pin: String(pin), 
        address: address || null, 
        reference: reference || null, 
        role 
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Erro Supabase:', error);
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ id: data.id });
  } catch (e: any) {
    console.error('Erro Interno:', e);
    res.status(500).json({ error: e.message || 'Erro interno no servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { phone, pin } = req.body;
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('pin', String(pin))
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    res.json({ user, store });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stores', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ error: 'Configuração do banco de dados ausente no Vercel. Verifique as variáveis de ambiente.' });
    }
    const { data: stores, error } = await supabase
      .from('stores')
      .select('*')
      .eq('status', 'online');
    
    if (error) throw error;
    res.json(stores);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stores/:id/products', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', req.params.id)
      .eq('available', true);
    
    if (error) throw error;
    res.json(products);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { client_id, store_id, items, total, payment_method, change_for } = req.body;
  
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ client_id, store_id, total, payment_method, change_for }])
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    res.json({ orderId: order.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders/client/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        stores (name)
      `)
      .eq('client_id', req.params.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Flatten the store name for the frontend
    const formattedOrders = orders.map(o => ({
      ...o,
      store_name: (o as any).stores?.name
    }));
    
    res.json(formattedOrders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders/store/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        users (name, phone, address)
      `)
      .eq('store_id', req.params.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    const formattedOrders = orders.map(o => ({
      ...o,
      client_name: (o as any).users?.name,
      client_phone: (o as any).users?.phone,
      client_address: (o as any).users?.address
    }));

    res.json(formattedOrders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/partner/store', upload.fields([{ name: 'parking' }, { name: 'interior' }]), async (req: any, res) => {
  const { owner_id, name, phone, address, email, delivery_fee, min_free_delivery, whatsapp, category } = req.body;
  
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    let parking_photo = null;
    let interior_photo = null;

    if (req.files && (req.files as any)['parking']) {
      parking_photo = await uploadToSupabase((req.files as any)['parking'][0], 'photos');
    }
    if (req.files && (req.files as any)['interior']) {
      interior_photo = await uploadToSupabase((req.files as any)['interior'][0], 'photos');
    }

    const { data, error } = await supabase
      .from('stores')
      .insert([{ 
        owner_id, name, phone, address, 
        email: email || null, 
        delivery_fee: parseFloat(delivery_fee), 
        min_free_delivery: min_free_delivery ? parseFloat(min_free_delivery) : null, 
        whatsapp, category,
        parking_photo,
        interior_photo
      }])
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/partner/products', upload.single('photo'), async (req: any, res) => {
  const { store_id, name, description, price, category } = req.body;
  try {
    let photo = null;
    if (req.file) {
      photo = await uploadToSupabase(req.file, 'photos');
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { data, error } = await supabase
      .from('products')
      .insert([{ store_id, name, description, price: parseFloat(price), category, photo }])
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/partner/products/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/partner/store/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: 'Erro de configuração do banco de dados.' });
    const { error } = await supabase
      .from('stores')
      .update({ status })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Global Error Handler:', err);
  res.status(500).json({ 
    error: 'Erro interno no servidor', 
    message: err.message,
    path: req.path
  });
});

export { app };

// Vite middleware for development - ONLY in dev mode
if (process.env.NODE_ENV !== 'production') {
  const startDevServer = async () => {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      
      const PORT = 3000;
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Dev server running on http://0.0.0.0:${PORT}`);
      });
    } catch (e) {
      console.error('Failed to start Vite dev server:', e);
    }
  };
  startDevServer();
}
