import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{{DISPLAY_NAME}}</h1>
        <p className="mt-4 text-gray-600">Rust + Actix-web + React + PostgreSQL</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
