// // src/main.jsx
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
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ Check backend connection
    const apiBase = import.meta.env.VITE_API_URL;
    fetch(`${apiBase}/ping`)
      .then(res => res.json())
      .then(data => setBackendStatus(`Backend OK: ${JSON.stringify(data)}`))
      .catch(err => setBackendStatus(`Backend Error: ${err.message}`));

    // ✅ Get initial Supabase session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // ✅ Listen for Supabase auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        navigate('/'); // stay on dashboard after login/register
      } else {
        navigate('/'); // stay on dashboard after logout too
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <>
      {/* ✅ Show backend status at the top for debugging */}
      <div style={{ padding: "10px", background: "#eee", fontSize: "14px" }}>
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

serviceWorkerRegistration.register(); // ✅ enables caching and offline





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
