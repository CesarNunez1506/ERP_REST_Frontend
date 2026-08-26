import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { ToastProvider } from './components/ui.jsx'
import Panel from './pages/Panel.jsx'
import Mesas from './pages/Mesas.jsx'
import CroquisEditor from './pages/CroquisEditor.jsx'
import Ordenes from './pages/Ordenes.jsx'
import OrdenDetalle from './pages/OrdenDetalle.jsx'
import Cocina from './pages/Cocina.jsx'
import Caja from './pages/Caja.jsx'
import Carta from './pages/Carta.jsx'
import Estaciones from './pages/Estaciones.jsx'
import Personal from './pages/Personal.jsx'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Panel />} />
            <Route path="mesas" element={<Mesas />} />
            <Route path="mesas/croquis" element={<CroquisEditor />} />
            <Route path="ordenes" element={<Ordenes />} />
            <Route path="ordenes/:id" element={<OrdenDetalle />} />
            <Route path="cocina" element={<Cocina />} />
            <Route path="caja" element={<Caja />} />
            <Route path="carta" element={<Carta />} />
            <Route path="estaciones" element={<Estaciones />} />
            <Route path="personal" element={<Personal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
