// GET /api/progress — return all users' progress
export async function onRequestGet(context) {
  const { env } = context;
  const list = await env.STUDY_PROGRESS.list();
  const users = [];

  for (const key of list.keys) {
    const data = await env.STUDY_PROGRESS.get(key.name, 'json');
    if (data) users.push(data);
  }

  return new Response(JSON.stringify(users), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// POST /api/progress — save a user's progress
export async function onRequestPost(context) {
  const { env, request } = context;

  const body = await request.json();
  const { name, buckets } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });
  }

  const cleanName = name.trim().slice(0, 30);

  // Count buckets
  let green = 0, yellow = 0, red = 0;
  if (buckets && typeof buckets === 'object') {
    Object.values(buckets).forEach(b => {
      if (b === 'green') green++;
      else if (b === 'yellow') yellow++;
      else if (b === 'red') red++;
    });
  }

  const data = {
    name: cleanName,
    green,
    yellow,
    red,
    seen: green + yellow + red,
    total: 92,
    buckets: buckets || {},
    updatedAt: new Date().toISOString()
  };

  await env.STUDY_PROGRESS.put(cleanName.toLowerCase(), JSON.stringify(data));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
