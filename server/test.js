const http = require('http');
fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'Hugo', password: 'password' })
})
.then(r => r.json())
.then(res => {
  const token = res.token;
  fetch('http://localhost:3001/api/servers/8/members/3/role', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_id: 1 })
  }).then(r=>r.text()).then(console.log);
});
