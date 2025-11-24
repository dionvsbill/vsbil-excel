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
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ Optional: silently confirm backend is reachable
    const apiBase = import.meta.env.VITE_API_URL;
    fetch(`${apiBase}/ping`)
      .then(res => res.json())
      .then(data => console.log("Backend says:", data.message))
      .catch(err => console.error("Backend error:", err.message));

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
    <Routes>
      <Route path="/" element={<Dashboard session={session} />} />
    </Routes>
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
