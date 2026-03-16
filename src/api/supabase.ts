import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase Environment Variables');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const uploadImage = async (bucket: string, path: string, base64: string) => {
  const { decode } = require('base64-arraybuffer');
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
};

export const deleteFile = async (bucket: string, url: string) => {
  if (!url) return;
  try {
    const path = url.split(`${bucket}/`)[1];
    if (!path) return;

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) console.error('Error deleting file:', error);
  } catch (e) {
    console.error('Error parsing file path for deletion:', e);
  }
};
