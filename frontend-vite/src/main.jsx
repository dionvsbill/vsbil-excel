// src/main.jsx
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

import Dashboard from './pages/Dashboard.jsx';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ Confirm backend is reachable using Netlify env variable
    const apiBase = import.meta.env.VITE_API_URL;
    fetch(`${apiBase}/ping`)
      .then(res => res.json())
      .then(data => setBackendStatus(`✅ Backend says: ${data.message}`))
      .catch(err => setBackendStatus(`❌ Backend error: ${err.message}`));

    // ✅ Supabase session logic
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      navigate('/');
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <>
      {/* ✅ Show backend status for debugging */}
      <div style={{
        padding: "10px",
        background: "#f0f0f0",
        fontSize: "14px",
        borderBottom: "1px solid #ccc"
      }}>
        {backendStatus}
      </div>

      <Routes>
        <Route path="/" element={<Dashboard session={session} />} />
      </Routes>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

serviceWorkerRegistration.register();



// import React, { useEffect, useState } from 'react';
// import ReactDOM from 'react-dom/client';
// import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
// import { supabase } from './supabaseClient';
// import * as serviceWorkerRegistration from './serviceWorkerRegistration';


// import Dashboard from './pages/Dashboard.jsx';
// import './index.css';

// function App() {
//   const [session, setSession] = useState(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     // Get initial session
//     supabase.auth.getSession().then(({ data }) => {
//       setSession(data.session);
//     });

//     // Listen for changes
//     const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
//       setSession(newSession);
//       if (newSession) {
//         navigate('/'); // stay on dashboard after login/register
//       } else {
//         navigate('/'); // stay on dashboard after logout too
//       }
//     });

//     return () => {
//       listener.subscription.unsubscribe();
//     };
//   }, [navigate]);

//   return (
//     <Routes>
//       <Route path="/" element={<Dashboard session={session} />} />
//     </Routes>
//   );
// }

// ReactDOM.createRoot(document.getElementById('root')).render(
//   <BrowserRouter>
//     <App />
//   </BrowserRouter>
// );
// serviceWorkerRegistration.register(); // ✅ enables caching and offline
