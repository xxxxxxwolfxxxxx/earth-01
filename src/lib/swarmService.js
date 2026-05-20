import { supabase } from './supabase'

export async function fetchPublishedArticles({ limit = 20 } = {}) {
  const { data } = await supabase.from('articles')
    .select('id, slug, title, hero_image_url, contributor_count, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function fetchArticleBySlug(slug) {
  const { data } = await supabase.from('articles')
    .select('*').eq('slug', slug).single()
  return data
}

export async function fetchRecentJobs({ limit = 10 } = {}) {
  const { data } = await supabase.from('article_jobs')
    .select('id, job_type, status, completed_at, article_id')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function fetchSwarmStatus() {
  const { count: active } = await supabase.from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('donate_tokens', true)
  const { count: articleCount } = await supabase.from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
  return { activeUsers: active ?? 0, publishedCount: articleCount ?? 0, threshold: 10 }
}

export async function suggestTopic(title) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Login benötigt')
  await supabase.from('topic_pool').insert({
    title, source: 'user', suggested_by_user: user.id,
  })
}
