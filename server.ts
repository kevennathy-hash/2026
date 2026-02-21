import express from 'express';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const app = express();
const server = createServer(app);

const upload = multer({ storage: multer.memoryStorage() });

// Helper to upload to Supabase Storage
async function uploadToSupabase(file: any, bucket: string) {
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
app.post('/api/auth/register', async (req, res) => {
  const { name, phone, email, pin, address, reference, role } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, phone, email, pin, address, reference, role }])
      .select()
      .single();
    
    if (error) throw error;
    res.json({ id: data.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { phone, pin } = req.body;
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('pin', pin)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    res.json({ user, store });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stores', async (req, res) => {
  try {
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
    let parking_photo = null;
    let interior_photo = null;

    if (req.files['parking']) {
      parking_photo = await uploadToSupabase(req.files['parking'][0], 'photos');
    }
    if (req.files['interior']) {
      interior_photo = await uploadToSupabase(req.files['interior'][0], 'photos');
    }

    const { data, error } = await supabase
      .from('stores')
      .insert([{ 
        owner_id, name, phone, address, email, 
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

export { app };

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }

  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();
