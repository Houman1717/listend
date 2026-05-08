import { supabase } from './supabase';

export async function navigateToProfile(username: string, router: any) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();
  if (data?.id) {
    router.push({ pathname: '/user-profile', params: { userId: data.id } });
  }
}
