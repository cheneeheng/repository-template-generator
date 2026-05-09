import { Routes, Route } from 'react-router-dom'
import { Shell } from './components/Shell.jsx'
import TemplatePickerPage from './pages/TemplatePickerPage.jsx'
import ConfigurePage from './pages/ConfigurePage.jsx'
import PreviewPage from './pages/PreviewPage.jsx'
import ExportPage from './pages/ExportPage.jsx'
import SharePage from './pages/SharePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell step={1}><TemplatePickerPage /></Shell>} />
      <Route path="/configure" element={<Shell step={2}><ConfigurePage /></Shell>} />
      <Route path="/preview" element={<Shell step={3}><PreviewPage /></Shell>} />
      <Route path="/export" element={<Shell step={4}><ExportPage /></Shell>} />
      <Route path="/share/:id" element={<SharePage />} />
    </Routes>
  )
}
