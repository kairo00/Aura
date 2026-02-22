const fetch = require('node-fetch'); // wait node 18+ has fetch natively
async function run() {
  const r1 = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Hugo', password: 'password' })
  });
  const res = await r1.json();
  const token = res.token;
  // Let's try to assign a role to myself
  const r2 = await fetch('http://localhost:3001/api/servers/8/members/' + res.user.id + '/role', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: 1 })
  });
  console.log("Self assign:", r2.status, await r2.text());
}
run();
