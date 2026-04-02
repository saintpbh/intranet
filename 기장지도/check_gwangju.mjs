import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_KEY = line.split('=')[1].trim();
});

async function checkGwangju() {
  const url = `${SUPABASE_URL}/rest/v1/churches?address=like.*광주*&select=name,address,lat,lng`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  const data = await response.json();
  console.log(`Total DB entries containing 광주: ${data.length}`);
  
  const no_coords = data.filter(c => !c.lat || !c.lng);
  console.log(`Without coordinates: ${no_coords.length}`);
  if (no_coords.length > 0) console.log("Sample without coords:", no_coords.slice(0, 3));
  
  const with_coords = data.filter(c => c.lat && c.lng);
  if (with_coords.length > 0) console.log("Sample WITH coords:", with_coords.slice(0, 3));
}

checkGwangju();
